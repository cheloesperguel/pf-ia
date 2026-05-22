export interface WorkoutProgram {
  programId: string;
  displayName: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  extraRestSeconds: number;
  listenSeconds: number;
  introTts: string;
  setStartTts: string;
  restEndTts: string;
  workoutDoneTts: string;
  extraRestTts: string;
  readyTts: string;
  noHearTts: string;
}

export interface SetErrorRecord {
  ruleId: string;
  message: string;
  count: number;
}

export type WorkoutPhase =
  | "intro"
  | "set_active"
  | "rest"
  | "rest_prompt"
  | "done";

export function parseWorkoutProgram(data: Record<string, unknown>): WorkoutProgram {
  return {
    programId: String(data.program_id ?? "workout"),
    displayName: String(data.display_name ?? "Entrenamiento"),
    sets: Math.max(1, Number(data.sets ?? 4)),
    repsPerSet: Math.max(1, Number(data.reps_per_set ?? 12)),
    restSeconds: Math.max(10, Number(data.rest_seconds ?? 60)),
    extraRestSeconds: Math.max(10, Number(data.extra_rest_seconds ?? 60)),
    listenSeconds: Number(data.listen_seconds ?? 6),
    introTts: String(data.intro_tts ?? ""),
    setStartTts: String(data.set_start_tts ?? "Serie {set}."),
    restEndTts: String(
      data.rest_end_tts ??
        "Vamos a la serie {next_set}. ¿Listo o necesitas otro minuto?",
    ),
    workoutDoneTts: String(data.workout_done_tts ?? "Programa terminado."),
    extraRestTts: String(data.extra_rest_tts ?? "Otro minuto de descanso."),
    readyTts: String(data.ready_tts ?? "Listo. Serie {set}."),
    noHearTts: String(
      data.no_hear_tts ?? "No te escuché. Di listo o pide otro minuto.",
    ),
  };
}

export function fmtTemplate(template: string, vars: Record<string, string | number>): string {
  try {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = vars[key];
      return v !== undefined ? String(v) : `{${key}}`;
    });
  } catch {
    return template;
  }
}

function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function classifyReadinessLocal(text: string): "ready" | "more_rest" | "unclear" {
  const t = normText(text.trim());
  if (!t || t.length < 2) return "unclear";
  if (
    /\b(listo|lista|dale|vamos|si|sí|ok|okay|ya|empezamos|continua|continúa|adelante)\b/.test(
      t,
    )
  ) {
    return "ready";
  }
  if (
    /\b(minuto|minutos|mas|más|tiempo|espera|descansa|todavia|todavía|otro)\b/.test(t)
  ) {
    return "more_rest";
  }
  return "unclear";
}

export async function classifyReadiness(
  text: string,
  gptFn?: (t: string) => Promise<string>,
): Promise<"ready" | "more_rest" | "unclear"> {
  const local = classifyReadinessLocal(text);
  if (local !== "unclear" || !gptFn || !text.trim()) return local;
  try {
    const raw = (await gptFn(text.trim())).toLowerCase();
    if (raw.includes("more") || raw.includes("minuto") || raw.includes("tiempo")) {
      return "more_rest";
    }
    if (raw.includes("ready") || raw.includes("listo")) return "ready";
    return "unclear";
  } catch {
    return local;
  }
}

export interface WorkoutHudSnapshot {
  active: boolean;
  phase: WorkoutPhase;
  displayName: string;
  currentSet: number;
  totalSets: number;
  repsInSet: number;
  repsPerSet: number;
  restSecondsLeft: number;
  /** Duración total del descanso actual (para barra de progreso). */
  restSecondsTotal: number;
  hudNote: string;
  statusText: string;
  voiceBusy: boolean;
}

export interface WorkoutGuideDeps {
  onSpeak: (text: string) => void;
  /** Resumen IA tras serie; no debe ser cortado por avisos de forma. */
  onSpeakCoach?: (text: string) => void;
  onListen: (seconds: number) => Promise<string>;
  onSummarize: (errs: SetErrorRecord[], setNum: number) => Promise<string>;
  onStatus?: (msg: string) => void;
  classifyFn?: (
    transcript: string,
  ) => Promise<"ready" | "more_rest" | "unclear">;
}

export class WorkoutGuide {
  readonly prog: WorkoutProgram;
  phase: WorkoutPhase = "intro";
  currentSet = 1;
  repsInSet = 0;
  private sessionRepBase = 0;
  private restEndAt = 0;
  private restDurationSeconds = 60;
  private setErrors: SetErrorRecord[] = [];
  private errorIndex = new Map<string, SetErrorRecord>();
  voiceBusy = false;
  private pendingIntro = true;
  private pendingSetStart = false;
  private pendingRepAlign = false;
  hudNote = "";

  private deps: WorkoutGuideDeps;

  constructor(program: WorkoutProgram, deps: WorkoutGuideDeps) {
    this.prog = program;
    this.deps = deps;
  }

  get isSetActive(): boolean {
    return this.phase === "set_active";
  }

  allowsRepCounting(): boolean {
    return this.phase === "set_active" && !this.voiceBusy;
  }

  get needsRepAlign(): boolean {
    return this.pendingRepAlign;
  }

  consumeRepAlign(totalReps: number): void {
    this.sessionRepBase = totalReps;
    this.repsInSet = 0;
    this.pendingRepAlign = false;
  }

  startAfterSetup(): void {
    this.pendingIntro = true;
  }

  onSessionRepCount(totalReps: number): boolean {
    if (!this.allowsRepCounting()) return false;
    this.repsInSet = totalReps - this.sessionRepBase;
    if (this.repsInSet >= this.prog.repsPerSet) {
      void this.finishSet();
      return true;
    }
    return false;
  }

  noteAlerts(items: [string, string][]): void {
    if (this.phase !== "set_active") return;
    for (const [rid, msg] of items) {
      const prev = this.errorIndex.get(rid);
      if (prev) prev.count += 1;
      else {
        const rec = { ruleId: rid, message: msg, count: 1 };
        this.errorIndex.set(rid, rec);
        this.setErrors.push(rec);
      }
    }
  }

  noteRepReject(failedIds: string[], messages: string[]): void {
    if (this.phase !== "set_active") return;
    failedIds.forEach((fid, i) => {
      this.noteAlerts([[fid, messages[i] ?? fid]]);
    });
  }

  tick(now = performance.now() / 1000): void {
    if (this.pendingIntro) {
      this.pendingIntro = false;
      this.deps.onSpeak(this.prog.introTts);
      this.beginSet();
      return;
    }
    if (this.pendingSetStart) {
      this.pendingSetStart = false;
      this.deps.onSpeak(
        fmtTemplate(this.prog.setStartTts, {
          set: this.currentSet,
          total_sets: this.prog.sets,
        }),
      );
      return;
    }
    if (this.phase === "rest" && now >= this.restEndAt) {
      this.phase = "rest_prompt";
      void this.triggerRestPrompt();
    }
  }

  private beginSet(): void {
    this.phase = "set_active";
    this.repsInSet = 0;
    this.setErrors = [];
    this.errorIndex.clear();
    this.pendingSetStart = true;
    this.pendingRepAlign = true;
    this.deps.onStatus?.(
      `Serie ${this.currentSet}/${this.prog.sets} — meta ${this.prog.repsPerSet} reps`,
    );
  }

  private async finishSet(): Promise<void> {
    this.phase = "rest";
    this.restDurationSeconds = this.prog.restSeconds;
    this.restEndAt = performance.now() / 1000 + this.restDurationSeconds;
    this.deps.onStatus?.("Descanso");
    const errs = [...this.setErrors];
    if (errs.length) {
      this.voiceBusy = true;
      try {
        const text = await this.deps.onSummarize(errs, this.currentSet);
        if (text) {
          const say = this.deps.onSpeakCoach ?? this.deps.onSpeak;
          say(text);
        }
      } finally {
        this.voiceBusy = false;
      }
    }
  }

  private async triggerRestPrompt(): Promise<void> {
    if (this.currentSet >= this.prog.sets) {
      this.phase = "done";
      this.deps.onSpeak(this.prog.workoutDoneTts);
      this.deps.onStatus?.("Programa completado");
      return;
    }
    const nextSet = this.currentSet + 1;
    const prompt = fmtTemplate(this.prog.restEndTts, {
      next_set: nextSet,
      total_sets: this.prog.sets,
    });
    this.voiceBusy = true;
    try {
      await this.restPromptWorker(prompt, nextSet);
    } finally {
      this.voiceBusy = false;
    }
  }

  private async restPromptWorker(prompt: string, nextSet: number): Promise<void> {
    this.deps.onSpeak(prompt);
    const classify =
      this.deps.classifyFn ??
      ((t: string) => Promise.resolve(classifyReadinessLocal(t)));

    let transcript = await this.deps.onListen(this.prog.listenSeconds);
    let action = await classify(transcript);

    if (action === "ready") {
      this.currentSet = nextSet;
      this.deps.onSpeak(
        fmtTemplate(this.prog.readyTts, {
          set: this.currentSet,
          total_sets: this.prog.sets,
        }),
      );
      this.beginSet();
      return;
    }
    if (action === "more_rest") {
      this.restDurationSeconds = this.prog.extraRestSeconds;
      this.restEndAt = performance.now() / 1000 + this.restDurationSeconds;
      this.phase = "rest";
      this.deps.onSpeak(this.prog.extraRestTts);
      this.hudNote = `+${this.prog.extraRestSeconds}s de descanso`;
      return;
    }

    this.deps.onSpeak(this.prog.noHearTts);
    transcript = await this.deps.onListen(this.prog.listenSeconds);
    action = await classify(transcript);
    if (action === "ready") {
      this.currentSet = nextSet;
      this.deps.onSpeak(
        fmtTemplate(this.prog.readyTts, {
          set: this.currentSet,
          total_sets: this.prog.sets,
        }),
      );
      this.beginSet();
    } else if (action === "more_rest") {
      this.restDurationSeconds = this.prog.extraRestSeconds;
      this.restEndAt = performance.now() / 1000 + this.restDurationSeconds;
      this.phase = "rest";
      this.deps.onSpeak(this.prog.extraRestTts);
      this.hudNote = `+${this.prog.extraRestSeconds}s de descanso`;
    } else {
      this.phase = "rest";
      this.restDurationSeconds = 8;
      this.restEndAt = performance.now() / 1000 + this.restDurationSeconds;
      this.hudNote = "Di listo o pide otro minuto";
    }
  }

  hudSnapshot(_totalReps: number): WorkoutHudSnapshot {
    const now = performance.now() / 1000;
    let restSecondsLeft = 0;
    let restSecondsTotal = 0;
    if (this.phase === "rest") {
      restSecondsLeft = Math.max(0, this.restEndAt - now);
      restSecondsTotal = this.restDurationSeconds;
    }
    const statusText = {
      intro: "Preparando programa…",
      set_active: `Serie ${this.currentSet} en curso`,
      rest: "Descanso",
      rest_prompt: "¿Listo?",
      done: "Fin",
    }[this.phase];
    return {
      active: true,
      phase: this.phase,
      displayName: this.prog.displayName,
      currentSet: this.currentSet,
      totalSets: this.prog.sets,
      repsInSet: this.repsInSet,
      repsPerSet: this.prog.repsPerSet,
      restSecondsLeft,
      restSecondsTotal,
      hudNote: this.hudNote,
      statusText,
      voiceBusy: this.voiceBusy,
    };
  }
}
