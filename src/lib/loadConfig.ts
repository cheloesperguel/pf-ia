import { stripJsoncComments } from "./jsonc";

export async function fetchJson<T = Record<string, unknown>>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
  const text = await res.text();
  const cleaned = stripJsoncComments(text);
  return JSON.parse(cleaned) as T;
}

export async function loadExercise(id: string): Promise<Record<string, unknown>> {
  return fetchJson(`/exercise_instructions/${id}.json`);
}
