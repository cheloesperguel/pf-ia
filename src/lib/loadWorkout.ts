import { getActiveLocale, localeContentUrl, type AppLocale } from "@/i18n/locale";
import { fetchJson } from "./loadConfig";
import { parseWorkoutProgram, type WorkoutProgram } from "./workoutGuide";

export async function loadWorkoutProgram(
  cfg: Record<string, unknown>,
  locale: AppLocale = getActiveLocale(),
): Promise<WorkoutProgram | null> {
  const w = (cfg.workout ?? {}) as Record<string, unknown>;
  if (!w.enabled) return null;
  const rel = String(w.program_file ?? "workout_programs/press_4x12.json");
  const url = rel.startsWith("/")
    ? rel
    : localeContentUrl(locale, rel.replace(/\\/g, "/"));
  const data = await fetchJson<Record<string, unknown>>(url);
  return parseWorkoutProgram(data, locale);
}
