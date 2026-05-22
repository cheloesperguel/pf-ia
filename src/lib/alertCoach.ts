export interface AlertCoachConfig {
  holdFrames: number;
  clearHoldFrames: number;
  ttsCooldownS: number;
  maxTtsPerMinute: number;
  hudMaxLines: number;
  speakOn: string;
  summaryIntervalS: number;
  useCoachingText: boolean;
}

interface RuleTrack {
  violationFrames: number;
  clearFrames: number;
  stableActive: boolean;
}

function priority(rule: Record<string, unknown>): number {
  return Number(rule.priority ?? 5);
}

export function buildRuleIndex(
  cfg: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const rule of (cfg.rules ?? []) as Record<string, unknown>[]) {
    const rid = String(rule.id ?? "");
    if (rid) out[rid] = rule;
  }
  return out;
}

export function parseAlertConfig(
  raw: Record<string, unknown> | null | undefined,
): AlertCoachConfig {
  const r = raw ?? {};
  return {
    holdFrames: Math.max(1, Math.min(30, Number(r.alert_hold_frames ?? 10))),
    clearHoldFrames: Math.max(
      1,
      Math.min(30, Number(r.alert_clear_hold_frames ?? 8)),
    ),
    ttsCooldownS: Number(r.alert_tts_cooldown_s ?? 18),
    maxTtsPerMinute: Math.max(
      1,
      Math.min(20, Number(r.alert_max_tts_per_minute ?? 4)),
    ),
    hudMaxLines: Math.max(1, Math.min(6, Number(r.hud_max_lines ?? 2))),
    speakOn: String(r.alert_speak_on ?? "enter"),
    summaryIntervalS: Number(r.alert_summary_interval_s ?? 25),
    useCoachingText: Boolean(r.use_coaching_text ?? true),
  };
}

export function filterByRequires(
  items: [string, string][],
  ruleById: Record<string, Record<string, unknown>>,
): [string, string][] {
  const active = new Set(items.map(([rid]) => rid));
  const out: [string, string][] = [];
  for (const [rid, msg] of items) {
    const reqs = (ruleById[rid]?.requires ?? []) as string[];
    if (reqs.some((r) => active.has(String(r)))) continue;
    out.push([rid, msg]);
  }
  out.sort(
    (a, b) =>
      priority(ruleById[a[0]] ?? {}) - priority(ruleById[b[0]] ?? {}),
  );
  return out;
}

export class AlertCoach {
  cfg: AlertCoachConfig;
  private tracks = new Map<string, RuleTrack>();
  private lastTtsAt = new Map<string, number>();
  private ttsTimestamps: number[] = [];
  private lastSummaryAt = 0;

  constructor(cfg: AlertCoachConfig) {
    this.cfg = cfg;
  }

  update(
    rawItems: [string, string][],
    ruleById: Record<string, Record<string, unknown>>,
  ): [string, string][] {
    const instantIds = new Set(rawItems.map(([rid]) => rid));

    for (const rid of [...this.tracks.keys()]) {
      if (!ruleById[rid] && !instantIds.has(rid)) this.tracks.delete(rid);
    }

    for (const rid of Object.keys(ruleById)) {
      if (!this.tracks.has(rid)) {
        this.tracks.set(rid, {
          violationFrames: 0,
          clearFrames: 0,
          stableActive: false,
        });
      }
    }

    for (const [rid, track] of this.tracks) {
      if (instantIds.has(rid)) {
        track.violationFrames += 1;
        track.clearFrames = 0;
        if (track.violationFrames >= this.cfg.holdFrames) {
          track.stableActive = true;
        }
      } else {
        track.violationFrames = 0;
        if (track.stableActive) {
          track.clearFrames += 1;
          if (track.clearFrames >= this.cfg.clearHoldFrames) {
            track.stableActive = false;
            track.clearFrames = 0;
          }
        } else {
          track.clearFrames = 0;
        }
      }
    }

    const msgMap = new Map(rawItems);
    const stable: [string, string][] = [];
    for (const [rid, track] of this.tracks) {
      if (track.stableActive) {
        let msg = msgMap.get(rid);
        if (msg === undefined && ruleById[rid]) {
          msg = String(ruleById[rid].message ?? rid);
        }
        if (msg) stable.push([rid, msg]);
      }
    }
    stable.sort(
      (a, b) =>
        priority(ruleById[a[0]] ?? {}) - priority(ruleById[b[0]] ?? {}),
    );
    return stable;
  }

  popTts(
    stableItems: [string, string][],
    ruleById: Record<string, Record<string, unknown>>,
  ): string | null {
    if (!stableItems.length) return null;
    const now = performance.now() / 1000;
    this.ttsTimestamps = this.ttsTimestamps.filter((t) => now - t < 60);
    if (this.ttsTimestamps.length >= this.cfg.maxTtsPerMinute) return null;

    if (this.cfg.speakOn === "summary") {
      if (now - this.lastSummaryAt < this.cfg.summaryIntervalS) return null;
      this.lastSummaryAt = now;
      return stableItems[0][1];
    }

    for (const [rid, msg] of stableItems) {
      const rule = ruleById[rid] ?? {};
      if (rule.tts_enabled === false) continue;
      const last = this.lastTtsAt.get(rid) ?? 0;
      if (now - last < this.cfg.ttsCooldownS) continue;
      const track = this.tracks.get(rid);
      if (track && track.violationFrames === this.cfg.holdFrames) {
        this.lastTtsAt.set(rid, now);
        this.ttsTimestamps.push(now);
        return msg;
      }
    }
    return null;
  }

  hudItems(stableItems: [string, string][]): {
    shown: [string, string][];
    overflow: string | null;
  } {
    const maxN = Math.max(1, this.cfg.hudMaxLines);
    if (stableItems.length <= maxN) {
      return { shown: stableItems, overflow: null };
    }
    return {
      shown: stableItems.slice(0, maxN),
      overflow: `+${stableItems.length - maxN} avisos`,
    };
  }

  clearTracks(): void {
    this.tracks.clear();
  }
}
