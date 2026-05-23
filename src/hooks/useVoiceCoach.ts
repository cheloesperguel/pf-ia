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
import { speechLang, wakePhrase as defaultWakePhrase, type AppLocale } from "@/i18n/locale";
import { translate, type MessageKey } from "@/i18n/messages";
import { classifyReadinessLocal } from "@/lib/workoutGuide";

export type VoiceBackend = "openai" | "api" | "browser" | "none";

export interface VoiceCoachOptions {
  enabled: boolean;
  locale: AppLocale;
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
  wake: string,
  locale: AppLocale,
): string {
  const key: MessageKey =
    backend === "openai"
      ? "voice.statusOpenai"
      : backend === "api"
        ? "voice.statusApi"
        : backend === "browser"
          ? "voice.statusBrowser"
          : "voice.unavailable";
  return translate(locale, key, { wake });
}

export function useVoiceCoach(options: VoiceCoachOptions) {
  const {
    enabled,
    locale,
    showHudStatus = false,
    exerciseId,
    exerciseDisplay,
    wakePhrase = defaultWakePhrase(locale),
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
        setHudStatus(statusLabel(backendRef.current, wakePhrase, locale));
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
      setHudStatus(translate(locale, "voice.coachDisabled"));
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
          ? translate(locale, "voice.openaiRejected")
          : statusLabel(b, wakePhrase, locale);
      if (b !== "none") {
        const mic = await probeMicrophone();
        const hint = formatMicHint(mic, b);
        if (hint) base = `${base}\n${hint}`;
      }
      setHudStatus(base);
    })();
  }, [enabled, locale, setHudStatus, wakePhrase, speechOk]);

  const transcribe = useCallback(
    async (seconds: number): Promise<string> => {
      const useWhisper =
        useOpenaiRef.current || (coachOkRef.current && !speechOk);
      if (useWhisper) {
        setLivePreview(translate(locale, "voice.recording"), true);
        const blob = await captureAudioSeconds(seconds, (left) =>
          setLivePreview(
            left > 0
              ? `${translate(locale, "voice.recording")} ${left}s`
              : translate(locale, "voice.recording"),
            true,
          ),
        );
        if (!blob) return "";
        setLivePreview(translate(locale, "voice.transcribing"), true);
        const text = await transcribeAudio(blob, locale);
        if (text) setLivePreview(text, false);
        return text;
      }
      if (speechOk) return listenOnce(seconds, speechLang(locale), onSttPreview);
      return "";
    },
    [locale, onSttPreview, setLivePreview, speechOk],
  );

  const listenBlocking = useCallback(
    async (seconds: number): Promise<string> => {
      if (backendRef.current === "none") return "";
      listenActiveRef.current = true;
      setState("workout_listen");
      setHudStatus(translate(locale, "voice.listenReady"));
      let heard = "";
      try {
        heard = await transcribe(seconds);
        return heard;
      } catch (e) {
        console.warn("[voiceCoach] listen", e);
        return "";
      } finally {
        setState("idle");
        setHudStatus(statusLabel(backendRef.current, wakePhrase, locale));
        listenActiveRef.current = false;
        lingerPreview(heard);
      }
    },
    [lingerPreview, locale, setHudStatus, transcribe, wakePhrase],
  );

  const answerQuestion = useCallback(
    async (rawQuestion: string) => {
      const question = stripWakePhrase(rawQuestion, wakePhrase);
      if (!question || question.length < 2) {
        onSpeak(translate(locale, "voice.noQuestion"));
        return;
      }
      if (coachOkRef.current && backendRef.current !== "browser") {
        setState("thinking");
        setHudStatus(translate(locale, "voice.thinking"));
        try {
          const answer = await askCoachQuestion(
            question,
            exerciseId,
            getSessionContext(),
            locale,
          );
          if (!answer) {
            onSpeak(translate(locale, "voice.noAnswer"));
            return;
          }
          setState("speaking");
          setHudStatus(translate(locale, "voice.responding"));
          onSpeak(answer);
        } catch (e) {
          console.warn("[voiceCoach] ask", e);
          onSpeak(
            e instanceof Error ? e.message : translate(locale, "voice.openaiError"),
          );
        }
      } else {
        setState("speaking");
        onSpeak(localCoachReply(question, exerciseDisplay, locale));
      }
    },
    [exerciseDisplay, exerciseId, getSessionContext, locale, onSpeak, wakePhrase],
  );

  const listenAndAnswer = useCallback(async () => {
    listenActiveRef.current = true;
    setState("listening");
    setHudStatus(translate(locale, "voice.listening"));
    let text = "";
    try {
      text = await transcribe(recordSeconds);
    } finally {
      listenActiveRef.current = false;
    }
    if (!text) {
      onSpeak(translate(locale, "voice.nothingHeard"));
      setState("idle");
      setHudStatus(statusLabel(backendRef.current, wakePhrase, locale));
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
      setHudStatus(statusLabel(backendRef.current, wakePhrase, locale));
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
    rec.lang = speechLang(locale);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      if (busyRef.current || listenActiveRef.current) return;
      const merged = mergeRecognitionResults(ev);
      if (merged.text) setLivePreview(merged.text, merged.interim);
      if (merged.text && wakePhraseDetected(merged.text, wakePhrase, locale)) {
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
    locale,
  ]);

  const classifyFn = useCallback(
    async (transcript: string): Promise<"ready" | "more_rest" | "unclear"> => {
      const local = classifyReadinessLocal(transcript, locale);
      if (local !== "unclear") return local;
      if (!coachOkRef.current || !transcript.trim()) return "unclear";
      try {
        const raw = await classifyReadinessApi(transcript, locale);
        if (raw === "ready" || raw === "more_rest" || raw === "unclear") {
          return raw;
        }
      } catch {
        /* noop */
      }
      return "unclear";
    },
    [locale],
  );

  const abortCoachSpeech = useCallback(() => {
    forceStopCoachSpeech();
    if (stateRef.current === "speaking") {
      setState("idle");
      setHudStatus(statusLabel(backendRef.current, wakePhrase, locale));
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
