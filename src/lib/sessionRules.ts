export function metricViolated(
  value: number,
  op: string,
  threshold: number,
): boolean {
  if (Number.isNaN(value)) return false;
  if (op === "gte") return value < threshold;
  if (op === "lte") return value > threshold;
  throw new Error(`op desconocido: ${op}`);
}

export function collectAlertItems(
  cfg: Record<string, unknown>,
  viewOk: boolean,
  trackingOk: boolean,
  metrics: Record<string, number>,
  showForm: boolean,
): [string, string][] {
  const items: [string, string][] = [];
  const formOk = viewOk && trackingOk;

  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    const kind = rule.kind;
    const rid = String(rule.id ?? kind);
    const msg = String(rule.message ?? "");
    if (kind === "profile" || kind === "frontal") {
      if (rule.blocks_rep !== false && !viewOk) items.push([rid, msg]);
    } else if (kind === "visibility_ref_leg" || kind === "visibility_both_arms") {
      if (!trackingOk) items.push([rid, msg]);
    } else if (kind === "metric") {
      if (!showForm || !formOk) continue;
      if (rule.phase !== undefined && rule.phase !== "bottom") continue;
      const mname = String(rule.metric);
      const val = metrics[mname] ?? NaN;
      if (Number.isNaN(val)) continue;
      if (
        metricViolated(val, String(rule.op), Number(rule.value))
      ) {
        items.push([rid, msg]);
      }
    }
  }
  return items;
}

export function validateBottomSnapshot(
  cfg: Record<string, unknown>,
  snapshot: Record<string, number>,
): [boolean, string[], string[]] {
  const failedMsgs: string[] = [];
  const failedIds: string[] = [];
  const snap: Record<string, number> = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (!k.startsWith("_")) snap[k] = v;
  }

  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    if (!rule.blocks_rep) continue;
    if (rule.kind !== "metric" || rule.phase !== "bottom") continue;
    const val = snap[String(rule.metric)] ?? NaN;
    if (Number.isNaN(val)) continue;
    if (
      metricViolated(val, String(rule.op), Number(rule.value))
    ) {
      failedMsgs.push(String(rule.message ?? ""));
      const rid = String(rule.id ?? "");
      if (rid) failedIds.push(rid);
    }
  }
  return [failedMsgs.length === 0, failedMsgs, failedIds];
}
