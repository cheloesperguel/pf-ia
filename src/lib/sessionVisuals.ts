import { forearmStackSinNorm } from "./poseMath";
import { PL, type LandmarkLike } from "./poseLandmarks";

const GHOST_EDGES: [number, number][] = [
  [PL.LEFT_SHOULDER, PL.RIGHT_SHOULDER],
  [PL.LEFT_SHOULDER, PL.LEFT_ELBOW],
  [PL.LEFT_ELBOW, PL.LEFT_WRIST],
  [PL.RIGHT_SHOULDER, PL.RIGHT_ELBOW],
  [PL.RIGHT_ELBOW, PL.RIGHT_WRIST],
];

function withMirror(
  ctx: CanvasRenderingContext2D,
  w: number,
  mirror: boolean,
  fn: () => void,
): void {
  if (mirror) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  fn();
  if (mirror) ctx.restore();
}

function pix(
  norm: LandmarkLike[],
  idx: number,
  w: number,
  h: number,
): [number, number] | null {
  const lm = norm[idx];
  if (lm?.x == null || lm.y == null) return null;
  return [lm.x * w, lm.y * h];
}

function shoulderFrame(
  norm: LandmarkLike[],
): { mid: [number, number]; sw: number } | null {
  const ls = norm[PL.LEFT_SHOULDER];
  const rs = norm[PL.RIGHT_SHOULDER];
  if (ls?.x == null || ls.y == null || rs?.x == null || rs?.y == null) {
    return null;
  }
  const mid: [number, number] = [
    (ls.x + rs.x) / 2,
    (ls.y + rs.y) / 2,
  ];
  const sw = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  if (sw < 0.04) return null;
  return { mid, sw };
}

function drawReferencePoseGhost(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  norm: LandmarkLike[],
  referencePose: Record<string, unknown>,
): void {
  const frame = shoulderFrame(norm);
  if (!frame) return;
  const tpl = (referencePose.landmarks ?? {}) as Record<
    string,
    { x?: number; y?: number }
  >;
  const tplXY = (name: string): [number, number] | null => {
    const p = tpl[name];
    if (p?.x == null || p?.y == null) return null;
    return [p.x, p.y];
  };
  const lsT = tplXY("LEFT_SHOULDER");
  const rsT = tplXY("RIGHT_SHOULDER");
  if (!lsT || !rsT) return;
  const tplMid: [number, number] = [
    (lsT[0] + rsT[0]) / 2,
    (lsT[1] + rsT[1]) / 2,
  ];
  const tplSw = Math.hypot(rsT[0] - lsT[0], rsT[1] - lsT[1]);
  if (tplSw < 1e-6) return;
  const scale = frame.sw / tplSw;

  const idMap: Record<string, number> = {
    LEFT_SHOULDER: PL.LEFT_SHOULDER,
    RIGHT_SHOULDER: PL.RIGHT_SHOULDER,
    LEFT_ELBOW: PL.LEFT_ELBOW,
    RIGHT_ELBOW: PL.RIGHT_ELBOW,
    LEFT_WRIST: PL.LEFT_WRIST,
    RIGHT_WRIST: PL.RIGHT_WRIST,
  };

  const mapped = new Map<number, [number, number]>();
  for (const [name, idx] of Object.entries(idMap)) {
    const xy = tplXY(name);
    if (!xy) continue;
    const nx = frame.mid[0] + (xy[0] - tplMid[0]) * scale;
    const ny = frame.mid[1] + (xy[1] - tplMid[1]) * scale;
    mapped.set(idx, [nx * w, ny * h]);
  }

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#dcffb4";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const [a, b] of GHOST_EDGES) {
    const p0 = mapped.get(a);
    const p1 = mapped.get(b);
    if (!p0 || !p1) continue;
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  }
  ctx.fillStyle = "#dcffb4";
  for (const p of mapped.values()) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(200,255,220,0.9)";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText("Silueta de partida", 10, h - 24);
}

function drawForearmOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  norm: LandmarkLike[],
  threshold: number,
  tSec: number,
  pulseHz: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * pulseHz * tSec);
  const thickBad = 2 + 5 * pulse;
  let anyBad = false;

  const pairs: [number, number, string][] = [
    [PL.LEFT_ELBOW, PL.LEFT_WRIST, "Izq"],
    [PL.RIGHT_ELBOW, PL.RIGHT_WRIST, "Der"],
  ];

  for (const [ei, wi, label] of pairs) {
    const el = norm[ei];
    const wr = norm[wi];
    if (!el || !wr) continue;
    const err = forearmStackSinNorm(el, wr);
    const p0 = pix(norm, ei, w, h);
    const p1 = pix(norm, wi, w, h);
    if (!p0 || !p1) continue;

    if (Number.isFinite(err) && err > threshold) {
      anyBad = true;
      const r = Math.min(255, 180 + Math.floor(75 * pulse));
      const g = Math.floor(60 + 20 * pulse);
      const b = Math.floor(40 + 15 * pulse);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = thickBad;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      const rad = 5 + 2 * pulse;
      for (const p of [p0, p1]) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = "#ff6b6b";
      const mx = (p0[0] + p1[0]) / 2;
      const my = (p0[1] + p1[1]) / 2;
      ctx.fillText(`Muñeca–codo (${label})`, Math.max(8, mx - 60), Math.max(20, my - 12));
    } else {
      ctx.strokeStyle = "rgba(120,230,140,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    }
  }

  if (anyBad) {
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Alineación vertical: corrige", w / 2, h - 40);
    ctx.textAlign = "left";
  }
}

function drawBarRackGuide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  norm: LandmarkLike[],
  metrics: Record<string, number>,
  guide: Record<string, unknown>,
): void {
  if ((metrics.bar_proxy_visible ?? 0) < 1) {
    ctx.fillStyle = "rgba(180,200,255,0.95)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("Barra: muestra muñecas en agarre", 10, 28);
    return;
  }

  const noseLo = Number(guide.below_nose_min ?? 0.04);
  const noseHi = Number(guide.below_nose_max ?? 0.22);
  const shHi = Number(guide.vs_shoulder_max ?? 0.12);

  const pL = pix(norm, PL.LEFT_WRIST, w, h);
  const pR = pix(norm, PL.RIGHT_WRIST, w, h);
  const pN = pix(norm, PL.NOSE, w, h);
  const pSl = pix(norm, PL.LEFT_SHOULDER, w, h);
  const pSr = pix(norm, PL.RIGHT_SHOULDER, w, h);
  if (!pL || !pR || !pN || !pSl || !pSr) return;

  const barY = (pL[1] + pR[1]) / 2;
  const shoulderY = (pSl[1] + pSr[1]) / 2;

  ctx.strokeStyle = "rgba(255,200,80,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pL[0], pL[1]);
  ctx.lineTo(pR[0], pR[1]);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,200,80,0.95)";
  ctx.beginPath();
  ctx.arc((pL[0] + pR[0]) / 2, barY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(120,220,120,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(w, shoulderY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(200,200,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(pN[0] - 40, pN[1]);
  ctx.lineTo(pN[0] + 40, pN[1]);
  ctx.stroke();

  const belowNose = metrics.bar_below_nose_norm;
  const vsSh = metrics.bar_vs_shoulder_y;
  const okNose =
    Number.isFinite(belowNose) && belowNose >= noseLo && belowNose <= noseHi;
  const okSh = Number.isFinite(vsSh) && vsSh >= -0.03 && vsSh <= shHi;
  ctx.fillStyle = okNose && okSh ? "#8cff9a" : "#b4c8ff";
  ctx.font = "13px monospace, system-ui, sans-serif";
  const lines = [
    "Barra (muñecas): línea amarilla",
    `Debajo nariz: ${Number.isFinite(belowNose) ? belowNose.toFixed(2) : "—"}  obj ${noseLo.toFixed(2)}-${noseHi.toFixed(2)}`,
    `Vs hombros: ${Number.isFinite(vsSh) ? vsSh.toFixed(2) : "—"}  max ${shHi.toFixed(2)}`,
  ];
  let y = 24;
  for (const line of lines) {
    ctx.fillText(line, 10, y);
    y += 18;
  }
}

function drawElbowZPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  metrics: Record<string, number>,
  target: { min?: number; max?: number },
): void {
  const zmin = metrics.elbow_z_offset_min;
  const zmax = metrics.elbow_z_offset_max;
  const lat = metrics.elbow_scapular_lateral_frac_max;
  const fwd = metrics.elbow_scapular_forward_frac_min;
  if (
    !Number.isFinite(zmin) &&
    !Number.isFinite(zmax) &&
    !Number.isFinite(lat) &&
    !Number.isFinite(fwd)
  ) {
    return;
  }
  const lo = Number(target.min ?? 0.02);
  const hi = Number(target.max ?? 0.1);
  const lines: string[] = ["— Métricas 3D —"];
  if (Number.isFinite(zmin)) lines.push(`ΔZ min: ${zmin >= 0 ? "+" : ""}${zmin.toFixed(3)}`);
  if (Number.isFinite(zmax) && zmax !== zmin) {
    lines.push(`ΔZ max: ${zmax >= 0 ? "+" : ""}${zmax.toFixed(3)}`);
  }
  if (Number.isFinite(zmin) || Number.isFinite(zmax)) {
    lines.push(`Z objetivo: ${lo.toFixed(2)} a ${hi.toFixed(2)}`);
  }
  if (Number.isFinite(lat)) lines.push(`Plano esc lat: ${lat.toFixed(2)}`);
  if (Number.isFinite(fwd)) lines.push(`Plano esc adel: ${fwd.toFixed(2)}`);

  ctx.font = "12px monospace, system-ui, sans-serif";
  ctx.fillStyle = "rgba(220,240,255,0.95)";
  ctx.textAlign = "right";
  let y = 22;
  const x = w - 10;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += 16;
  }
  ctx.textAlign = "left";
}

export function drawPhaseAngleBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  angle: number,
  label: string,
): void {
  if (!Number.isFinite(angle)) return;
  const text = `${label}: ${angle.toFixed(0)}°`;
  ctx.font = "bold 28px system-ui, sans-serif";
  const tw = ctx.measureText(text).width;
  const x = (w - tw) / 2;
  const y = h - 28;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 12, y - 32, tw + 24, 40);
  ctx.fillStyle = "#5eead4";
  ctx.fillText(text, x, y);
}

export function drawPoseStatusBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  message: string,
): void {
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  const tw = ctx.measureText(message).width;
  const x = (w - tw) / 2;
  const y = h / 2;
  ctx.fillRect(x - 10, y - 22, tw + 20, 32);
  ctx.fillStyle = "#fde68a";
  ctx.fillText(message, x, y);
}

export interface SessionVisualOptions {
  cfg: Record<string, unknown>;
  phase: "setup" | "execution";
  phaseAngle: number;
  angleLabel: string;
  metrics: Record<string, number>;
  tSec: number;
}

export function drawSessionVisuals(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mirror: boolean,
  norm: LandmarkLike[],
  opts: SessionVisualOptions,
): void {
  const setupPose = (opts.cfg.setup_pose ?? {}) as Record<string, unknown>;
  const visual = (opts.cfg.visual ?? {}) as Record<string, unknown>;

  if (opts.phase === "setup") {
    const showGhost = setupPose.show_reference_pose !== false;
    const ref = setupPose.reference_pose as Record<string, unknown> | undefined;
    if (showGhost && ref) {
      withMirror(ctx, w, mirror, () =>
        drawReferencePoseGhost(ctx, w, h, norm, ref),
      );
    }
  } else {
    const thresh = Number(visual.wrist_elbow_stack_sin_max ?? 0.13);
    const pulseHz = Number(visual.pulse_hz ?? 2.2);
    withMirror(ctx, w, mirror, () =>
      drawForearmOverlay(ctx, w, h, norm, thresh, opts.tSec, pulseHz),
    );

    if (visual.show_bar_guide !== false) {
      const guide = (visual.bar_rack_guide ?? {}) as Record<string, unknown>;
      withMirror(ctx, w, mirror, () =>
        drawBarRackGuide(ctx, w, h, norm, opts.metrics, guide),
      );
    }

    if (visual.show_elbow_z !== false) {
      const target = (visual.elbow_z_offset_target ?? {}) as {
        min?: number;
        max?: number;
      };
      drawElbowZPanel(ctx, w, opts.metrics, target);
    }

    drawPhaseAngleBanner(ctx, w, h, opts.phaseAngle, opts.angleLabel);
  }
}
