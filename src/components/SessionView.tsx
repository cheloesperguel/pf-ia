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
import { loadExercise } from "@/lib/loadConfig";
import {
  loadPoseSettingsBundle,
  resolvePoseModel,
  type LandmarkerOptions,
  type PoseSettingsBundle,
} from "@/lib/settingsPose";

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
};

export function SessionView({ exerciseId, onBack }: SessionViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [poseBundle, setPoseBundle] = useState<PoseSettingsBundle | null>(null);
  const [landmarkerOpts, setLandmarkerOpts] = useState<LandmarkerOptions | null>(
    null,
  );
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [hud, setHud] = useState<SessionHudState>(EMPTY_HUD);

  const ttsCfg = (cfg?.tts ?? {}) as Record<string, unknown>;
  const ttsOn = Boolean(ttsCfg.enabled !== false);
  const { speak } = useSpeech(ttsOn);

  const { processFrame, skipSetup } = useExerciseSession(cfg, poseBundle, {
    ttsEnabled: ttsOn,
    onSpeak: speak,
  });

  const {
    videoRef,
    getVideo,
    ready: camReady,
    error: camError,
    start,
    stop,
    mirror,
  } = useCamera({
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
    };
  }, [exerciseId]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const lastHudPush = useRef(0);

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
    if (poseReady && cfg) {
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
          { color: "#5eead4", lineWidth: 2 },
        );
        utils.drawLandmarks(norm as NormalizedLandmark[], {
          color: "#fbbf24",
          lineWidth: 1,
          radius: 3,
        });
        if (mirror) ctx.restore();
      }

      const state = processFrame(norm, world, ts);
      const now = performance.now();
      if (now - lastHudPush.current > 80) {
        lastHudPush.current = now;
        setHud(state);
      }
    }
  }, [
    camReady,
    cfg,
    detectForVideo,
    mirror,
    poseReady,
    processFrame,
    getVideo,
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
  }, [camReady, poseReady, cfg, drawLoop]);

  const displayName =
    (cfg?.display_name as string) || exerciseId.replace(/_/g, " ");
  const busy = poseLoading || !landmarkerOpts || !cfg;
  const status = loadErr || camError || poseError;

  const handleSkipSetup = () => {
    skipSetup();
    setHud((prev) => ({ ...prev, phase: "execution" }));
  };

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
      </header>

      {status && <p className="session-error">{status}</p>}

      <div className="session-stage">
        <video
          ref={videoRef}
          className={`session-video${mirror ? " session-video--mirror" : ""}`}
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="session-canvas" />
        {!busy && <SessionHud hud={hud} onSkipSetup={handleSkipSetup} />}
      </div>
    </div>
  );
}
