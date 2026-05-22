import { useMemo, useState } from "react";
import {
  applyCalibrationOnServer,
  saveCalibrationToServer,
} from "@/lib/calibrationApi";
import {
  downloadCalibrationJson,
  exportCalibrationPatch,
  posToSliderValue,
  pressCalibrationSliders,
  setSoloRule,
  sliderToPos,
  sliderValue,
  soloRuleIdForIndex,
  applySliderPos,
  type CalSliderDef,
} from "@/lib/liveLimits";

interface WebCalibrationPanelProps {
  exerciseId: string;
  cfg: Record<string, unknown>;
  metrics: Record<string, number>;
  soloIndex: number | null;
  onSoloChange: (index: number | null) => void;
  onSliderFocus: (sliderKey: string) => void;
  onCfgChange: () => void;
  onClose: () => void;
  onApplied?: () => void;
}

function formatLiveMetric(
  metrics: Record<string, number>,
  sl: CalSliderDef,
  cfg: Record<string, unknown>,
): string {
  if (sl.key === "rep_top" || sl.key === "rep_bottom") {
    const ang = metrics.elbow_angle_min_deg;
    return Number.isFinite(ang) ? `codo=${ang.toFixed(0)}°` : "—";
  }
  if (sl.targetId === "elbows_scapular_plane") {
    const lat = metrics.elbow_scapular_lateral_frac_max;
    const lim = sliderValue(cfg, sl);
    return Number.isFinite(lat) ? `lat ${lat.toFixed(2)} / ${lim.toFixed(2)}` : "—";
  }
  if (sl.targetId === "elbows_forward_rack") {
    const fwd = metrics.elbow_scapular_forward_frac_min;
    const lim = sliderValue(cfg, sl);
    return Number.isFinite(fwd) ? `adel ${fwd.toFixed(2)} / ${lim.toFixed(2)}` : "—";
  }
  return "";
}

export function WebCalibrationPanel({
  exerciseId,
  cfg,
  metrics,
  soloIndex,
  onSoloChange,
  onSliderFocus,
  onCfgChange,
  onClose,
  onApplied,
}: WebCalibrationPanelProps) {
  const sliders = useMemo(() => pressCalibrationSliders(cfg), [cfg]);
  const [status, setStatus] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const applySolo = (n: number | null) => {
    onSoloChange(n);
    if (n === null) {
      setSoloRule(cfg, null);
    } else {
      const rid = soloRuleIdForIndex(cfg, n);
      if (rid) setSoloRule(cfg, rid);
      else setStatus("Sliders 1–2 son reps; usa 3–8 para una regla");
      const sl = sliders.find((s) => s.soloIndex === n);
      if (sl) {
        setActiveKey(sl.key);
        onSliderFocus(sl.key);
      }
    }
    onCfgChange();
  };

  const handleSlider = (sl: CalSliderDef, pos: number) => {
    setActiveKey(sl.key);
    onSliderFocus(sl.key);
    applySliderPos(cfg, sl, pos);
    onCfgChange();
  };

  const handleSave = async () => {
    const patch = exportCalibrationPatch(cfg);
    const ok = await saveCalibrationToServer(exerciseId, patch);
    downloadCalibrationJson(exerciseId, patch);
    setStatus(
      ok
        ? "Guardado en servidor y descargado."
        : "Descargado (API apagada: solo archivo local).",
    );
  };

  const handleApply = async () => {
    await saveCalibrationToServer(exerciseId, exportCalibrationPatch(cfg));
    const { ok, changes } = await applyCalibrationOnServer(exerciseId);
    if (!ok) {
      setStatus("Aplica en PC: python apply_calibration.py (API no disponible).");
      return;
    }
    setStatus(
      changes.length
        ? `Aplicado: ${changes.length} cambio(s).`
        : "Sin cambios respecto al JSON principal.",
    );
    if (changes.length) onApplied?.();
  };

  return (
    <div className="web-cal" role="dialog" aria-label="Calibración en vivo">
      <div className="web-cal-header">
        <strong>Calibración</strong>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <p className="web-cal-hint">
        Fase 1 omitida. <b>3–8</b> = una regla (nombre y aviso arriba). <b>0</b> = todas.
      </p>

      <div className="web-cal-solo">
        <button
          type="button"
          className={soloIndex === null ? "active" : ""}
          onClick={() => applySolo(null)}
        >
          0 Todas
        </button>
        {[3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            type="button"
            className={soloIndex === n ? "active" : ""}
            onClick={() => applySolo(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <ul className="web-cal-sliders">
        {sliders.map((sl) => {
          const pos = sliderToPos(sl, sliderValue(cfg, sl));
          const val = posToSliderValue(sl, pos);
          const live = formatLiveMetric(metrics, sl, cfg);
          const isActive = activeKey === sl.key || soloIndex === sl.soloIndex;
          return (
            <li key={sl.key} className={isActive ? "web-cal-sl-active" : ""}>
              <label>
                <span className="web-cal-sl-label">{sl.label}</span>
                <span className="web-cal-sl-title">{sl.title}</span>
                {sl.valueHint && (
                  <span className="web-cal-sl-hint">{sl.valueHint}</span>
                )}
                <span className="web-cal-sl-val">
                  {sl.kind === "deg"
                    ? `Umbral ${val.toFixed(0)}°`
                    : `Umbral ${val.toFixed(2)}`}
                  {live ? ` · vivo ${live}` : ""}
                </span>
                <input
                  type="range"
                  min={0}
                  max={sl.kind === "deg" ? sl.max - sl.min : 100}
                  value={pos}
                  onFocus={() => {
                    setActiveKey(sl.key);
                    onSliderFocus(sl.key);
                  }}
                  onChange={(e) =>
                    handleSlider(sl, Number(e.target.value))
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="web-cal-actions">
        <button type="button" onClick={() => void handleSave()}>
          Guardar (S)
        </button>
        <button type="button" className="btn-apply" onClick={() => void handleApply()}>
          Aplicar al JSON
        </button>
      </div>
      {status && <p className="web-cal-status">{status}</p>}
    </div>
  );
}
