import { useCallback, useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { SessionHud } from "@/components/SessionHud";
import { useCamera } from "@/hooks/useCamera";
import {
  useExerciseSession,
  type SessionHudState,
} from "@/hooks/useExerciseSession";
import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
import { useSpeech } from "@/hooks/useSpeech";
import { useVoiceCoach } from "@/hooks/useVoiceCoach";
import { setupHoldMs, setupPositionLabel } from "@/lib/exerciseSetup";
import { speakText } from "@/lib/speechSynth";
import { loadExercise } from "@/lib/loadConfig";
import { loadWorkoutProgram } from "@/lib/loadWorkout";
import { coachHealth, summarizeSetApi } from "@/lib/coachApi";
import {
  loadPoseSettingsBundle,
  resolvePoseModel,
  type LandmarkerOptions,
  type PoseSettingsBundle,
} from "@/lib/settingsPose";
import {
  drawPoseStatusBanner,
  drawSessionVisuals,
} from "@/lib/sessionVisuals";
import { CalibrationRuleBanner } from "@/components/CalibrationRuleBanner";
import { WebCalibrationPanel } from "@/components/WebCalibrationPanel";
import {
  CALIBRATION_DEFAULT_SOLO,
  getCalibrationFocusInfo,
  pressCalibrationSliders,
  setSoloRule,
} from "@/lib/liveLimits";
import { WorkoutGuide } from "@/lib/workoutGuide";

interface SessionViewProps {
  exerciseId: string;
  onBack: () => void;
}

const EMPTY_HUD: SessionHudState = {
  phase: "setup",
  displayName: "",
  positionLabel: "",
  repCount: 0,
  phaseAngle: NaN,
  angleLabel: "Ángulo",
  metrics: {},
  alerts: [],
  alertOverflow: null,
  setupFailures: [],
  holdProgress: 0,
  holdMs: 1500,
  rejectFlash: false,
  rejectMessages: [],
  viewOk: false,
  trackingOk: false,
  noPose: true,
  workout: null,
  coachStatus: "",
};

export function SessionView({ exerciseId, onBack }: SessionViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workoutRef = useRef<WorkoutGuide | null>(null);
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [poseBundle, setPoseBundle] = useState<PoseSettingsBundle | null>(null);
  const [landmarkerOpts, setLandmarkerOpts] = useState<LandmarkerOptions | null>(
    null,
  );
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [hud, setHud] = useState<SessionHudState>(EMPTY_HUD);
  const [coachStatus, setCoachStatus] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [calSoloIndex, setCalSoloIndex] = useState<number | null>(
    CALIBRATION_DEFAULT_SOLO,
  );
  const [calSliderKey, setCalSliderKey] = useState<string | null>(null);
  const [cfgRevision, setCfgRevision] = useState(0);

  const bumpCfg = useCallback(() => {
    setCfgRevision((n) => n + 1);
    setCfg((c) => (c ? { ...c } : c));
  }, []);

  const ttsCfg = (cfg?.tts ?? {}) as Record<string, unknown>;
  const ttsOn = Boolean(ttsCfg.enabled !== false);
  const vcCfg = (cfg?.voice_coach ?? {}) as Record<string, unknown>;
  const voiceCoachOn = Boolean(vcCfg.enabled !== false);
  const displayName =
    (cfg?.display_name as string) || exerciseId.replace(/_/g, " ");

  const { speakAlert, speakCoach, stopCoachSpeech, coachSpeaking, unlockSpeech, needsUnlock } =
    useSpeech(ttsOn);

  const getSessionContext = useCallback(() => {
    const w = workoutRef.current;
    const entrenamiento: Record<string, unknown> = {};
    if (w) {
      entrenamiento.programa = w.prog.displayName;
      entrenamiento.serie_actual = w.currentSet;
      entrenamiento.series_total = w.prog.sets;
      entrenamiento.reps_serie = w.repsInSet;
      entrenamiento.reps_meta_serie = w.prog.repsPerSet;
      entrenamiento.fase_entrenamiento = w.phase;
    }
    return {
      ejercicio: displayName,
      fase: hud.phase,
      repeticiones_validas: hud.repCount,
      alertas_activas: hud.alerts,
      entrenamiento,
    };
  }, [displayName, hud.phase, hud.repCount, hud.alerts]);

  const voice = useVoiceCoach({
    enabled: voiceCoachOn,
    exerciseId,
    exerciseDisplay: displayName,
    recordSeconds: Number(vcCfg.record_seconds ?? 5),
    getSessionContext,
    onSpeak: speakCoach,
    executionActive: calOpen || hud.phase === "execution",
  });

  const listenBlockingRef = useRef(voice.listenBlocking);
  const classifyFnRef = useRef(voice.classifyFn);
  listenBlockingRef.current = voice.listenBlocking;
  classifyFnRef.current = voice.classifyFn;

  const { processFrame, skipSetup } = useExerciseSession(cfg, poseBundle, {
    ttsEnabled: ttsOn && !calOpen,
    onSpeak: speakAlert,
    workoutRef,
    coachStatus: voice.status || coachStatus,
    cfgRevision,
  });

  const calFocus =
    calOpen && cfg
      ? getCalibrationFocusInfo(cfg, {
          soloIndex: calSoloIndex,
          sliderKey: calSliderKey ?? undefined,
        })
      : null;

  const enterCalibration = useCallback(() => {
    if (!cfg) return;
    skipSetup();
    setHud((prev) => ({ ...prev, phase: "execution" }));
    setCalSoloIndex(CALIBRATION_DEFAULT_SOLO);
    setCalSliderKey("exec_scap");
    setSoloRule(cfg, "elbows_scapular_plane");
    setCfgRevision((n) => n + 1);
    setCfg((c) => (c ? { ...c } : c));
    setCalOpen(true);
  }, [cfg, skipSetup]);

  const exitCalibration = useCallback(() => {
    if (cfg) {
      setSoloRule(cfg, null);
      setCfgRevision((n) => n + 1);
      setCfg((c) => (c ? { ...c } : c));
    }
    setCalOpen(false);
    setCalSoloIndex(null);
    setCalSliderKey(null);
  }, [cfg]);

  const { videoRef, getVideo, ready: camReady, error: camError, mirror } =
    useCamera({
      facingMode: "user",
      mirror: true,
    });

  const {
    detectForVideo,
    loading: poseLoading,
    error: poseError,
    ready: poseReady,
  } = usePoseLandmarker(landmarkerOpts);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [exercise, bundle] = await Promise.all([
          loadExercise(exerciseId),
          loadPoseSettingsBundle(),
        ]);
        if (cancelled) return;
        const model = resolvePoseModel(exercise, bundle.landmarker, true);
        setCfg(exercise);
        setPoseBundle(bundle);
        setLandmarkerOpts({ ...bundle.landmarker, poseModel: model });
        setLoadErr(null);

        const prog = await loadWorkoutProgram(exercise);
        if (cancelled) return;
        if (prog && ttsOn) {
          workoutRef.current = new WorkoutGuide(prog, {
            onSpeak: speakAlert,
            onSpeakCoach: speakCoach,
            onListen: (sec) => listenBlockingRef.current(sec),
            onSummarize: async (errs, setNum) => {
              if (await coachHealth()) {
                return summarizeSetApi(
                  exerciseId,
                  setNum,
                  errs.map((e) => ({
                    rule_id: e.ruleId,
                    message: e.message,
                    count: e.count,
                  })),
                );
              }
              if (!errs.length) {
                return `Serie ${setNum} bien. Sigue así.`;
              }
              return `Serie ${setNum} terminada. Revisa: ${errs[0].message}`;
            },
            onStatus: setCoachStatus,
            classifyFn: (t) => classifyFnRef.current(t),
          });
        } else {
          workoutRef.current = null;
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(
            e instanceof Error ? e.message : "Error cargando configuración",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      workoutRef.current = null;
    };
  }, [exerciseId, speakAlert, speakCoach, ttsOn]);

  useEffect(() => {
    if (!cfg) return;
    setHud((prev) => ({
      ...prev,
      displayName:
        (cfg.display_name as string) || exerciseId.replace(/_/g, " "),
      positionLabel: setupPositionLabel(cfg),
      holdMs: setupHoldMs(cfg),
      angleLabel: String(
        ((cfg.hud ?? {}) as Record<string, unknown>).angle_label ?? "Ángulo",
      ),
    }));
  }, [cfg, exerciseId]);

  const lastHudPush = useRef(0);

  const pushHud = useCallback(
    (state: SessionHudState) => {
      const now = performance.now();
      if (now - lastHudPush.current < 80) return;
      lastHudPush.current = now;
      setHud({ ...state, coachStatus: voice.status || coachStatus });
    },
    [coachStatus, voice.status],
  );

  const drawLoop = useCallback(() => {
    const el = getVideo();
    const canvas = canvasRef.current;
    if (!el || !canvas || !camReady) return;

    const w = el.videoWidth;
    const h = el.videoHeight;
    if (w < 2 || h < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    if (mirror) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(el, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(el, 0, 0, w, h);
    }

    const ts = performance.now();

    if (!poseReady || poseLoading) {
      const msg = poseLoading
        ? "Cargando modelo de pose…"
        : poseError
          ? "Pose no disponible"
          : "Iniciando detección…";
      drawPoseStatusBanner(ctx, w, h, msg);
      return;
    }

    if (!cfg) return;

    const result = detectForVideo(el, ts);
    const norm = result?.landmarks?.[0];
    const world = result?.worldLandmarks?.[0];

    if (norm?.length) {
      const utils = new DrawingUtils(ctx);
      if (mirror) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      utils.drawConnectors(
        norm as NormalizedLandmark[],
        PoseLandmarker.POSE_CONNECTIONS,
        { color: "#5eead4", lineWidth: 4 },
      );
      utils.drawLandmarks(norm as NormalizedLandmark[], {
        color: "#fbbf24",
        lineWidth: 2,
        radius: 5,
      });
      if (mirror) ctx.restore();

      const state = processFrame(norm, world, ts);
      drawSessionVisuals(ctx, w, h, mirror, norm, {
        cfg,
        phase: state.phase,
        phaseAngle: state.phaseAngle,
        angleLabel: state.angleLabel,
        metrics: state.metrics,
        tSec: ts / 1000,
      });

      pushHud(state);
    } else {
      drawPoseStatusBanner(ctx, w, h, "Colócate de frente a la cámara");
      const state = processFrame(undefined, undefined, ts);
      pushHud(state);
    }
  }, [
    camReady,
    cfg,
    coachStatus,
    detectForVideo,
    getVideo,
    mirror,
    poseLoading,
    poseError,
    poseReady,
    processFrame,
    pushHud,
    voice.status,
  ]);

  useEffect(() => {
    if (!camReady) return;

    let raf = 0;
    let frames = 0;
    let lastFps = performance.now();

    const tick = () => {
      drawLoop();
      frames++;
      const now = performance.now();
      if (now - lastFps >= 1000) {
        setFps(frames);
        frames = 0;
        lastFps = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [camReady, drawLoop]);

  const busy = poseLoading || !landmarkerOpts || !cfg;
  const hudLoadingMessage = busy
    ? poseLoading
      ? "Cargando modelo de pose…"
      : "Cargando ejercicio…"
    : null;
  const status = loadErr || camError || poseError;

  const handleSkipSetup = () => {
    skipSetup();
    setHud((prev) => ({ ...prev, phase: "execution" }));
  };

  useEffect(() => {
    if (calOpen && cfg && hud.phase === "setup") {
      skipSetup();
      setHud((prev) => ({ ...prev, phase: "execution" }));
    }
  }, [calOpen, cfg, hud.phase, skipSetup]);

  return (
    <div className="session">
      <header className="session-bar">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Volver
        </button>
        <h2>{displayName}</h2>
        <span className="session-meta">
          {busy ? "Cargando…" : `${fps} fps · ${hud.repCount} reps`}
        </span>
        {cfg && (
          <button
            type="button"
            className={`btn-cal-toggle${calOpen ? " active" : ""}`}
            onClick={() => (calOpen ? exitCalibration() : enterCalibration())}
          >
            {calOpen ? "Salir cal." : "Calibrar"}
          </button>
        )}
      </header>

      {status && <p className="session-error">{status}</p>}

      {needsUnlock && (
        <p className="session-voice-hint">
          En iPhone la voz requiere un toque.{" "}
          <button
            type="button"
            className="btn-voice-unlock"
            onClick={() => {
              unlockSpeech();
              speakText("Voz activada. Puedes entrenar.");
            }}
          >
            Activar voz
          </button>
        </p>
      )}

      <div
        className="session-stage"
        onPointerDown={() => {
          if (needsUnlock) unlockSpeech();
        }}
      >
        <video
          ref={videoRef}
          className="session-video"
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="session-canvas" />
        {calOpen && <CalibrationRuleBanner focus={calFocus} />}
        <SessionHud
          hud={hud}
          calibrationMode={calOpen}
          loadingMessage={hudLoadingMessage}
          onSkipSetup={calOpen ? undefined : handleSkipSetup}
          onAskCoach={
            calOpen || !voice.voiceAvailable ? undefined : voice.askByButton
          }
          coachStatus={voice.status || coachStatus}
          hearPreview={voice.hearPreview}
          coachSpeaking={coachSpeaking || voice.state === "speaking"}
          onStopCoachSpeech={() => {
            stopCoachSpeech();
            voice.abortCoachSpeech();
          }}
        />
        {calOpen && cfg && (
          <WebCalibrationPanel
            exerciseId={exerciseId}
            cfg={cfg}
            metrics={hud.metrics}
            soloIndex={calSoloIndex}
            onSoloChange={(n) => {
              setCalSoloIndex(n);
              if (n == null) {
                setCalSliderKey(null);
                return;
              }
              const sl = pressCalibrationSliders(cfg).find(
                (s) => s.soloIndex === n,
              );
              if (sl) setCalSliderKey(sl.key);
            }}
            onSliderFocus={setCalSliderKey}
            onCfgChange={bumpCfg}
            onClose={exitCalibration}
            onApplied={async () => {
              const ex = await loadExercise(exerciseId);
              setCfg(ex);
              setCfgRevision((n) => n + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}
