import { useCallback, useEffect, useRef, useState } from "react";
import {
  askCoachQuestion,
  classifyReadinessApi,
  coachHealth,
  transcribeAudio,
  wakePhraseDetected,
  type CoachState,
} from "@/lib/coachApi";

export interface VoiceCoachOptions {
  enabled: boolean;
  exerciseId: string;
  exerciseDisplay: string;
  wakePhrase?: string;
  recordSeconds?: number;
  getSessionContext: () => Record<string, unknown>;
  onSpeak: (text: string) => void;
  executionActive: boolean;
}

async function captureAudioSeconds(seconds: number): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  return new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(chunks.length ? new Blob(chunks, { type: mime }) : null);
    };
    rec.start(200);
    setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, seconds * 1000);
  });
}

export function useVoiceCoach(options: VoiceCoachOptions) {
  const {
    enabled,
    exerciseId,
    wakePhrase = "oye entrenador",
    recordSeconds = 5,
    getSessionContext,
    onSpeak,
    executionActive,
  } = options;

  const [apiOk, setApiOk] = useState(false);
  const [state, setState] = useState<CoachState>("unavailable");
  const [status, setStatus] = useState("");
  const busyRef = useRef(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState("unavailable");
      setStatus("Coach desactivado en JSON");
      return;
    }
    void coachHealth().then((ok) => {
      setApiOk(ok);
      setState(ok ? "idle" : "unavailable");
      setStatus(
        ok
          ? `Di «${wakePhrase}» o usa el botón Preguntar`
          : "API coach no disponible (inicia api/main.py)",
      );
    });
  }, [enabled, wakePhrase]);

  const listenBlocking = useCallback(
    async (seconds: number): Promise<string> => {
      if (!apiOk) return "";
      setState("workout_listen");
      setStatus("Di listo o pide otro minuto…");
      try {
        const blob = await captureAudioSeconds(seconds);
        if (!blob) return "";
        return await transcribeAudio(blob);
      } catch (e) {
        console.warn("[voiceCoach] listen", e);
        return "";
      } finally {
        setState("idle");
        setStatus(`Di «${wakePhrase}» o usa el botón Preguntar`);
      }
    },
    [apiOk, wakePhrase],
  );

  const processQuestion = useCallback(
    async (blob: Blob) => {
      if (!apiOk || busyRef.current) return;
      busyRef.current = true;
      setState("thinking");
      setStatus("Pensando respuesta…");
      try {
        let question = await transcribeAudio(blob);
        const wn = wakePhrase
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase();
        const tn = question
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase();
        if (tn.startsWith(wn)) {
          question = question.slice(wakePhrase.length).replace(/^[\s,.;:!?¡¿-]+/, "");
        }
        if (!question || question.length < 3) {
          onSpeak("No entendí la pregunta. Intenta de nuevo.");
          return;
        }
        const answer = await askCoachQuestion(
          question,
          exerciseId,
          getSessionContext(),
        );
        if (!answer) {
          onSpeak("No pude generar una respuesta.");
          return;
        }
        setState("speaking");
        setStatus("Respondiendo…");
        onSpeak(answer);
      } catch (e) {
        console.warn("[voiceCoach] ask", e);
        onSpeak("Hubo un error con el coach. ¿Está la API en marcha?");
      } finally {
        busyRef.current = false;
        setState("idle");
        setStatus(`Di «${wakePhrase}» o usa el botón Preguntar`);
      }
    },
    [apiOk, exerciseId, getSessionContext, onSpeak, wakePhrase],
  );

  const askByButton = useCallback(async () => {
    if (!apiOk || !executionActive) return;
    setState("listening");
    setStatus("Escuchando tu pregunta…");
    const blob = await captureAudioSeconds(recordSeconds);
    if (blob) await processQuestion(blob);
    else {
      setState("idle");
      setStatus(`Di «${wakePhrase}» o usa el botón Preguntar`);
    }
  }, [apiOk, executionActive, processQuestion, recordSeconds, wakePhrase]);

  useEffect(() => {
    if (!enabled || !apiOk || !executionActive) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "es-MX";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      if (busyRef.current) return;
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      if (text && wakePhraseDetected(text, wakePhrase)) {
        rec.stop();
        void (async () => {
          setState("listening");
          setStatus("Escuchando…");
          const blob = await captureAudioSeconds(recordSeconds);
          if (blob) await processQuestion(blob);
        })();
      }
    };
    rec.onerror = () => {};
    try {
      rec.start();
    } catch {
      /* Safari / permisos */
    }
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [enabled, apiOk, executionActive, processQuestion, recordSeconds, wakePhrase]);

  const classifyFn = useCallback(
    async (transcript: string): Promise<"ready" | "more_rest" | "unclear"> => {
      const raw = await classifyReadinessApi(transcript);
      if (raw === "ready" || raw === "more_rest" || raw === "unclear") return raw;
      return "unclear";
    },
    [],
  );

  return {
    apiOk,
    state,
    status,
    listenBlocking,
    askByButton,
    classifyFn,
  };
}

