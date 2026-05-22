import { useCallback, useEffect, useState } from "react";
import {
  isIosSafari,
  isSpeechUnlocked,
  speakText,
  speechSupported,
  unlockSpeech as unlockSpeechSynth,
} from "@/lib/speechSynth";

export function useSpeech(enabled: boolean) {
  const [voiceReady, setVoiceReady] = useState(
    () => !isIosSafari() || isSpeechUnlocked(),
  );

  useEffect(() => {
    if (isSpeechUnlocked()) setVoiceReady(true);
  }, []);

  const unlockSpeech = useCallback(() => {
    if (unlockSpeechSynth()) setVoiceReady(true);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text || !speechSupported()) return;
      if (isIosSafari() && !voiceReady) {
        console.warn(
          "[tts] iOS: pulsa «Activar voz» para oír los avisos del entrenador.",
        );
        return;
      }
      speakText(text);
    },
    [enabled, voiceReady],
  );

  const needsUnlock = enabled && isIosSafari() && !voiceReady;

  return { speak, unlockSpeech, needsUnlock };
}
