"""
API del coach por voz (OpenAI). Todo vive bajo web/ para despliegue.

  cd web
  pip install -r api/requirements.txt
  uvicorn api.main:app --reload --port 8000

Coloca OPENAI_API_KEY en web/.env o en la raíz del repo (.env).
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

WEB_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = WEB_DIR / "public"
REPO_ROOT = WEB_DIR.parent
sys.path.insert(0, str(REPO_ROOT))

import settings_ia as sia  # noqa: E402

for env_path in (WEB_DIR / ".env", REPO_ROOT / ".env"):
    if env_path.is_file():
        load_dotenv(env_path)

app = FastAPI(title="pf-IA Coach API", version="1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ia: sia.IASettings | None = None
_client = None


def _ia_settings() -> sia.IASettings:
    path = PUBLIC_DIR / "settings_ia.json"
    if path.is_file():
        return sia.load_settings(PUBLIC_DIR, path.name)
    return sia.load_settings(REPO_ROOT)


def _client():
    global _ia, _client
    if _client is not None:
        return _client, _ia
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY no definida (web/.env o .env en raíz)")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise HTTPException(503, "Instala openai: pip install openai") from exc
    _ia = _ia_settings()
    _client = OpenAI(api_key=key, timeout=_ia.openai.timeout_seconds)
    return _client, _ia


def _knowledge_path(exercise_id: str) -> Path | None:
    inst = PUBLIC_DIR / "exercise_instructions" / f"{exercise_id}.json"
    if not inst.is_file():
        return None
    data = json.loads(inst.read_text(encoding="utf-8"))
    rel = str(data.get("knowledge_doc", "")).strip()
    if not rel:
        return None
    path = (PUBLIC_DIR / rel).resolve()
    if path.is_file():
        return path
    path = (REPO_ROOT / rel).resolve()
    return path if path.is_file() else None


def _load_knowledge(exercise_id: str) -> str:
    path = _knowledge_path(exercise_id)
    if not path:
        return ""
    text = path.read_text(encoding="utf-8")
    _, ia = _client()
    return text[: ia.rag.max_doc_chars]


def _chat_short(user_prompt: str, *, max_tokens: int = 220) -> str:
    client, ia = _client()
    chat = ia.chat
    resp = client.chat.completions.create(
        model=chat.model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Eres entrenador de fuerza. Responde solo texto para leer en voz alta, "
                    "breve, español neutro, sin markdown."
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
        temperature=min(0.6, chat.temperature),
        max_tokens=min(max_tokens, chat.max_tokens),
    )
    return (resp.choices[0].message.content or "").strip()


def _exercise_paths(exercise_id: str) -> tuple[Path, Path]:
    inst = PUBLIC_DIR / "exercise_instructions"
    return inst / f"{exercise_id}.json", inst / f"{exercise_id}_calibration.json"


@app.post("/api/exercise/{exercise_id}/calibration")
def save_calibration(exercise_id: str, body: dict[str, Any]) -> dict[str, str]:
    """Guarda patch de calibración (PWA o herramientas locales)."""
    _, cal_path = _exercise_paths(exercise_id)
    cal_path.parent.mkdir(parents=True, exist_ok=True)
    cal_path.write_text(
        json.dumps(body, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return {"saved": str(cal_path)}


@app.post("/api/exercise/{exercise_id}/calibration/apply")
def apply_calibration_api(exercise_id: str) -> dict[str, Any]:
    """Fusiona *_calibration.json en el JSON principal del ejercicio."""
    from apply_calibration import apply_patch

    main_path, cal_path = _exercise_paths(exercise_id)
    if not main_path.is_file():
        raise HTTPException(404, f"No existe {main_path.name}")
    if not cal_path.is_file():
        raise HTTPException(404, f"Calibra antes: {cal_path.name}")
    main = json.loads(main_path.read_text(encoding="utf-8"))
    patch = json.loads(cal_path.read_text(encoding="utf-8"))
    changes = apply_patch(main, patch)
    if changes:
        main_path.write_text(
            json.dumps(main, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return {"changes": changes, "saved": bool(changes)}


@app.get("/api/health")
def health() -> dict[str, str]:
    try:
        _client()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, str(exc)) from exc


@app.post("/api/coach/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, str]:
    client, ia = _client()
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        path = Path(tmp.name)
        path.write_bytes(await file.read())
    try:
        with path.open("rb") as audio_file:
            tr = client.audio.transcriptions.create(
                model=ia.whisper.model,
                file=audio_file,
                language=ia.whisper.language,
            )
        return {"text": (tr.text or "").strip()}
    finally:
        try:
            path.unlink()
        except OSError:
            pass


class AskBody(BaseModel):
    question: str
    exercise_id: str = "press_militar"
    session_context: dict[str, Any] = Field(default_factory=dict)


@app.post("/api/coach/ask")
def ask_coach(body: AskBody) -> dict[str, str]:
    client, ia = _client()
    doc = _load_knowledge(body.exercise_id)
    if not doc:
        raise HTTPException(404, f"Sin knowledge_doc para {body.exercise_id}")
    inst = PUBLIC_DIR / "exercise_instructions" / f"{body.exercise_id}.json"
    display = body.exercise_id
    if inst.is_file():
        display = str(
            json.loads(inst.read_text(encoding="utf-8")).get("display_name", display)
        )
    ctx_json = json.dumps(body.session_context, ensure_ascii=False, indent=0)
    system = sia.build_system_prompt(ia)
    user = (
        f"Ejercicio: {display}\n\n"
        f"--- Documento de referencia ---\n{doc}\n\n"
        f"--- Estado actual de la sesión (JSON) ---\n{ctx_json}\n\n"
        f"Pregunta del atleta: {body.question.strip()}"
    )
    chat = ia.chat
    resp = client.chat.completions.create(
        model=chat.model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=chat.temperature,
        max_tokens=chat.max_tokens,
        top_p=chat.top_p,
        frequency_penalty=chat.frequency_penalty,
        presence_penalty=chat.presence_penalty,
    )
    return {"answer": (resp.choices[0].message.content or "").strip()}


class ClassifyBody(BaseModel):
    transcript: str


@app.post("/api/coach/classify-readiness")
def classify_readiness(body: ClassifyBody) -> dict[str, str]:
    prompt = (
        "Clasifica la respuesta del atleta tras preguntar si está listo para la siguiente serie "
        "o necesita más descanso.\n"
        f"Transcripción: «{body.transcript.strip()}»\n"
        "Responde SOLO una palabra: ready, more_rest o unclear."
    )
    raw = _chat_short(prompt, max_tokens=16).strip().lower()
    if "more" in raw or "minuto" in raw or "tiempo" in raw:
        return {"action": "more_rest"}
    if "ready" in raw or "listo" in raw:
        return {"action": "ready"}
    return {"action": "unclear"}


class SetErrorIn(BaseModel):
    rule_id: str
    message: str
    count: int = 1


class SummarizeBody(BaseModel):
    exercise_id: str = "press_militar"
    set_num: int
    errors: list[SetErrorIn] = Field(default_factory=list)


@app.post("/api/coach/summarize-set")
def summarize_set(body: SummarizeBody) -> dict[str, str]:
    if not body.errors:
        return {
            "text": (
                f"Serie {body.set_num} sin avisos de forma. Buen trabajo. "
                "Aprovecha el descanso para respirar."
            )
        }
    lines = [f"- {e.message} (×{e.count})" for e in body.errors[:8]]
    prompt = (
        f"Eres entrenador. Resume en 3-5 frases para leer en voz alta durante el descanso "
        f"tras la serie {body.set_num} de press militar sentado. Sé breve, constructivo, en español. "
        f"Avisos:\n" + "\n".join(lines)
    )
    try:
        return {"text": _chat_short(prompt, max_tokens=220)}
    except Exception as exc:
        top = body.errors[0].message
        return {
            "text": f"En la serie {body.set_num} revisa: {top}. Corrige en la siguiente.",
            "detail": str(exc),
        }
