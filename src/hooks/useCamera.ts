import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCameraOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  /** Espejo horizontal (cámara frontal / webcam). */
  mirror?: boolean;
}

async function openCameraStream(
  facingMode: "user" | "environment",
  width: number,
  height: number,
): Promise<MediaStream> {
  const base = {
    width: { ideal: width },
    height: { ideal: height },
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { ...base, facingMode },
      audio: false,
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      video: base,
      audio: false,
    });
  }
}

function waitForVideoDimensions(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
      else reject(new Error("La cámara no entregó dimensiones de video."));
    };
    const onError = () => {
      cleanup();
      reject(new Error("Error al cargar el stream de video."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    setTimeout(() => {
      if (video.videoWidth > 0) onReady();
    }, 3000);
  });
}

export function useCamera(options: UseCameraOptions = {}) {
  const {
    facingMode = "user",
    width = 1280,
    height = 720,
    mirror = true,
  } = options;
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoElRef.current;
    if (v) v.srcObject = null;
    setReady(false);
  }, []);

  const bindVideo = useCallback(
    async (video: HTMLVideoElement) => {
      videoElRef.current = video;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      try {
        if (!streamRef.current) {
          streamRef.current = await openCameraStream(facingMode, width, height);
        }
        video.srcObject = streamRef.current;
        await video.play();
        await waitForVideoDimensions(video);
        setReady(true);
        setError(null);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "No se pudo acceder a la cámara (permiso o HTTPS).";
        setError(msg);
        setReady(false);
      }
    },
    [facingMode, height, width],
  );

  const start = useCallback(async () => {
    stop();
    setError(null);
    try {
      streamRef.current = await openCameraStream(facingMode, width, height);
      const video = videoElRef.current;
      if (video) await bindVideo(video);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "No se pudo acceder a la cámara (permiso o HTTPS).";
      setError(msg);
      setReady(false);
    }
  }, [bindVideo, facingMode, height, stop, width]);

  /** Ref callback: enlaza el stream cuando el <video> ya está en el DOM. */
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node) {
        videoElRef.current = null;
        return;
      }
      if (streamRef.current) {
        void bindVideo(node);
      } else {
        videoElRef.current = node;
      }
    },
    [bindVideo],
  );

  useEffect(() => () => stop(), [stop]);

  const getVideo = useCallback(() => videoElRef.current, []);

  return { videoRef, getVideo, ready, error, start, stop, mirror };
}
