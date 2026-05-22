import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { LandmarkLike } from "@/lib/poseLandmarks";
import {
  AlertCoach,
  buildRuleIndex,
  filterByRequires,
} from "@/lib/alertCoach";
import {
  evaluateSetupChecks,
  SetupGate,
  setupHoldMs,
  setupPositionLabel,
} from "@/lib/exerciseSetup";
import {
  bothArmsVisible,
  computePressMetrics,
  isFrontalView,
} from "@/lib/poseMath";
import type { PoseSettingsBundle } from "@/lib/settingsPose";
import {
  collectAlertItems,
  validateBottomSnapshot,
} from "@/lib/sessionRules";
import type { WorkoutGuide, WorkoutHudSnapshot } from "@/lib/workoutGuide";

export interface SessionHudState {
  phase: "setup" | "execution";
  displayName: string;
  positionLabel: string;
  repCount: number;
  phaseAngle: number;
  angleLabel: string;
  /** Métricas del frame (para gráficos en canvas). */
  metrics: Record<string, number>;
  alerts: string[];
  alertOverflow: string | null;
  setupFailures: [string, string][];
  holdProgress: number;
  holdMs: number;
  rejectFlash: boolean;
  rejectMessages: string[];
  viewOk: boolean;
  trackingOk: boolean;
  noPose: boolean;
  workout: WorkoutHudSnapshot | null;
  coachStatus: string;
}

const NO_POSE: [string, string] = [
  "no_pose",
  "No se detecta cuerpo completo.",
];

function smoothEma(
  prev: number | undefined,
  value: number,
  alpha: number,
): number {
  if (Number.isNaN(value)) return prev ?? value;
  if (prev === undefined || Number.isNaN(prev)) return value;
  return alpha * value + (1 - alpha) * prev;
}

export function useExerciseSession(
  cfg: Record<string, unknown> | null,
  poseBundle: PoseSettingsBundle | null,
  options: {
    ttsEnabled?: boolean;
    onSpeak?: (text: string) => void;
    workoutRef?: RefObject<WorkoutGuide | null>;
    coachStatus?: string;
    /** Incrementar al mutar umbrales en calibración web. */
    cfgRevision?: number;
  } = {},
) {
  const setupGateRef = useRef<SetupGate | null>(null);
  const alertEngineRef = useRef<AlertCoach | null>(null);
  const ruleByIdRef = useRef<Record<string, Record<string, unknown>>>({});
  const emaRef = useRef<Record<string, number>>({});
  const setupTtsAnnouncedRef = useRef(new Set<string>());
  const introSpokenRef = useRef(false);

  const repStateRef = useRef({
    repCount: 0,
    topHold: 0,
    bottomHold: 0,
    deepAchieved: false,
    bestBottom: null as Record<string, number> | null,
    lastRepMs: -1e9,
  });

  const hudRef = useRef<SessionHudState>({
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
  });

  const rejectUntilRef = useRef(0);
  const workoutArmedRef = useRef(false);

  const speakRef = useRef(options.onSpeak);
  const ttsEnabledRef = useRef(options.ttsEnabled ?? false);
  const workoutRef = useRef(options.workoutRef?.current ?? null);
  const coachStatusRef = useRef(options.coachStatus ?? "");
  speakRef.current = options.onSpeak;
  ttsEnabledRef.current = options.ttsEnabled ?? false;
  workoutRef.current = options.workoutRef?.current ?? null;
  coachStatusRef.current = options.coachStatus ?? "";

  useEffect(() => {
    if (!cfg || !poseBundle) return;
    setupGateRef.current = new SetupGate(cfg);
    alertEngineRef.current = new AlertCoach(poseBundle.alerts);
    ruleByIdRef.current = buildRuleIndex(cfg);
    emaRef.current = {};
    setupTtsAnnouncedRef.current.clear();
    introSpokenRef.current = false;
    repStateRef.current = {
      repCount: 0,
      topHold: 0,
      bottomHold: 0,
      deepAchieved: false,
      bestBottom: null,
      lastRepMs: -1e9,
    };
    rejectUntilRef.current = 0;
    workoutArmedRef.current = false;
    const sp = (cfg.setup_pose ?? {}) as Record<string, unknown>;
    const tts = (sp.tts ?? {}) as Record<string, unknown>;
    hudRef.current.displayName = String(
      cfg.display_name ?? cfg.exercise_id ?? "Ejercicio",
    );
    hudRef.current.positionLabel = setupPositionLabel(cfg);
    hudRef.current.holdMs = setupHoldMs(cfg);
    hudRef.current.angleLabel = String(
      ((cfg.hud ?? {}) as Record<string, unknown>).angle_label ?? "Ángulo",
    );
    hudRef.current.repCount = 0;
    hudRef.current.phase = setupGateRef.current.phase;
    if (ttsEnabledRef.current && speakRef.current && !introSpokenRef.current) {
      const intro = String(tts.intro ?? "");
      if (intro) {
        speakRef.current(intro);
        introSpokenRef.current = true;
      }
    }
  }, [cfg, poseBundle]);

  const movement = String(cfg?.movement ?? "press");
  const repCfg = (cfg?.rep_detection ?? {}) as Record<string, unknown>;
  const angleKey = String(
    repCfg.knee_angle_metric ?? repCfg.elbow_angle_metric ?? "elbow_angle_min_deg",
  );
  const topMin = Number(repCfg.top_min_deg ?? 152);
  const bottomMax = Number(repCfg.bottom_max_deg ?? 100);
  const minRepIntervalMs = Number(cfg?.min_rep_interval_ms ?? 600);
  const alpha = Number(
    cfg?.smoothing_alpha ?? poseBundle?.rep.smoothingAlphaDefault ?? 0.35,
  );
  const frontalCfg = (cfg?.frontal ?? {}) as Record<string, unknown>;
  const armsVisCfg = (cfg?.arms_visibility ?? {}) as Record<string, unknown>;

  const processFrame = useCallback(
    (
      norm: LandmarkLike[] | undefined,
      world: LandmarkLike[] | undefined,
      timestampMs: number,
    ): SessionHudState => {
      const hud = hudRef.current;
      if (!cfg || !poseBundle) return hud;

      const gate = setupGateRef.current!;
      const alertEngine = alertEngineRef.current!;
      const ruleById = ruleByIdRef.current;
      const rep = repStateRef.current;
      const holdTop = poseBundle.rep.repHoldFramesTop;
      const holdBottom = poseBundle.rep.repHoldFramesBottom;
      const minVisRep = poseBundle.rep.minLandmarkVisibilityRep;

      hud.phase = gate.phase;
      hud.holdProgress = gate.holdProgress();
      hud.rejectFlash = performance.now() / 1000 < rejectUntilRef.current;
      hud.repCount = rep.repCount;
      hud.coachStatus = coachStatusRef.current;
      const workout = workoutRef.current;
      if (workout && gate.phase === "execution") {
        workout.tick();
        if (workout.needsRepAlign) {
          workout.consumeRepAlign(rep.repCount);
        }
        hud.workout = workout.hudSnapshot(rep.repCount);
      } else {
        hud.workout = workout?.hudSnapshot(rep.repCount) ?? null;
      }

      if (!norm?.length || !world?.length) {
        hud.noPose = true;
        hud.viewOk = false;
        hud.trackingOk = false;
        if (gate.phase === "setup") {
          gate.update(false);
          hud.setupFailures = [NO_POSE];
          hud.alerts = [NO_POSE[1]];
          if (
            ttsEnabledRef.current &&
            speakRef.current &&
            !setupTtsAnnouncedRef.current.has("no_pose")
          ) {
            speakRef.current(NO_POSE[1]);
            setupTtsAnnouncedRef.current.add("no_pose");
          }
        } else {
          hud.alerts = [NO_POSE[1]];
        }
        hud.phaseAngle = NaN;
        hud.metrics = {};
        return { ...hud };
      }

      hud.noPose = false;

      if (movement !== "press") {
        hud.alerts = ["Este ejercicio aún no está portado en la PWA."];
        hud.metrics = {};
        return { ...hud };
      }

      const viewOk = isFrontalView(norm, frontalCfg);
      const trackingOk = bothArmsVisible(norm, armsVisCfg);
      hud.viewOk = viewOk;
      hud.trackingOk = trackingOk;

      let raw: Record<string, number> = {};
      if (trackingOk) {
        raw = computePressMetrics(norm, world, minVisRep);
      }

      const inSetup = gate.phase === "setup";
      let metrics: Record<string, number>;
      if (inSetup) {
        metrics = raw;
      } else {
        for (const [k, v] of Object.entries(raw)) {
          emaRef.current[k] = smoothEma(emaRef.current[k], v, alpha);
        }
        metrics = { ...emaRef.current };
      }

      const rawAngle = Number(raw[angleKey]);
      const metricAngle = Number(metrics[angleKey]);
      let phaseAngle = Number.isFinite(metricAngle)
        ? metricAngle
        : Number.isFinite(rawAngle)
          ? rawAngle
          : NaN;
      if (viewOk && Number.isFinite(rawAngle)) {
        emaRef.current[angleKey] = smoothEma(
          emaRef.current[angleKey],
          rawAngle,
          alpha,
        );
        phaseAngle = emaRef.current[angleKey];
      }
      hud.phaseAngle = Number.isFinite(phaseAngle) ? phaseAngle : NaN;

      if (inSetup) {
        const [setupOk, failures] = evaluateSetupChecks(
          cfg,
          viewOk,
          trackingOk,
          metrics,
          true,
        );
        if (gate.update(setupOk)) {
          alertEngine.clearTracks();
          const sp = (cfg.setup_pose ?? {}) as Record<string, unknown>;
          const tts = (sp.tts ?? {}) as Record<string, unknown>;
          const go = String(tts.go ?? "¡Partida!");
          if (ttsEnabledRef.current && speakRef.current) {
            speakRef.current(go);
          }
          if (workout && !workoutArmedRef.current) {
            workout.startAfterSetup();
            workoutArmedRef.current = true;
          }
        }
        hud.setupFailures = failures;
        hud.alerts = failures.map(([, m]) => m);

        if (ttsEnabledRef.current && speakRef.current) {
          const active = new Set(failures.map(([rid]) => rid));
          for (const rid of [...setupTtsAnnouncedRef.current]) {
            if (!active.has(rid)) setupTtsAnnouncedRef.current.delete(rid);
          }
          for (const [rid, msg] of failures) {
            if (!setupTtsAnnouncedRef.current.has(rid)) {
              speakRef.current(msg);
              setupTtsAnnouncedRef.current.add(rid);
            }
          }
        }
      } else {
        const showForm =
          !Number.isNaN(phaseAngle) && phaseAngle <= bottomMax + 12;
        const rawAlerts = collectAlertItems(
          cfg,
          viewOk,
          trackingOk,
          metrics,
          showForm,
        );
        const filtered = filterByRequires(rawAlerts, ruleById);
        const stable = alertEngine.update(filtered, ruleById);
        const { shown, overflow } = alertEngine.hudItems(stable);
        hud.alerts = shown.map(([, m]) => m);
        hud.alertOverflow = overflow;
        hud.setupFailures = [];

        if (ttsEnabledRef.current && speakRef.current) {
          const line = alertEngine.popTts(stable, ruleById);
          if (line) speakRef.current(line);
        }

        if (workout?.isSetActive) {
          workout.noteAlerts(stable);
        }

        const repCountingOk =
          trackingOk &&
          viewOk &&
          !Number.isNaN(phaseAngle) &&
          (!workout || workout.allowsRepCounting());
        if (repCountingOk) {
          const atTop = phaseAngle >= topMin;
          const atDeep = phaseAngle <= bottomMax;
          if (atTop) {
            rep.topHold += 1;
            rep.bottomHold = 0;
          } else {
            rep.topHold = 0;
          }
          if (atDeep) {
            rep.bottomHold += 1;
          } else {
            rep.bottomHold = 0;
          }
          if (rep.bottomHold >= holdBottom) {
            rep.deepAchieved = true;
            const snap = { ...emaRef.current };
            const prevPhase = rep.bestBottom?._phase ?? 999;
            if (!rep.bestBottom || phaseAngle < prevPhase) {
              snap._phase = phaseAngle;
              rep.bestBottom = snap;
            }
          }
          if (rep.topHold >= holdTop && rep.deepAchieved && rep.bestBottom) {
            if (timestampMs - rep.lastRepMs >= minRepIntervalMs) {
              const [okRep, , failedIds] = validateBottomSnapshot(
                cfg,
                rep.bestBottom,
              );
              if (okRep) {
                rep.repCount += 1;
                rep.lastRepMs = timestampMs;
                hud.repCount = rep.repCount;
                if (workout) {
                  const done = workout.onSessionRepCount(rep.repCount);
                  if (ttsEnabledRef.current && speakRef.current) {
                    speakRef.current(String(workout.repsInSet));
                  }
                  if (done) {
                    hud.workout = workout.hudSnapshot(rep.repCount);
                  }
                } else if (ttsEnabledRef.current && speakRef.current) {
                  speakRef.current(String(rep.repCount));
                }
              } else {
                rejectUntilRef.current = performance.now() / 1000 + 1.2;
                hud.rejectMessages = failedIds.map(
                  (fid) =>
                    String(ruleById[fid]?.message ?? fid),
                );
                if (workout?.isSetActive) {
                  workout.noteRepReject(
                    failedIds,
                    hud.rejectMessages,
                  );
                }
              }
              rep.deepAchieved = false;
              rep.bestBottom = null;
              rep.topHold = 0;
              rep.bottomHold = 0;
            }
          }
        } else {
          rep.topHold = 0;
          rep.bottomHold = 0;
        }
      }

      hud.metrics = metrics;
      return { ...hud };
    },
    [
      cfg,
      poseBundle,
      movement,
      angleKey,
      topMin,
      bottomMax,
      minRepIntervalMs,
      alpha,
      frontalCfg,
      armsVisCfg,
      options.cfgRevision,
    ],
  );

  const skipSetup = useCallback(() => {
    setupGateRef.current?.skip();
    hudRef.current.phase = "execution";
    const workout = workoutRef.current;
    if (workout && !workoutArmedRef.current) {
      workout.startAfterSetup();
      workoutArmedRef.current = true;
    }
  }, []);

  return { processFrame, skipSetup };
}
