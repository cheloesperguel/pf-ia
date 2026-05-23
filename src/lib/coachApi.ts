import { getActiveLocale, type AppLocale } from "@/i18n/locale";
import {
  openaiAskCoach,
  openaiClassifyReadiness,
  openaiDirectConfigured,
  openaiHealth,
  openaiSummarizeSet,
  openaiTranscribe,
} from "./openaiDirect";

const API_BASE = import.meta.env.VITE_COACH_API_URL ?? "";

export async function pythonApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export type CoachState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "workout_listen"
  | "unavailable";

export type CoachTransport = "openai-direct" | "python-api" | "off";

export function coachTransport(): CoachTransport {
  if (openaiDirectConfigured()) return "openai-direct";
  return "off";
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: string };
    return j.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function coachHealth(): Promise<boolean> {
  if (openaiDirectConfigured()) {
    return openaiHealth();
  }
  return pythonApiHealth();
}

export async function transcribeAudio(
  blob: Blob,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  if (openaiDirectConfigured()) return openaiTranscribe(blob, locale);
  const fd = new FormData();
  const ext =
    blob.type.includes("mp4") || blob.type.includes("aac")
      ? "utterance.m4a"
      : "utterance.webm";
  fd.append("file", blob, ext);
  const res = await fetch(`${API_BASE}/api/coach/transcribe?locale=${locale}`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export async function askCoachQuestion(
  question: string,
  exerciseId: string,
  sessionContext: Record<string, unknown>,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  if (openaiDirectConfigured()) {
    return openaiAskCoach(question, exerciseId, sessionContext, locale);
  }
  const res = await fetch(`${API_BASE}/api/coach/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      exercise_id: exerciseId,
      session_context: sessionContext,
      locale,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { answer?: string };
  return (data.answer ?? "").trim();
}

export async function classifyReadinessApi(
  transcript: string,
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  if (openaiDirectConfigured()) return openaiClassifyReadiness(transcript, locale);
  const res = await fetch(`${API_BASE}/api/coach/classify-readiness`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, locale }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { action?: string };
  return data.action ?? "unclear";
}

export async function summarizeSetApi(
  exerciseId: string,
  setNum: number,
  errors: { rule_id: string; message: string; count: number }[],
  locale: AppLocale = getActiveLocale(),
): Promise<string> {
  if (openaiDirectConfigured()) {
    return openaiSummarizeSet(exerciseId, setNum, errors, locale);
  }
  const res = await fetch(`${API_BASE}/api/coach/summarize-set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exercise_id: exerciseId,
      set_num: setNum,
      errors,
      locale,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export function wakePhraseDetected(
  text: string,
  phrase?: string,
  locale: AppLocale = getActiveLocale(),
): boolean {
  const p = (
    phrase ??
    (locale === "en" ? "hey coach" : "oye entrenador")
  )
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const t = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (p && t.includes(p)) return true;
  if (locale === "en") {
    const words = t.split(/\s+/);
    return words.includes("hey") && words.some((w) => w.startsWith("coach"));
  }
  const words = t.split(/\s+/);
  return words.includes("oye") && words.some((w) => w.startsWith("entrenad"));
}
