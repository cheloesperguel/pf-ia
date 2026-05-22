import { useCallback, useEffect, useRef, useState } from "react";
import {
  askCoachQuestion,
  classifyReadinessApi,
  pythonApiHealth,
  transcribeAudio,
  wakePhraseDetected,
  type CoachState,
} from "@/lib/coachApi";
import { formatMicHint, probeMicrophone } from "@/lib/micProbe";
import { openaiDirectConfigured, openaiHealth } from "@/lib/openaiDirect";
import {
  forceStopCoachSpeech,
  subscribeCoachSpeechLock,
} from "@/lib/speechSynth";
import { localCoachReply } from "@/lib/localCoachReply";
import {
  listenOnce,
  mergeRecognitionResults,
  speechRecognitionSupported,
  stripWakePhrase,
  type ListenPreviewFn,
} from "@/lib/webSpeech";
import { classifyReadinessLocal } from "@/lib/workoutGuide";

export type VoiceBackend = "openai" | "api" | "browser" | "none";

export interface VoiceCoachOptions {
  enabled: boolean;
  /** Muestra en HUD «OpenAI directo», micrófono y «Oído:». Por defecto false. */
  showHudStatus?: boolean;
  exerciseId: string;
  exerciseDisplay: string;
  wakePhrase?: string;
  recordSeconds?: number;
  getSessionContext: () => Record<string, unknown>;
  onSpeak: (text: string) => void;
  executionActive: boolean;
}

function pickRecorderMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

async function captureAudioSeconds(
  seconds: number,
  onTick?: (secondsLeft: number) => void,
): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickRecorderMime();
  const rec = mime
    ? new MediaRecorder(stream, { mimeType: mime })
    : new MediaRecorder(stream);
  const outType = mime || rec.mimeType || "audio/mp4";
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const totalMs = Math.max(1500, seconds * 1000);
  return new Promise((resolve) => {
    const started = Date.now();
    onTick?.(Math.ceil(totalMs / 1000));
    const tickIv = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((totalMs - (Date.now() - started)) / 1000));
      onTick?.(left);
    }, 400);
    rec.onstop = () => {
      window.clearInterval(tickIv);
      stream.getTracks().forEach((t) => t.stop());
      resolve(chunks.length ? new Blob(chunks, { type: outType }) : null);
    };
    rec.start(200);
    setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, totalMs);
  });
}

export interface HearPreview {
  text: string;
  interim: boolean;
}

const PREVIEW_LINGER_MS = 4500;

function statusLabel(
  backend: VoiceBackend,
  wakePhrase: string,
): string {
  if (backend === "openai") {
    return `OpenAI directo · Di «${wakePhrase}» o Preguntar`;
  }
  if (backend === "api") {
    return `Coach API (Python) · Di «${wakePhrase}» o Preguntar`;
  }
  if (backend === "browser") {
    return `Solo voz navegador (sin OpenAI) · «${wakePhrase}»`;
  }
  return "Voz no disponible.";
}

export function useVoiceCoach(options: VoiceCoachOptions) {
  const {
    enabled,
    showHudStatus = false,
    exerciseId,
    exerciseDisplay,
    wakePhrase = "oye entrenador",
    recordSeconds = 5,
    getSessionContext,
    onSpeak,
    executionActive,
  } = options;

  const [coachOk, setCoachOk] = useState(false);
  const [speechOk] = useState(() => speechRecognitionSupported());
  const [backend, setBackend] = useState<VoiceBackend>("none");
  const [state, setState] = useState<CoachState>("unavailable");
  const [status, setStatus] = useState("");
  const [hearPreview, setHearPreview] = useState<HearPreview | null>(null);
  const busyRef = useRef(false);
  const listenActiveRef = useRef(false);
  const previewLingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const backendRef = useRef<VoiceBackend>("none");
  const coachOkRef = useRef(false);
  const useOpenaiRef = useRef(false);
  const showHudRef = useRef(showHudStatus);
  const stateRef = useRef<CoachState>("unavailable");

  useEffect(() => {
    backendRef.current = backend;
    coachOkRef.current = coachOk;
    useOpenaiRef.current = openaiDirectConfigured();
    showHudRef.current = showHudStatus;
    stateRef.current = state;
  }, [backend, coachOk, showHudStatus, state]);

  const setHudStatus = useCallback((msg: string) => {
    setStatus(showHudRef.current ? msg : "");
  }, []);

  useEffect(() => {
    return subscribeCoachSpeechLock((locked) => {
      if (!locked && stateRef.current === "speaking") {
        setState("idle");
        setHudStatus(statusLabel(backendRef.current, wakePhrase));
      }
    });
  }, [setHudStatus, wakePhrase]);

  const clearPreviewLinger = useCallback(() => {
    if (previewLingerRef.current) {
      window.clearTimeout(previewLingerRef.current);
      previewLingerRef.current = null;
    }
  }, []);

  const setLivePreview = useCallback(
    (text: string, interim: boolean) => {
      if (!showHudRef.current) return;
      clearPreviewLinger();
      setHearPreview({ text, interim });
    },
    [clearPreviewLinger],
  );

  const lingerPreview = useCallback(
    (text: string) => {
      if (!showHudRef.current) return;
      clearPreviewLinger();
      if (!text.trim()) {
        setHearPreview(null);
        return;
      }
      setHearPreview({ text: text.trim(), interim: false });
      previewLingerRef.current = window.setTimeout(() => {
        setHearPreview(null);
        previewLingerRef.current = null;
      }, PREVIEW_LINGER_MS);
    },
    [clearPreviewLinger],
  );

  const onSttPreview: ListenPreviewFn = useCallback(
    (text, interim) => setLivePreview(text, interim),
    [setLivePreview],
  );

  useEffect(() => () => clearPreviewLinger(), [clearPreviewLinger]);

  useEffect(() => {
    if (!enabled) {
      setBackend("none");
      setCoachOk(false);
      setState("unavailable");
      setHudStatus("Coach desactivado en JSON");
      return;
    }
    void (async () => {
      let b: VoiceBackend = "none";
      let gptOk = false;
      if (openaiDirectConfigured() && (await openaiHealth())) {
        b = "openai";
        gptOk = true;
      } else if (!openaiDirectConfigured() && (await pythonApiHealth())) {
        b = "api";
        gptOk = true;
      } else if (speechOk) {
        b = "browser";
      }
      setCoachOk(gptOk);
      setBackend(b);
      setState(b === "none" ? "unavailable" : "idle");
      if (!showHudRef.current) {
        setHudStatus("");
        return;
      }
      let base =
        openaiDirectConfigured() && !gptOk
          ? "Clave OpenAI rechazada. Revisa VITE_OPENAI_API_KEY en web/.env y reinicia npm run dev"
          : statusLabel(b, wakePhrase);
      if (b !== "none") {
        const mic = await probeMicrophone();
        const hint = formatMicHint(mic, b);
        if (hint) base = `${base}\n${hint}`;
      }
      setHudStatus(base);
    })();
  }, [enabled, setHudStatus, wakePhrase, speechOk]);

  const transcribe = useCallback(
    async (seconds: number): Promise<string> => {
      const useWhisper =
        useOpenaiRef.current || (coachOkRef.current && !speechOk);
      if (useWhisper) {
        setLivePreview("● Grabando…", true);
        const blob = await captureAudioSeconds(seconds, (left) =>
          setLivePreview(left > 0 ? `● Grabando… ${left}s` : "● Grabando…", true),
        );
        if (!blob) return "";
        setLivePreview("Transcribiendo…", true);
        const text = await transcribeAudio(blob);
        if (text) setLivePreview(text, false);
        return text;
      }
      if (speechOk) return listenOnce(seconds, "es-MX", onSttPreview);
      return "";
    },
    [onSttPreview, setLivePreview, speechOk],
  );

  const listenBlocking = useCallback(
    async (seconds: number): Promise<string> => {
      if (backendRef.current === "none") return "";
      listenActiveRef.current = true;
      setState("workout_listen");
      setHudStatus("Di listo o pide otro minuto…");
      let heard = "";
      try {
        heard = await transcribe(seconds);
        return heard;
      } catch (e) {
        console.warn("[voiceCoach] listen", e);
        return "";
      } finally {
        setState("idle");
        setHudStatus(statusLabel(backendRef.current, wakePhrase));
        listenActiveRef.current = false;
        lingerPreview(heard);
      }
    },
    [lingerPreview, setHudStatus, transcribe, wakePhrase],
  );

  const answerQuestion = useCallback(
    async (rawQuestion: string) => {
      const question = stripWakePhrase(rawQuestion, wakePhrase);
      if (!question || question.length < 2) {
        onSpeak("No entendí la pregunta. Intenta de nuevo.");
        return;
      }
      if (coachOkRef.current && backendRef.current !== "browser") {
        setState("thinking");
        setHudStatus("Pensando respuesta…");
        try {
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
          setHudStatus("Respondiendo…");
          onSpeak(answer);
        } catch (e) {
          console.warn("[voiceCoach] ask", e);
          onSpeak(
            e instanceof Error ? e.message : "Error al consultar OpenAI.",
          );
        }
      } else {
        setState("speaking");
        onSpeak(localCoachReply(question, exerciseDisplay));
      }
    },
    [exerciseDisplay, exerciseId, getSessionContext, onSpeak, wakePhrase],
  );

  const listenAndAnswer = useCallback(async () => {
    listenActiveRef.current = true;
    setState("listening");
    setHudStatus("Escuchando tu pregunta…");
    let text = "";
    try {
      text = await transcribe(recordSeconds);
    } finally {
      listenActiveRef.current = false;
    }
    if (!text) {
      onSpeak("No escuché nada. Comprueba permiso de micrófono.");
      setState("idle");
      setHudStatus(statusLabel(backendRef.current, wakePhrase));
      setHearPreview(null);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await answerQuestion(text);
    } finally {
      busyRef.current = false;
      setState("idle");
      setHudStatus(statusLabel(backendRef.current, wakePhrase));
      lingerPreview(text);
    }
  }, [
    answerQuestion,
    lingerPreview,
    onSpeak,
    recordSeconds,
    setHudStatus,
    transcribe,
    wakePhrase,
  ]);

  const askByButton = useCallback(async () => {
    if (backendRef.current === "none" || !executionActive) return;
    await listenAndAnswer();
  }, [executionActive, listenAndAnswer]);

  useEffect(() => {
    const active =
      enabled &&
      executionActive &&
      (backend === "openai" || backend === "api" || backend === "browser");
    if (!active || !speechOk) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
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
      if (busyRef.current || listenActiveRef.current) return;
      const merged = mergeRecognitionResults(ev);
      if (merged.text) setLivePreview(merged.text, merged.interim);
      if (merged.text && wakePhraseDetected(merged.text, wakePhrase)) {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
        void listenAndAnswer();
      }
    };
    rec.onerror = () => {};
    try {
      rec.start();
    } catch {
      /* Safari */
    }
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [
    backend,
    enabled,
    executionActive,
    listenAndAnswer,
    setLivePreview,
    speechOk,
    wakePhrase,
  ]);

  const classifyFn = useCallback(
    async (transcript: string): Promise<"ready" | "more_rest" | "unclear"> => {
      const local = classifyReadinessLocal(transcript);
      if (local !== "unclear") return local;
      if (!coachOkRef.current || !transcript.trim()) return "unclear";
      try {
        const raw = await classifyReadinessApi(transcript);
        if (raw === "ready" || raw === "more_rest" || raw === "unclear") {
          return raw;
        }
      } catch {
        /* noop */
      }
      return "unclear";
    },
    [],
  );

  const abortCoachSpeech = useCallback(() => {
    forceStopCoachSpeech();
    if (stateRef.current === "speaking") {
      setState("idle");
      setHudStatus(statusLabel(backendRef.current, wakePhrase));
    }
  }, [setHudStatus, wakePhrase]);

  const voiceAvailable = backend !== "none";

  return {
    apiOk: coachOk && backend === "api",
    openaiOk: coachOk && backend === "openai",
    speechOk,
    backend,
    voiceAvailable,
    state,
    status,
    hearPreview,
    listenBlocking,
    askByButton,
    abortCoachSpeech,
    classifyFn,
  };
}
