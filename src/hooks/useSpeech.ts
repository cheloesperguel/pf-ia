import { useCallback, useEffect, useState } from "react";
import {
  forceStopCoachSpeech,
  isIosSafari,
  isSpeechUnlocked,
  speakAlertText,
  speakCoachText,
  speechSupported,
  subscribeCoachSpeechLock,
  unlockSpeech as unlockSpeechSynth,
} from "@/lib/speechSynth";

export function useSpeech(enabled: boolean) {
  const [voiceReady, setVoiceReady] = useState(
    () => !isIosSafari() || isSpeechUnlocked(),
  );
  const [coachSpeaking, setCoachSpeaking] = useState(false);

  useEffect(() => {
    if (isSpeechUnlocked()) setVoiceReady(true);
  }, []);

  useEffect(() => subscribeCoachSpeechLock(setCoachSpeaking), []);

  const unlockSpeech = useCallback(() => {
    if (unlockSpeechSynth()) setVoiceReady(true);
  }, []);

  const speakAlert = useCallback(
    (text: string) => {
      if (!enabled || !text || !speechSupported()) return;
      if (isIosSafari() && !voiceReady) {
        console.warn(
          "[tts] iOS: pulsa «Activar voz» para oír los avisos del entrenador.",
        );
        return;
      }
      speakAlertText(text);
    },
    [enabled, voiceReady],
  );

  const speakCoach = useCallback(
    (text: string) => {
      if (!enabled || !text || !speechSupported()) return;
      if (isIosSafari() && !voiceReady) {
        console.warn("[tts] iOS: activa voz antes de escuchar al coach.");
        return;
      }
      speakCoachText(text);
    },
    [enabled, voiceReady],
  );

  const stopCoachSpeech = useCallback(() => {
    forceStopCoachSpeech();
  }, []);

  const needsUnlock = enabled && isIosSafari() && !voiceReady;

  return {
    speakAlert,
    speakCoach,
    /** Alias de speakAlert (avisos de ejercicio). */
    speak: speakAlert,
    stopCoachSpeech,
    coachSpeaking,
    unlockSpeech,
    needsUnlock,
  };
}
