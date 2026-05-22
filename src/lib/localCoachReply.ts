/** Respuestas locales cuando no hay API GPT (modo solo navegador). */

const PRESS_HINTS: [RegExp, string][] = [
  [
    /codo|cruz|escapular|abrir|abierto|lateral/i,
    "Cierra codos hacia la barra, no en cruz. En calibración mira la regla 4: lat bajo en rack, alto si abres en cruz.",
  ],
  [
    /rack|partida|setup|inicio|sentad/i,
    "Setup sentado: codos flexionados en rack, de frente a cámara, brazos visibles. Mantén la pose hasta la partida.",
  ],
  [
    /rep|repetic|contar|cuenta/i,
    "Las reps cuentan al extender (ángulo de codo arriba) tras haber marcado fondo. Revisa top_min y bottom_max en calibración.",
  ],
  [
    /muñeca|muneca|antebrazo|stack/i,
    "Apila muñeca sobre el codo en la bajada. Regla 6 y líneas verdes/rojas en pantalla.",
  ],
  [
    /barra|agarre|nariz/i,
    "La línea amarilla une muñecas (proxy de barra). Debe quedar bajo la nariz y cerca de la línea de hombros.",
  ],
  [
    /descanso|listo|serie/i,
    "En descanso di «listo» o «otro minuto». Con API apagada usa el botón en pantalla si el micrófono falla.",
  ],
];

export function localCoachReply(
  question: string,
  exerciseDisplay: string,
): string {
  const q = question.trim();
  if (!q || q.length < 2) {
    return "No entendí la pregunta. Repite más despacio.";
  }
  for (const [re, ans] of PRESS_HINTS) {
    if (re.test(q)) return ans;
  }
  return (
    `Sobre ${exerciseDisplay}: mantén forma en rack, codos hacia adelante y reps completas. ` +
    "Para respuestas con IA activa el coach API (uvicorn) y OPENAI_API_KEY."
  );
}
