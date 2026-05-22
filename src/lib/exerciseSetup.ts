export type Phase = "setup" | "execution";

export function setupEnabled(cfg: Record<string, unknown>): boolean {
  const sp = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  return Boolean(sp.enabled);
}

export function setupHoldMs(cfg: Record<string, unknown>): number {
  const sp = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  return Number(sp.hold_ms ?? 1500);
}

export function setupPositionLabel(cfg: Record<string, unknown>): string {
  const pos = String(
    ((cfg.setup_pose ?? {}) as Record<string, unknown>).position ?? "",
  )
    .trim()
    .toLowerCase();
  if (pos === "seated") return "sentado";
  if (pos === "standing") return "de pie";
  return pos;
}

function metricViolated(value: number, op: string, threshold: number): boolean {
  if (Number.isNaN(value)) return false;
  if (op === "gte") return value < threshold;
  if (op === "lte") return value > threshold;
  throw new Error(`op desconocido: ${op}`);
}

export function evaluateSetupChecks(
  cfg: Record<string, unknown>,
  viewOk: boolean,
  trackingOk: boolean,
  metrics: Record<string, number>,
  refLegOk = true,
): [boolean, [string, string][]] {
  const setup = (cfg.setup_pose ?? {}) as Record<string, unknown>;
  const checks = setup.checks as Record<string, unknown>[] | undefined;
  if (!checks?.length) return [true, []];

  const failures: [string, string][] = [];
  for (const chk of checks) {
    const cid = String(chk.id ?? chk.kind ?? "check");
    const msg = String(chk.message ?? "Ajusta la pose inicial.");
    const kind = chk.kind;

    if (kind === "frontal" || kind === "profile") {
      if (!viewOk) failures.push([cid, msg]);
    } else if (kind === "visibility_both_arms") {
      if (!trackingOk) failures.push([cid, msg]);
    } else if (kind === "visibility_ref_leg") {
      if (!trackingOk || !refLegOk) failures.push([cid, msg]);
    } else if (kind === "metric") {
      const mname = String(chk.metric);
      const val = metrics[mname] ?? NaN;
      const op = String(chk.op ?? "gte");
      const threshold = Number(chk.value);
      if (metricViolated(val, op, threshold)) failures.push([cid, msg]);
    } else {
      failures.push([cid, msg]);
    }
  }
  return [failures.length === 0, failures];
}

export class SetupGate {
  readonly enabled: boolean;
  readonly holdMs: number;
  private okSince: number | null = null;
  private goSpoken = false;

  constructor(cfg: Record<string, unknown>) {
    this.enabled = setupEnabled(cfg);
    this.holdMs = setupHoldMs(cfg);
  }

  get phase(): Phase {
    if (!this.enabled || this.goSpoken) return "execution";
    return "setup";
  }

  holdProgress(): number {
    if (this.okSince === null) return 0;
    const elapsed = performance.now() - this.okSince;
    return Math.min(1, elapsed / Math.max(this.holdMs, 1));
  }

  /** true = pasar a ejecución */
  update(allOk: boolean): boolean {
    if (!this.enabled) return true;
    if (this.goSpoken) return true;
    const now = performance.now();
    if (allOk) {
      if (this.okSince === null) this.okSince = now;
      else if (now - this.okSince >= this.holdMs) {
        this.goSpoken = true;
        return true;
      }
    } else {
      this.okSince = null;
    }
    return false;
  }

  skip(): void {
    this.goSpoken = true;
    this.okSince = null;
  }
}
