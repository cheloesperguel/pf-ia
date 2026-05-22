/** Comprueba permiso de micrófono y qué dispositivo usa getUserMedia (Whisper / grabación). */

export interface MicProbeResult {
  ok: boolean;
  label: string;
  deviceId: string;
  error?: string;
  inputCount: number;
}

export async function probeMicrophone(): Promise<MicProbeResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      label: "",
      deviceId: "",
      error: "getUserMedia no disponible en este navegador",
      inputCount: 0,
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    const label = track?.label?.trim() || "(dispositivo sin nombre)";
    const deviceId = track?.getSettings().deviceId ?? "";
    for (const t of stream.getTracks()) t.stop();

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");

    return {
      ok: true,
      label,
      deviceId,
      inputCount: inputs.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      label: "",
      deviceId: "",
      error: msg,
      inputCount: 0,
    };
  }
}

export function formatMicHint(
  mic: MicProbeResult,
  backend: "openai" | "api" | "browser" | "none",
): string {
  if (!mic.ok) {
    return `Micrófono: sin acceso (${mic.error ?? "permiso denegado"}). Actívalo en ajustes del sitio.`;
  }
  const extra =
    mic.inputCount > 1
      ? ` · ${mic.inputCount} entradas de audio (el SO elige el predeterminado)`
      : "";
  if (backend === "openai" || backend === "api") {
    return `Micrófono (grabación): ${mic.label}${extra}`;
  }
  if (backend === "browser") {
    return (
      `Micrófono (prueba): ${mic.label}${extra}. ` +
      "El reconocimiento de voz del navegador puede usar otro dispositivo; no se puede elegir desde la web."
    );
  }
  return "";
}
