const API_BASE = import.meta.env.VITE_COACH_API_URL ?? "";

export type CoachState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "workout_listen"
  | "unavailable";

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: string };
    return j.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function coachHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const fd = new FormData();
  const ext =
    blob.type.includes("mp4") || blob.type.includes("aac")
      ? "utterance.m4a"
      : "utterance.webm";
  fd.append("file", blob, ext);
  const res = await fetch(`${API_BASE}/api/coach/transcribe`, {
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
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/coach/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      exercise_id: exerciseId,
      session_context: sessionContext,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { answer?: string };
  return (data.answer ?? "").trim();
}

export async function classifyReadinessApi(transcript: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/coach/classify-readiness`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { action?: string };
  return data.action ?? "unclear";
}

export async function summarizeSetApi(
  exerciseId: string,
  setNum: number,
  errors: { rule_id: string; message: string; count: number }[],
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/coach/summarize-set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exercise_id: exerciseId,
      set_num: setNum,
      errors,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export function wakePhraseDetected(text: string, phrase = "oye entrenador"): boolean {
  const t = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const p = phrase
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (p && t.includes(p)) return true;
  const words = t.split(/\s+/);
  return words.includes("oye") && words.some((w) => w.startsWith("entrenad"));
}
