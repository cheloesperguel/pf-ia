/** Web Speech API con parches para Safari / iOS (requiere gesto del usuario). */

let unlocked = false;
let voicesPrimed = false;
let coachSpeechLocked = false;
const lockListeners = new Set<(locked: boolean) => void>();

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios;
}

export function speechSupported(): boolean {
  return typeof speechSynthesis !== "undefined";
}

export function isCoachSpeechLocked(): boolean {
  return coachSpeechLocked;
}

export function subscribeCoachSpeechLock(
  listener: (locked: boolean) => void,
): () => void {
  lockListeners.add(listener);
  listener(coachSpeechLocked);
  return () => lockListeners.delete(listener);
}

function setCoachSpeechLock(locked: boolean): void {
  if (coachSpeechLocked === locked) return;
  coachSpeechLocked = locked;
  for (const fn of lockListeners) fn(locked);
}

/** Corta la voz del coach (y cualquier TTS) y libera el bloqueo de avisos. */
export function forceStopCoachSpeech(): void {
  setCoachSpeechLock(false);
  if (!speechSupported()) return;
  speechSynthesis.cancel();
}

/** Llamar en el mismo tick que un click/tap (p. ej. al elegir ejercicio). */
export function unlockSpeech(): boolean {
  if (!speechSupported()) return false;
  const synth = speechSynthesis;
  synth.getVoices();
  if (synth.paused) synth.resume();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0.01;
  u.lang = "es-MX";
  u.rate = 1;
  synth.cancel();
  synth.speak(u);
  unlocked = true;
  return true;
}

export function isSpeechUnlocked(): boolean {
  return unlocked;
}

function primeVoices(): void {
  if (!speechSupported() || voicesPrimed) return;
  speechSynthesis.getVoices();
  voicesPrimed = true;
}

if (speechSupported()) {
  primeVoices();
  speechSynthesis.addEventListener("voiceschanged", primeVoices);
}

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  return (
    es.find((v) => v.localService) ??
    es.find((v) => v.lang.toLowerCase().startsWith("es-mx")) ??
    es[0] ??
    null
  );
}

function runUtterance(
  text: string,
  opts: { coach: boolean; onDone?: () => void },
): void {
  const synth = speechSynthesis;
  primeVoices();
  if (synth.paused) synth.resume();

  const start = () => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-MX";
    u.rate = 1;
    const voice = pickSpanishVoice();
    if (voice) u.voice = voice;
    const done = () => {
      if (opts.coach) setCoachSpeechLock(false);
      opts.onDone?.();
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  };

  if (isIosSafari() && synth.getVoices().length === 0) {
    const onVoices = () => {
      speechSynthesis.removeEventListener("voiceschanged", onVoices);
      start();
    };
    speechSynthesis.addEventListener("voiceschanged", onVoices);
    synth.getVoices();
    window.setTimeout(start, 120);
    return;
  }

  start();
}

/** Avisos de forma / setup — no interrumpen ni hablan si el coach IA está hablando. */
export function speakAlertText(text: string): void {
  if (!text || !speechSupported() || coachSpeechLocked) return;
  runUtterance(text, { coach: false });
}

/** Respuesta del coach (GPT, resumen de serie, etc.). Bloquea avisos hasta terminar. */
export function speakCoachText(text: string): void {
  if (!text || !speechSupported()) return;
  setCoachSpeechLock(true);
  runUtterance(text, { coach: true });
}

/** @deprecated Usa speakAlertText o speakCoachText. */
export function speakText(text: string): void {
  speakAlertText(text);
}
