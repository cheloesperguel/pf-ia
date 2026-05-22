import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { poseModelAssetUrl, WASM_CDN } from "@/lib/poseModel";
import type { LandmarkerOptions } from "@/lib/settingsPose";

export function usePoseLandmarker(landmarker: LandmarkerOptions | null) {
  const detectorRef = useRef<PoseLandmarker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!landmarker) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);

    (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      const modelPath = poseModelAssetUrl(landmarker.poseModel);
      const baseOpts = {
        modelAssetPath: modelPath,
        runningMode: "VIDEO" as const,
        numPoses: landmarker.numPoses,
        minPoseDetectionConfidence: landmarker.minPoseDetectionConfidence,
        minPosePresenceConfidence: landmarker.minPosePresenceConfidence,
        minTrackingConfidence: landmarker.minTrackingConfidence,
        outputSegmentationMasks: landmarker.outputSegmentationMasks,
      };

      let lastErr: unknown;
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const detector = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate,
            },
            runningMode: baseOpts.runningMode,
            numPoses: baseOpts.numPoses,
            minPoseDetectionConfidence: baseOpts.minPoseDetectionConfidence,
            minPosePresenceConfidence: baseOpts.minPosePresenceConfidence,
            minTrackingConfidence: baseOpts.minTrackingConfidence,
            outputSegmentationMasks: baseOpts.outputSegmentationMasks,
          });
          if (cancelled) {
            detector.close();
            return;
          }
          detectorRef.current = detector;
          setReady(true);
          setError(null);
          return;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!cancelled) {
        setError(
          lastErr instanceof Error
            ? lastErr.message
            : "Error al cargar Pose Landmarker",
        );
      }
    })()
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Error al cargar Pose Landmarker",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
      setReady(false);
    };
  }, [
    landmarker?.poseModel,
    landmarker?.minPoseDetectionConfidence,
    landmarker?.minPosePresenceConfidence,
    landmarker?.minTrackingConfidence,
    landmarker?.numPoses,
    landmarker?.outputSegmentationMasks,
  ]);

  const detectForVideo = (
    video: HTMLVideoElement,
    timestampMs: number,
  ): PoseLandmarkerResult | null => {
    const d = detectorRef.current;
    if (!d || video.readyState < 2) return null;
    return d.detectForVideo(video, timestampMs);
  };

  return { detectForVideo, loading, error, ready };
}
