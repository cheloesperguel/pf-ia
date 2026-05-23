/** Respuestas locales cuando no hay API GPT (modo solo navegador). */

import type { AppLocale } from "@/i18n/locale";

const PRESS_HINTS_ES: [RegExp, string][] = [
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

const PRESS_HINTS_EN: [RegExp, string][] = [
  [
    /elbow|flare|scapular|wide|lateral/i,
    "Tuck elbows toward the bar, not flared wide. In calibration check rule 4: low lateral at rack, high if you flare.",
  ],
  [
    /rack|start|setup|begin/i,
    "Seated setup: bent elbows in rack, face the camera, arms visible. Hold the pose until start.",
  ],
  [
    /rep|repetition|count/i,
    "Reps count when you extend (elbow angle up) after marking the bottom. Check top_min and bottom_max in calibration.",
  ],
  [
    /wrist|forearm|stack/i,
    "Stack wrist over elbow on the way down. Rule 6 and green/red lines on screen.",
  ],
  [
    /bar|grip|chin/i,
    "The yellow line links wrists (bar proxy). It should sit below the chin and near the shoulder line.",
  ],
  [
    /rest|ready|set/i,
    "During rest say «ready» or «another minute». If the API is off, use the on-screen button if the mic fails.",
  ],
];

export function localCoachReply(
  question: string,
  exerciseDisplay: string,
  locale: AppLocale = "es",
): string {
  const q = question.trim();
  const en = locale === "en";
  if (!q || q.length < 2) {
    return en
      ? "I didn't catch the question. Try again more slowly."
      : "No entendí la pregunta. Repite más despacio.";
  }
  const hints = en ? PRESS_HINTS_EN : PRESS_HINTS_ES;
  for (const [re, ans] of hints) {
    if (re.test(q)) return ans;
  }
  return en
    ? `About ${exerciseDisplay}: keep rack form, elbows slightly forward, and full reps. ` +
        "For AI answers enable the coach API (uvicorn) and OPENAI_API_KEY."
    : `Sobre ${exerciseDisplay}: mantén forma en rack, codos hacia adelante y reps completas. ` +
        "Para respuestas con IA activa el coach API (uvicorn) y OPENAI_API_KEY.";
}
