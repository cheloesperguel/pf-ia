import type { CalibrationFocusInfo } from "@/lib/liveLimits";

interface CalibrationRuleBannerProps {
  focus: CalibrationFocusInfo | null;
}

export function CalibrationRuleBanner({ focus }: CalibrationRuleBannerProps) {
  if (!focus) return null;
  const phaseLabel =
    focus.phase === "setup"
      ? "Setup (referencia)"
      : focus.phase === "rep"
        ? "Reps"
        : "Ejecución";

  return (
    <div className="cal-rule-banner" aria-live="polite">
      <div className="cal-rule-banner-head">
        <span className="cal-rule-banner-phase">Calibrando · {phaseLabel}</span>
        <code className="cal-rule-banner-id">{focus.id}</code>
      </div>
      <h3 className="cal-rule-banner-title">{focus.title}</h3>
      {focus.id === "elbows_scapular_plane" && (
        <p className="cal-rule-banner-scale">
          Escala 0–1 en imagen: humero vertical (rack) ≈ 0,3 · brazo horizontal (cruz)
          ≈ 1. Umbral 0,96 era para la métrica antigua; recalibra en 0,5–0,65.
        </p>
      )}
      {focus.message ? (
        <p className="cal-rule-banner-msg">{focus.message}</p>
      ) : (
        <p className="cal-rule-banner-msg cal-rule-banner-msg--muted">
          Sin mensaje en JSON para esta regla.
        </p>
      )}
    </div>
  );
}
