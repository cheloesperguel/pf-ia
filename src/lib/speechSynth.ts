/** Web Speech API con parches para Safari / iOS (requiere gesto del usuario). */

let unlocked = false;
let voicesPrimed = false;

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

export function speakText(text: string): void {
  if (!text || !speechSupported()) return;
  const synth = speechSynthesis;
  primeVoices();
  if (synth.paused) synth.resume();

  const run = () => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-MX";
    u.rate = 1;
    const voice = pickSpanishVoice();
    if (voice) u.voice = voice;
    synth.speak(u);
  };

  if (isIosSafari() && synth.getVoices().length === 0) {
    const onVoices = () => {
      speechSynthesis.removeEventListener("voiceschanged", onVoices);
      run();
    };
    speechSynthesis.addEventListener("voiceschanged", onVoices);
    synth.getVoices();
    window.setTimeout(run, 120);
    return;
  }

  run();
}
