/** Web Speech API (STT del navegador). No requiere uvicorn; en Chrome suele usar red del proveedor. */

export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type ListenPreviewFn = (text: string, interim: boolean) => void;

/** Texto acumulado de un evento SpeechRecognition (final + provisional). */
export function mergeRecognitionResults(ev: SpeechRecognitionEvent): {
  text: string;
  interim: boolean;
} {
  let final = "";
  let interim = "";
  for (let i = 0; i < ev.results.length; i++) {
    const r = ev.results[i];
    const t = r[0]?.transcript ?? "";
    if (r.isFinal) final += t;
    else interim += t;
  }
  const text = (final + interim).trim();
  const last = ev.results.length ? ev.results[ev.results.length - 1] : null;
  return { text, interim: Boolean(last && !last.isFinal) };
}

/** Escucha un bloque de `seconds` y devuelve la transcripción acumulada. */
export function listenOnce(
  seconds: number,
  lang = "es-MX",
  onPreview?: ListenPreviewFn,
): Promise<string> {
  const SR = getSpeechRecognitionCtor();
  if (!SR) return Promise.resolve("");

  return new Promise((resolve) => {
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    let text = "";
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      if (text.trim()) onPreview?.(text.trim(), false);
      resolve(text.trim());
    };

    const timer = window.setTimeout(finish, Math.max(1500, seconds * 1000));

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const merged = mergeRecognitionResults(ev);
      if (merged.text) {
        text = merged.text;
        onPreview?.(merged.text, merged.interim);
      }
    };
    rec.onerror = () => finish();
    rec.onend = () => finish();

    onPreview?.("…", true);

    try {
      rec.start();
    } catch {
      finish();
    }
  });
}

export function stripWakePhrase(text: string, wakePhrase: string): string {
  const wn = wakePhrase
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  let tn = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (tn.startsWith(wn)) {
    return text
      .slice(wakePhrase.length)
      .replace(/^[\s,.;:!?¡¿-]+/i, "")
      .trim();
  }
  const idx = tn.indexOf(wn);
  if (idx >= 0) {
    return text
      .slice(idx + wakePhrase.length)
      .replace(/^[\s,.;:!?¡¿-]+/i, "")
      .trim();
  }
  return text.trim();
}
