import { getActiveLocale, localeContentUrl, type AppLocale } from "@/i18n/locale";
import { stripJsoncComments } from "./jsonc";

export async function fetchJson<T = Record<string, unknown>>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
  const text = await res.text();
  const cleaned = stripJsoncComments(text);
  return JSON.parse(cleaned) as T;
}

export async function loadExercise(
  id: string,
  locale: AppLocale = getActiveLocale(),
): Promise<Record<string, unknown>> {
  return fetchJson(
    localeContentUrl(locale, `exercise_instructions/${id}.json`),
  );
}
