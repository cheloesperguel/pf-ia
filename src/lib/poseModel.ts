import type { PoseModelName } from "./settingsPose";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export function poseModelAssetUrl(model: PoseModelName): string {
  return (
    "https://storage.googleapis.com/mediapipe-models/" +
    `pose_landmarker/pose_landmarker_${model}/float16/latest/` +
    `pose_landmarker_${model}.task`
  );
}

export { WASM_CDN };
