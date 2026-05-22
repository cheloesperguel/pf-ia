import { useCallback, useRef } from "react";

export function useSpeech(enabled: boolean) {
  const speakingRef = useRef(false);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text || typeof speechSynthesis === "undefined") {
        return;
      }
      if (speakingRef.current) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-MX";
      u.rate = 1;
      speakingRef.current = true;
      u.onend = () => {
        speakingRef.current = false;
      };
      u.onerror = () => {
        speakingRef.current = false;
      };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    },
    [enabled],
  );

  return { speak };
}
