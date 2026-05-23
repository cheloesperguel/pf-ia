import { useMemo, useState } from "react";
import {
  applyCalibrationOnServer,
  saveCalibrationToServer,
} from "@/lib/calibrationApi";
import { useT } from "@/i18n/LocaleContext";
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
  const t = useT();
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
      else setStatus(t("cal.slidersRepOnly"));
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
    setStatus(ok ? t("cal.savedServer") : t("cal.savedLocal"));
  };

  const handleApply = async () => {
    await saveCalibrationToServer(exerciseId, exportCalibrationPatch(cfg));
    const { ok, changes } = await applyCalibrationOnServer(exerciseId);
    if (!ok) {
      setStatus(t("cal.applyPc"));
      return;
    }
    setStatus(
      changes.length
        ? t("cal.applied", { n: changes.length })
        : t("cal.noChanges"),
    );
    if (changes.length) onApplied?.();
  };

  return (
    <div className="web-cal" role="dialog" aria-label={t("cal.title")}>
      <div className="web-cal-header">
        <strong>{t("cal.title")}</strong>
        <button type="button" className="btn-ghost" onClick={onClose}>
          {t("cal.close")}
        </button>
      </div>

      <p className="web-cal-hint">{t("cal.hint")}</p>

      <div className="web-cal-solo">
        <button
          type="button"
          className={soloIndex === null ? "active" : ""}
          onClick={() => applySolo(null)}
        >
          {t("cal.all")}
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
          const threshold =
            sl.kind === "deg"
              ? t("cal.thresholdDeg", { val: val.toFixed(0) })
              : t("cal.threshold", { val: val.toFixed(2) });
          return (
            <li key={sl.key} className={isActive ? "web-cal-sl-active" : ""}>
              <label>
                <span className="web-cal-sl-label">{sl.label}</span>
                <span className="web-cal-sl-title">{sl.title}</span>
                {sl.valueHint && (
                  <span className="web-cal-sl-hint">{sl.valueHint}</span>
                )}
                <span className="web-cal-sl-val">
                  {threshold}
                  {live ? ` · ${t("cal.live")} ${live}` : ""}
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
          {t("cal.save")}
        </button>
        <button type="button" className="btn-apply" onClick={() => void handleApply()}>
          {t("cal.apply")}
        </button>
      </div>
      {status && <p className="web-cal-status">{status}</p>}
    </div>
  );
}
