import { PL, type LandmarkLike } from "./poseLandmarks";

const NaN_ = Number.NaN;

function np3(lm: LandmarkLike): [number, number, number] {
  return [lm.x ?? 0, lm.y ?? 0, lm.z ?? 0];
}

export function angleAtVertexDeg(
  a: LandmarkLike,
  b: LandmarkLike,
  c: LandmarkLike,
): number {
  const [ax, ay, az] = np3(a);
  const [bx, by, bz] = np3(b);
  const [cx, cy, cz] = np3(c);
  let vax = ax - bx;
  let vay = ay - by;
  let vaz = az - bz;
  let vcx = cx - bx;
  let vcy = cy - by;
  let vcz = cz - bz;
  const na = Math.hypot(vax, vay, vaz);
  const nc = Math.hypot(vcx, vcy, vcz);
  if (na < 1e-9 || nc < 1e-9) return NaN_;
  vax /= na;
  vay /= na;
  vaz /= na;
  vcx /= nc;
  vcy /= nc;
  vcz /= nc;
  const cosT = Math.max(
    -1,
    Math.min(1, vax * vcx + vay * vcy + vaz * vcz),
  );
  return (Math.acos(cosT) * 180) / Math.PI;
}

export function visible(n: LandmarkLike | undefined, thr = 0.5): boolean {
  if (!n) return false;
  const v = n.visibility;
  return v === undefined || v >= thr;
}

export function visScore(n: LandmarkLike | undefined): number {
  if (!n) return 0;
  return n.visibility ?? 1;
}

export function isFrontalView(
  norm: LandmarkLike[],
  cfg: Record<string, unknown>,
): boolean {
  const ls = norm[PL.LEFT_SHOULDER];
  const rs = norm[PL.RIGHT_SHOULDER];
  const minSv = Number(cfg.min_shoulder_pair_visibility ?? 0.35);
  if (!visible(ls, minSv) || !visible(rs, minSv)) return false;
  const sx = Math.abs((ls.x ?? 0) - (rs.x ?? 0));
  const minSx = Number(cfg.min_shoulder_width_norm ?? 0.11);
  if (sx < minSx) return false;

  if (cfg.require_hips === false) return true;

  const lh = norm[PL.LEFT_HIP];
  const rh = norm[PL.RIGHT_HIP];
  const minHv = Number(cfg.min_hip_pair_visibility ?? 0.35);
  if (!visible(lh, minHv) || !visible(rh, minHv)) return false;
  const hx = Math.abs((lh.x ?? 0) - (rh.x ?? 0));
  const ratioMin = Number(cfg.min_shoulder_hip_width_ratio ?? 0.78);
  return sx / Math.max(hx, 0.025) >= ratioMin;
}

export function bothArmsVisible(
  norm: LandmarkLike[],
  cfg: Record<string, unknown> = {},
): boolean {
  const t = Number(cfg.min_visibility ?? 0.38);
  const pairs: [number, number, number][] = [
    [PL.LEFT_SHOULDER, PL.LEFT_ELBOW, PL.LEFT_WRIST],
    [PL.RIGHT_SHOULDER, PL.RIGHT_ELBOW, PL.RIGHT_WRIST],
  ];
  for (const [sh, el, wr] of pairs) {
    if (
      !visible(norm[sh], t) ||
      !visible(norm[el], t) ||
      !visible(norm[wr], t)
    ) {
      return false;
    }
  }
  return true;
}

function armChainVisible(
  norm: LandmarkLike[],
  shoulderI: number,
  elbowI: number,
  wristI: number,
  minVis: number,
): boolean {
  return (
    visible(norm[shoulderI], minVis) &&
    visible(norm[elbowI], minVis) &&
    visible(norm[wristI], minVis)
  );
}

function shoulderMidXz(
  world: LandmarkLike[],
): [number, number] | null {
  const lsw = world[PL.LEFT_SHOULDER];
  const rsw = world[PL.RIGHT_SHOULDER];
  if (lsw.x === undefined || rsw.x === undefined) return null;
  return [
    ((lsw.x ?? 0) + (rsw.x ?? 0)) / 2,
    ((lsw.z ?? 0) + (rsw.z ?? 0)) / 2,
  ];
}

function elbowScapularFracsSide(
  shoulderW: LandmarkLike,
  elbowW: LandmarkLike,
  midXz: [number, number],
): [number, number] {
  const [midX, midZ] = midXz;
  const armX = (elbowW.x ?? 0) - (shoulderW.x ?? 0);
  const armZ = (elbowW.z ?? 0) - (shoulderW.z ?? 0);
  const latX = (shoulderW.x ?? 0) - midX;
  const latZ = (shoulderW.z ?? 0) - midZ;
  const armLen = Math.hypot(armX, armZ);
  const latLen = Math.hypot(latX, latZ);
  if (armLen < 1e-5 || latLen < 1e-5) return [NaN_, NaN_];
  const armU: [number, number] = [armX / armLen, armZ / armLen];
  const latU: [number, number] = [latX / latLen, latZ / latLen];
  const lateralFrac = Math.abs(armU[0] * latU[0] + armU[1] * latU[1]);
  const fwdA: [number, number] = [-latU[1], latU[0]];
  const fwdB: [number, number] = [latU[1], -latU[0]];
  const forwardFrac = Math.max(
    0,
    Math.max(
      armU[0] * fwdA[0] + armU[1] * fwdA[1],
      armU[0] * fwdB[0] + armU[1] * fwdB[1],
    ),
  );
  return [lateralFrac, forwardFrac];
}

function elbowScapularLateralFracMax(
  norm: LandmarkLike[],
  world: LandmarkLike[],
  minVis: number,
): number {
  const mid = shoulderMidXz(world);
  if (!mid) return NaN_;
  const fracs: number[] = [];
  if (
    armChainVisible(norm, PL.LEFT_SHOULDER, PL.LEFT_ELBOW, PL.LEFT_WRIST, minVis)
  ) {
    const [lat] = elbowScapularFracsSide(
      world[PL.LEFT_SHOULDER],
      world[PL.LEFT_ELBOW],
      mid,
    );
    if (!Number.isNaN(lat)) fracs.push(lat);
  }
  if (
    armChainVisible(
      norm,
      PL.RIGHT_SHOULDER,
      PL.RIGHT_ELBOW,
      PL.RIGHT_WRIST,
      minVis,
    )
  ) {
    const [lat] = elbowScapularFracsSide(
      world[PL.RIGHT_SHOULDER],
      world[PL.RIGHT_ELBOW],
      mid,
    );
    if (!Number.isNaN(lat)) fracs.push(lat);
  }
  return fracs.length ? Math.max(...fracs) : NaN_;
}

function elbowScapularForwardFracMin(
  norm: LandmarkLike[],
  world: LandmarkLike[],
  minVis: number,
): number {
  const mid = shoulderMidXz(world);
  if (!mid) return NaN_;
  const fracs: number[] = [];
  if (
    armChainVisible(norm, PL.LEFT_SHOULDER, PL.LEFT_ELBOW, PL.LEFT_WRIST, minVis)
  ) {
    const [, fwd] = elbowScapularFracsSide(
      world[PL.LEFT_SHOULDER],
      world[PL.LEFT_ELBOW],
      mid,
    );
    if (!Number.isNaN(fwd)) fracs.push(fwd);
  }
  if (
    armChainVisible(
      norm,
      PL.RIGHT_SHOULDER,
      PL.RIGHT_ELBOW,
      PL.RIGHT_WRIST,
      minVis,
    )
  ) {
    const [, fwd] = elbowScapularFracsSide(
      world[PL.RIGHT_SHOULDER],
      world[PL.RIGHT_ELBOW],
      mid,
    );
    if (!Number.isNaN(fwd)) fracs.push(fwd);
  }
  return fracs.length ? Math.min(...fracs) : NaN_;
}

function forearmStackSinNorm(el: LandmarkLike, wr: LandmarkLike): number {
  const dx = (wr.x ?? 0) - (el.x ?? 0);
  const dy = (wr.y ?? 0) - (el.y ?? 0);
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return NaN_;
  return Math.abs(dx) / length;
}

function maxFinite(...values: number[]): number {
  const ok = values.filter((v) => !Number.isNaN(v));
  return ok.length ? Math.max(...ok) : NaN_;
}

function repElbowAngleDeg(
  norm: LandmarkLike[],
  world: LandmarkLike[],
  minVis: number,
): [number, string | null] {
  const lsw = world[PL.LEFT_SHOULDER];
  const rsw = world[PL.RIGHT_SHOULDER];
  const lew = world[PL.LEFT_ELBOW];
  const rew = world[PL.RIGHT_ELBOW];
  const lww = world[PL.LEFT_WRIST];
  const rww = world[PL.RIGHT_WRIST];

  const okL = armChainVisible(
    norm,
    PL.LEFT_SHOULDER,
    PL.LEFT_ELBOW,
    PL.LEFT_WRIST,
    minVis,
  );
  const okR = armChainVisible(
    norm,
    PL.RIGHT_SHOULDER,
    PL.RIGHT_ELBOW,
    PL.RIGHT_WRIST,
    minVis,
  );

  const angL = okL ? angleAtVertexDeg(lsw, lew, lww) : NaN_;
  const angR = okR ? angleAtVertexDeg(rsw, rew, rww) : NaN_;

  if (okL && okR && !Number.isNaN(angL) && !Number.isNaN(angR)) {
    return [Math.min(angL, angR), "both"];
  }
  if (okL && !Number.isNaN(angL)) return [angL, "left"];
  if (okR && !Number.isNaN(angR)) return [angR, "right"];
  return [NaN_, null];
}

export function computePressMetrics(
  norm: LandmarkLike[],
  world: LandmarkLike[],
  minVisRep = 0.45,
): Record<string, number> {
  const ls = norm[PL.LEFT_SHOULDER];
  const rs = norm[PL.RIGHT_SHOULDER];
  const le = norm[PL.LEFT_ELBOW];
  const re = norm[PL.RIGHT_ELBOW];
  const lw = norm[PL.LEFT_WRIST];
  const rw = norm[PL.RIGHT_WRIST];
  const lsw = world[PL.LEFT_SHOULDER];
  const rsw = world[PL.RIGHT_SHOULDER];
  const lew = world[PL.LEFT_ELBOW];
  const rew = world[PL.RIGHT_ELBOW];
  const lww = world[PL.LEFT_WRIST];
  const rww = world[PL.RIGHT_WRIST];

  const out: Record<string, number> = {};
  out.elbow_angle_left_deg = angleAtVertexDeg(lsw, lew, lww);
  out.elbow_angle_right_deg = angleAtVertexDeg(rsw, rew, rww);

  const [repAng, repSide] = repElbowAngleDeg(norm, world, minVisRep);
  out.elbow_angle_min_deg = repAng;
  out.rep_landmarks_reliable = repSide !== null ? 1 : 0;

  out.elbow_below_shoulder_min_norm = Math.min(
    (le.y ?? 0) - (ls.y ?? 0),
    (re.y ?? 0) - (rs.y ?? 0),
  );
  out.elbow_scapular_lateral_frac_max = elbowScapularLateralFracMax(
    norm,
    world,
    minVisRep,
  );
  out.elbow_scapular_forward_frac_min = elbowScapularForwardFracMin(
    norm,
    world,
    minVisRep,
  );

  const sinImgL = forearmStackSinNorm(le, lw);
  const sinImgR = forearmStackSinNorm(re, rw);
  out.wrist_elbow_stack_sin_left = sinImgL;
  out.wrist_elbow_stack_sin_right = sinImgR;
  out.wrist_elbow_stack_sin_max = maxFinite(sinImgL, sinImgR);

  return out;
}
