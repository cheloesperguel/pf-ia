/** Umbrales en vivo (misma lógica que calibration_panel.py / LiveLimits). */

export interface CalibrationPatch {
  exercise_id?: string;
  movement?: string;
  comment?: string;
  rep_detection: { top_min_deg: number; bottom_max_deg: number };
  rule_values: Record<string, number>;
}

export type SliderKind = "deg" | "frac";

export interface CalSliderDef {
  key: string;
  label: string;
  title: string;
  /** Texto bajo el slider (qué es 0 vs 1). */
  valueHint?: string;
  kind: SliderKind;
  targetId?: string;
  min: number;
  max: number;
  /** Solo fracciones: rango real del valor */
  fracLo?: number;
  fracHi?: number;
  soloIndex: number;
}

const METRIC_BY_KEY: Record<string, string> = {
  setup_scap: "setup_scapular_plane",
  exec_scap: "elbows_scapular_plane",
  exec_fwd: "elbows_forward_rack",
  wrist_stack: "wrist_elbow_stack_sin_max",
  setup_rack_min: "setup_rack_depth",
  setup_rack_max: "setup_not_locked",
};

export function getMetricLimit(
  cfg: Record<string, unknown>,
  targetId: string,
): number | null {
  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    if (String(rule.id) === targetId && rule.kind === "metric") {
      return Number(rule.value);
    }
  }
  const setup = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  for (const chk of (setup.checks ?? []) as Record<string, unknown>[]) {
    if (String(chk.id) === targetId && chk.kind === "metric") {
      return Number(chk.value);
    }
  }
  const visual = (cfg.visual ?? {}) as Record<string, unknown>;
  if (targetId === "wrist_elbow_stack_sin_max") {
    return Number(visual.wrist_elbow_stack_sin_max ?? NaN);
  }
  return null;
}

export function setMetricLimit(
  cfg: Record<string, unknown>,
  targetId: string,
  value: number,
): void {
  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    if (String(rule.id) === targetId && rule.kind === "metric") {
      rule.value = value;
      return;
    }
  }
  const setup = cfg.setup_pose as Record<string, unknown> | undefined;
  if (setup) {
    const checks = (setup.checks ?? []) as Record<string, unknown>[];
    for (const chk of checks) {
      if (String(chk.id) === targetId && chk.kind === "metric") {
        chk.value = value;
        return;
      }
    }
  }
  if (targetId === "wrist_elbow_stack_sin_max") {
    const visual = (cfg.visual ?? {}) as Record<string, unknown>;
    cfg.visual = { ...visual, wrist_elbow_stack_sin_max: value };
  }
}

export function getRepLimits(cfg: Record<string, unknown>): {
  topMinDeg: number;
  bottomMaxDeg: number;
} {
  const rep = (cfg.rep_detection ?? {}) as Record<string, unknown>;
  return {
    topMinDeg: Number(rep.top_min_deg ?? 152),
    bottomMaxDeg: Number(rep.bottom_max_deg ?? 100),
  };
}

export function setRepTop(cfg: Record<string, unknown>, v: number): void {
  const rep = (cfg.rep_detection ?? {}) as Record<string, unknown>;
  cfg.rep_detection = { ...rep, top_min_deg: v };
}

export function setRepBottom(cfg: Record<string, unknown>, v: number): void {
  const rep = (cfg.rep_detection ?? {}) as Record<string, unknown>;
  cfg.rep_detection = { ...rep, bottom_max_deg: v };
}

export function exportCalibrationPatch(
  cfg: Record<string, unknown>,
): CalibrationPatch {
  const { topMinDeg, bottomMaxDeg } = getRepLimits(cfg);
  const rule_values: Record<string, number> = {};
  for (const tid of Object.values(METRIC_BY_KEY)) {
    const v = getMetricLimit(cfg, tid);
    if (v != null && Number.isFinite(v)) rule_values[tid] = v;
  }
  return {
    exercise_id: cfg.exercise_id as string | undefined,
    movement: cfg.movement as string | undefined,
    comment: "Calibrado en PWA; aplicar al JSON principal",
    rep_detection: {
      top_min_deg: topMinDeg,
      bottom_max_deg: bottomMaxDeg,
    },
    rule_values,
  };
}

export function setSoloRule(
  cfg: Record<string, unknown>,
  ruleId: string | null,
): void {
  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    if (rule.kind !== "metric") continue;
    rule.enabled = ruleId === null || String(rule.id) === ruleId;
  }
  const setup = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  for (const chk of (setup.checks ?? []) as Record<string, unknown>[]) {
    if (chk.kind !== "metric") continue;
    chk.enabled = ruleId === null || String(chk.id) === ruleId;
  }
}

export function pressCalibrationSliders(
  _cfg: Record<string, unknown>,
): CalSliderDef[] {
  const frac = (
    key: string,
    label: string,
    title: string,
    targetId: string,
    _def: number,
    lo: number,
    hi: number,
    soloIndex: number,
  ): CalSliderDef => ({
    key,
    label,
    title,
    kind: "frac",
    targetId,
    min: 0,
    max: 100,
    fracLo: lo,
    fracHi: hi,
    soloIndex,
  });

  return [
    {
      key: "rep_top",
      label: "1 Rep arriba",
      title: "Grados para contar rep arriba",
      kind: "deg",
      min: 120,
      max: 175,
      soloIndex: 1,
    },
    {
      key: "rep_bottom",
      label: "2 Rep fondo",
      title: "Grados para fondo de rep",
      kind: "deg",
      min: 70,
      max: 130,
      soloIndex: 2,
    },
    {
      ...frac(
        "setup_scap",
        "3 Setup esc",
        "Umbral máx. fracción lateral en setup (≤)",
        "setup_scapular_plane",
        0.88,
        0.35,
        1.0,
        3,
      ),
      valueHint: "0–1 en 3D: menor = codos más hacia la barra; 1 = brazo en cruz.",
    },
    {
      ...frac(
        "exec_scap",
        "4 Ejec esc",
        "Umbral máx. fracción lateral (regla ≤ este valor)",
        "elbows_scapular_plane",
        0.72,
        0.35,
        1.0,
        4,
      ),
      valueHint:
        "lat = apertura del humero en imagen (|Δx|/‖brazo‖). ~0,3 plano escapular · ~0,95 en cruz. Recalibra umbral (~0,5–0,65).",
    },
    {
      ...frac(
        "exec_fwd",
        "5 Ejec adel",
        "Umbral mín. fracción hacia adelante (regla ≥)",
        "elbows_forward_rack",
        0.22,
        0.05,
        0.6,
        5,
      ),
      valueHint: "0–1: bajo = codos pegados al torso; alto = más hacia la barra/cámara.",
    },
    {
      ...frac(
        "wrist_stack",
        "6 Muñeca-codo",
        "Umbral apilado muñeca–codo (≤, imagen 2D)",
        "wrist_elbow_stack_sin_max",
        0.2,
        0.05,
        0.45,
        6,
      ),
      valueHint: "0 = muñeca bajo codo; alto = antebrazo horizontal.",
    },
    {
      key: "setup_rack_min",
      label: "7 Setup min",
      title: "Ángulo codo mínimo en rack",
      kind: "deg",
      targetId: "setup_rack_depth",
      min: 60,
      max: 110,
      soloIndex: 7,
    },
    {
      key: "setup_rack_max",
      label: "8 Setup max",
      title: "Ángulo codo máximo en setup",
      kind: "deg",
      targetId: "setup_not_locked",
      min: 100,
      max: 150,
      soloIndex: 8,
    },
  ];
}

export function sliderValue(cfg: Record<string, unknown>, sl: CalSliderDef): number {
  if (sl.key === "rep_top") return getRepLimits(cfg).topMinDeg;
  if (sl.key === "rep_bottom") return getRepLimits(cfg).bottomMaxDeg;
  if (sl.targetId) return getMetricLimit(cfg, sl.targetId) ?? 0;
  return 0;
}

export function sliderToPos(sl: CalSliderDef, value: number): number {
  if (sl.kind === "deg") {
    return Math.round(Math.max(0, Math.min(sl.max - sl.min, value - sl.min)));
  }
  const lo = sl.fracLo ?? 0.4;
  const hi = sl.fracHi ?? 1;
  return Math.round(Math.max(0, Math.min(100, (100 * (value - lo)) / (hi - lo))));
}

export function posToSliderValue(sl: CalSliderDef, pos: number): number {
  if (sl.kind === "deg") return sl.min + pos;
  const lo = sl.fracLo ?? 0.4;
  const hi = sl.fracHi ?? 1;
  return lo + (hi - lo) * (pos / 100);
}

export function applySliderPos(
  cfg: Record<string, unknown>,
  sl: CalSliderDef,
  pos: number,
): void {
  const v = posToSliderValue(sl, pos);
  if (sl.key === "rep_top") setRepTop(cfg, v);
  else if (sl.key === "rep_bottom") setRepBottom(cfg, v);
  else if (sl.targetId) setMetricLimit(cfg, sl.targetId, v);
}

export function soloRuleIdForIndex(
  cfg: Record<string, unknown>,
  index: number,
): string | null {
  const sliders = pressCalibrationSliders(cfg);
  const sl = sliders.find((s) => s.soloIndex === index);
  if (!sl || sl.key === "rep_top" || sl.key === "rep_bottom") return null;
  return sl.targetId ?? METRIC_BY_KEY[sl.key] ?? null;
}

export interface CalibrationFocusInfo {
  id: string;
  title: string;
  message: string;
  phase: "setup" | "execution" | "rep";
  sliderLabel?: string;
}

const REP_FOCUS: Record<string, CalibrationFocusInfo> = {
  rep_top: {
    id: "rep_detection.top_min_deg",
    title: "Conteo de reps — arriba",
    message:
      "Grados mínimos del codo para cerrar la rep en la extensión. Sube si no cuenta arriba; baja si cuenta antes de tiempo.",
    phase: "rep",
    sliderLabel: "1 Rep arriba",
  },
  rep_bottom: {
    id: "rep_detection.bottom_max_deg",
    title: "Conteo de reps — fondo",
    message:
      "Grados máximos del codo en el fondo. Sube si exige poco recorrido; baja si no marca fondo.",
    phase: "rep",
    sliderLabel: "2 Rep fondo",
  },
};

function findConfigEntry(
  cfg: Record<string, unknown>,
  targetId: string,
): Record<string, unknown> | null {
  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    if (String(rule.id) === targetId) return rule;
    if (rule.kind === "metric" && String(rule.metric) === targetId) return rule;
  }
  const setup = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  for (const chk of (setup.checks ?? []) as Record<string, unknown>[]) {
    if (String(chk.id) === targetId) return chk;
  }
  if (targetId === "wrist_elbow_stack_sin_max") {
    for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
      if (String(rule.id) === "wrist_elbow_stack") return rule;
    }
  }
  return null;
}

export function getCalibrationFocusInfo(
  cfg: Record<string, unknown>,
  opts: { soloIndex: number | null; sliderKey?: string },
): CalibrationFocusInfo | null {
  const sliders = pressCalibrationSliders(cfg);
  let sl: CalSliderDef | undefined;
  if (opts.sliderKey) {
    sl = sliders.find((s) => s.key === opts.sliderKey);
  } else if (opts.soloIndex != null) {
    sl = sliders.find((s) => s.soloIndex === opts.soloIndex);
  }

  if (sl?.key === "rep_top" || sl?.key === "rep_bottom") {
    return REP_FOCUS[sl.key] ?? null;
  }

  const targetId =
    sl?.targetId ??
    (opts.soloIndex != null ? soloRuleIdForIndex(cfg, opts.soloIndex) : null);
  if (!targetId) {
    if (opts.soloIndex === null) {
      return {
        id: "—",
        title: "Todas las reglas métricas",
        message:
          "Pulsa 3–8 para aislar una regla y ver su aviso. Fase 1 omitida en modo calibración.",
        phase: "execution",
      };
    }
    return null;
  }

  const entry = findConfigEntry(cfg, targetId);
  const setup = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  const inSetup = Boolean(
    (setup.checks as Record<string, unknown>[] | undefined)?.some(
      (c) => String(c.id) === targetId,
    ),
  );
  const id = entry ? String(entry.id ?? targetId) : targetId;
  const message = entry
    ? String(entry.message ?? "")
    : targetId === "wrist_elbow_stack_sin_max"
      ? "Alinea muñeca con el codo en la bajada."
      : "";
  return {
    id,
    title: sl?.label ?? id,
    message,
    phase: inSetup ? "setup" : "execution",
    sliderLabel: sl?.label,
  };
}

/** Al entrar en calibración: fase 2 y solo la primera regla de ejecución (slider 4). */
export const CALIBRATION_DEFAULT_SOLO = 4;

export function downloadCalibrationJson(
  exerciseId: string,
  patch: CalibrationPatch,
): void {
  const blob = new Blob([JSON.stringify(patch, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${exerciseId}_calibration.json`;
  a.click();
  URL.revokeObjectURL(url);
}
