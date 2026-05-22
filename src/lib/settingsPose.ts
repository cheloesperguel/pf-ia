import { fetchJson } from "./loadConfig";
import { parseAlertConfig, type AlertCoachConfig } from "./alertCoach";

export type PoseModelName = "lite" | "full" | "heavy";

export interface LandmarkerOptions {
  poseModel: PoseModelName;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
  numPoses: number;
  outputSegmentationMasks: boolean;
}

const VALID_MODELS = new Set<PoseModelName>(["lite", "full", "heavy"]);

function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [key, val] of Object.entries(overlay)) {
    const prev = out[key];
    if (
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev) &&
      val &&
      typeof val === "object" &&
      !Array.isArray(val)
    ) {
      out[key] = deepMerge(
        prev as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else {
      out[key] = val;
    }
  }
  return out;
}

function parseLandmarker(raw: Record<string, unknown>): LandmarkerOptions {
  const m = String(raw.pose_model ?? "full").toLowerCase();
  const poseModel = VALID_MODELS.has(m as PoseModelName)
    ? (m as PoseModelName)
    : "full";
  return {
    poseModel,
    minPoseDetectionConfidence: Number(raw.min_pose_detection_confidence ?? 0.5),
    minPosePresenceConfidence: Number(raw.min_pose_presence_confidence ?? 0.55),
    minTrackingConfidence: Number(raw.min_tracking_confidence ?? 0.6),
    numPoses: Math.max(1, Number(raw.num_poses ?? 1)),
    outputSegmentationMasks: Boolean(raw.output_segmentation_masks ?? false),
  };
}

export interface RepSettings {
  repHoldFramesTop: number;
  repHoldFramesBottom: number;
  minLandmarkVisibilityRep: number;
  smoothingAlphaDefault: number;
}

export interface PoseSettingsBundle {
  landmarker: LandmarkerOptions;
  rep: RepSettings;
  alerts: AlertCoachConfig;
}

async function loadMergedPoseJson(): Promise<Record<string, unknown>> {
  const data = await fetchJson<Record<string, unknown>>("/settings_pose.json");
  let merged = { ...data };
  const profile = String(data.profile ?? "balanced");
  const profiles = data.profiles;
  if (profiles && typeof profiles === "object" && profile in profiles) {
    const overlay = (profiles as Record<string, unknown>)[profile];
    if (overlay && typeof overlay === "object") {
      merged = deepMerge(merged, overlay as Record<string, unknown>);
    }
  }
  return merged;
}

function parseRep(raw: Record<string, unknown>): RepSettings {
  return {
    repHoldFramesTop: Math.max(1, Number(raw.rep_hold_frames_top ?? 3)),
    repHoldFramesBottom: Math.max(1, Number(raw.rep_hold_frames_bottom ?? 3)),
    minLandmarkVisibilityRep: Number(raw.min_landmark_visibility_rep ?? 0.38),
    smoothingAlphaDefault: Number(raw.smoothing_alpha_default ?? 0.35),
  };
}

export async function loadPoseSettingsBundle(): Promise<PoseSettingsBundle> {
  const merged = await loadMergedPoseJson();
  const landmarker = parseLandmarker(
    (merged.landmarker ?? {}) as Record<string, unknown>,
  );
  const rep = parseRep((merged.rep ?? {}) as Record<string, unknown>);
  const alerts = parseAlertConfig(
    (merged.alerts ?? {}) as Record<string, unknown>,
  );
  return { landmarker, rep, alerts };
}

export async function loadPoseSettings(): Promise<LandmarkerOptions> {
  const bundle = await loadPoseSettingsBundle();
  return bundle.landmarker;
}

/** En móvil suele ir mejor full/lite que heavy. */
export function resolvePoseModel(
  exercise: Record<string, unknown>,
  settings: LandmarkerOptions,
  mobileHint = true,
): PoseModelName {
  const ex = exercise.pose_model;
  if (typeof ex === "string" && VALID_MODELS.has(ex.toLowerCase() as PoseModelName)) {
    return ex.toLowerCase() as PoseModelName;
  }
  if (mobileHint && settings.poseModel === "heavy") {
    return "full";
  }
  return settings.poseModel;
}
