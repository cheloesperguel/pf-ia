/**
 * OpenAI desde el navegador (clave VITE_OPENAI_API_KEY).
 * En dev, Vite hace proxy /openai → api.openai.com (evita CORS).
 *
 * ADVERTENCIA: la clave queda en el bundle del cliente. Solo uso personal / desarrollo.
 */

import {
  getActiveLocale,
  localeContentUrl,
  whisperLang,
  type AppLocale,
} from "@/i18n/locale";
import { loadExercise } from "./loadConfig";
import { buildSystemPrompt, loadSettingsIa } from "./loadSettingsIa";

const API_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() ?? "";
const API_BASE =
  (import.meta.env.VITE_OPENAI_API_BASE as string | undefined)?.trim() ||
  "/openai/v1";

export function openaiDirectConfigured(): boolean {
  return API_KEY.length > 10;
}

function authHeaders(json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function openaiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return j.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function openaiHealth(): Promise<boolean> {
  if (!openaiDirectConfigured()) return false;
  try {
    const res = await fetch(`${API_BASE}/models`, {
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function loadKnowledgeMarkdown(
  exerciseId: string,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  const cfg = await loadExercise(exerciseId, locale);
  const rel = String(cfg.knowledge_doc ?? "").trim();
  if (!rel) return "";
  const path = rel.startsWith("/")
    ? localeContentUrl(locale, rel.replace(/^\//, ""))
    : localeContentUrl(locale, rel);
  const res = await fetch(path);
  if (!res.ok) return "";
  let text = await res.text();
  const ia = await loadSettingsIa();
  const truncNote =
    locale === "en" ? "\n\n[... document truncated ...]" : "\n\n[... documento truncado ...]";
  if (text.length > ia.rag.max_doc_chars) {
    text = text.slice(0, ia.rag.max_doc_chars) + truncNote;
  }
  return text;
}

export async function openaiTranscribe(
  blob: Blob,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  const ia = await loadSettingsIa();
  const fd = new FormData();
  const name =
    blob.type.includes("mp4") || blob.type.includes("aac")
      ? "audio.m4a"
      : "audio.webm";
  fd.append("file", blob, name);
  fd.append("model", ia.whisper.model);
  fd.append("language", whisperLang(locale));
  const res = await fetch(`${API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) throw new Error(await openaiError(res));
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

async function chatCompletion(
  messages: { role: string; content: string }[],
  maxTokens?: number,
): Promise<string> {
  const ia = await loadSettingsIa();
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({
      model: ia.chat.model,
      messages,
      temperature: ia.chat.temperature,
      max_tokens: maxTokens ?? ia.chat.max_tokens,
      top_p: ia.chat.top_p,
      frequency_penalty: ia.chat.frequency_penalty,
      presence_penalty: ia.chat.presence_penalty,
    }),
  });
  if (!res.ok) throw new Error(await openaiError(res));
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export async function openaiAskCoach(
  question: string,
  exerciseId: string,
  sessionContext: Record<string, unknown>,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  const ia = await loadSettingsIa();
  const doc = await loadKnowledgeMarkdown(exerciseId, locale);
  if (!doc) throw new Error(`Sin knowledge_doc para ${exerciseId}`);
  const cfg = await loadExercise(exerciseId, locale);
  const display = String(cfg.display_name ?? exerciseId);
  const ctxJson = ia.rag.include_session_context
    ? JSON.stringify(sessionContext, null, 0)
    : "{}";
  const en = locale === "en";
  const user = en
    ? [
        `Exercise: ${display}`,
        "",
        "--- Reference document ---",
        doc,
        "",
        "--- Current session state (JSON) ---",
        ctxJson,
        "",
        `Athlete question: ${question.trim()}`,
      ].join("\n")
    : [
        `Ejercicio: ${display}`,
        "",
        "--- Documento de referencia ---",
        doc,
        "",
        "--- Estado actual de la sesión (JSON) ---",
        ctxJson,
        "",
        `Pregunta del atleta: ${question.trim()}`,
      ].join("\n");
  return chatCompletion(
    [
      { role: "system", content: buildSystemPrompt(ia, locale) },
      { role: "user", content: user },
    ],
    ia.chat.max_tokens,
  );
}

export async function openaiClassifyReadiness(
  transcript: string,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  const en = locale === "en";
  const prompt = en
    ? [
        "Classify the athlete's reply after asking if they are ready for the next set or need more rest.",
        `Transcript: «${transcript.trim()}»`,
        "Reply with ONLY one word: ready, more_rest or unclear.",
      ].join("\n")
    : [
        "Clasifica la respuesta del atleta tras preguntar si está listo para la siguiente serie o necesita más descanso.",
        `Transcripción: «${transcript.trim()}»`,
        "Responde SOLO una palabra: ready, more_rest o unclear.",
      ].join("\n");
  const raw = (await chatCompletion([{ role: "user", content: prompt }], 16)).toLowerCase();
  if (raw.includes("more") || raw.includes("minuto") || raw.includes("minute") || raw.includes("tiempo") || raw.includes("time")) {
    return "more_rest";
  }
  if (raw.includes("ready") || raw.includes("listo")) return "ready";
  return "unclear";
}

export async function openaiSummarizeSet(
  exerciseId: string,
  setNum: number,
  errors: { rule_id: string; message: string; count: number }[],
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  const en = locale === "en";
  if (!errors.length) {
    return en
      ? `Set ${setNum} with no form alerts. Good work. Use the rest to breathe.`
      : `Serie ${setNum} sin avisos de forma. Buen trabajo. Aprovecha el descanso para respirar.`;
  }
  const lines = errors.map((e) => `- ${e.message} (×${e.count})`);
  const prompt = en
    ? [
        `You are a coach. Summarize in 3-5 sentences to read aloud during rest after set ${setNum} of ${exerciseId}.`,
        "Be brief, constructive, in English.",
        "Alerts:",
        ...lines,
      ].join("\n")
    : [
        `Eres entrenador. Resume en 3-5 frases para leer en voz alta durante el descanso tras la serie ${setNum} de ${exerciseId}.`,
        "Sé breve, constructivo, en español.",
        "Avisos:",
        ...lines,
      ].join("\n");
  return chatCompletion([{ role: "user", content: prompt }], 220);
}
