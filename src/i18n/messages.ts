import type { AppLocale } from "./locale";

export type MessageKey =
  | "picker.title"
  | "picker.sub"
  | "picker.langLabel"
  | "picker.langEs"
  | "picker.langEn"
  | "picker.exercise.press_militar.label"
  | "picker.exercise.press_militar.hint"
  | "picker.exercise.squat.label"
  | "picker.exercise.squat.hint"
  | "session.back"
  | "session.loading"
  | "session.calibrate"
  | "session.exitCal"
  | "session.fpsReps"
  | "session.voiceUnlockHint"
  | "session.voiceUnlockBtn"
  | "session.voiceActivated"
  | "session.loadError"
  | "session.poseLoading"
  | "session.poseUnavailable"
  | "session.poseStarting"
  | "session.exerciseLoading"
  | "session.faceCamera"
  | "hud.calibration"
  | "hud.setup"
  | "hud.execution"
  | "hud.phaseSkipped"
  | "hud.reps"
  | "hud.view"
  | "hud.arms"
  | "hud.noPose"
  | "hud.invalidRep"
  | "hud.poseOkHold"
  | "hud.startIn"
  | "hud.formOk"
  | "hud.program"
  | "hud.set"
  | "hud.setReps"
  | "hud.rest"
  | "hud.nextSet"
  | "hud.readyPrompt"
  | "hud.sayReady"
  | "hud.workoutDone"
  | "hud.heard"
  | "hud.skipSetup"
  | "hud.stopCoach"
  | "hud.askCoach"
  | "hud.askCoachListening"
  | "hud.askCoachThinking"
  | "hud.angle"
  | "cal.title"
  | "cal.close"
  | "cal.hint"
  | "cal.all"
  | "cal.thresholdDeg"
  | "cal.threshold"
  | "cal.live"
  | "cal.save"
  | "cal.apply"
  | "cal.slidersRepOnly"
  | "cal.savedServer"
  | "cal.savedLocal"
  | "cal.applyPc"
  | "cal.applied"
  | "cal.noChanges"
  | "voice.coachDisabled"
  | "voice.openaiRejected"
  | "voice.recording"
  | "voice.transcribing"
  | "voice.listenReady"
  | "voice.noQuestion"
  | "voice.noAnswer"
  | "voice.responding"
  | "voice.openaiError"
  | "voice.listening"
  | "voice.nothingHeard"
  | "voice.thinking"
  | "voice.statusOpenai"
  | "voice.statusApi"
  | "voice.statusBrowser"
  | "voice.unavailable"
  | "workout.setOk"
  | "workout.setReview"
  | "workout.sayReadyOrMinute";

const ES: Record<MessageKey, string> = {
  "picker.title": "pf-IA",
  "picker.sub":
    "PWA con React + MediaPipe. Elige un ejercicio; necesitas cámara y conexión la primera vez (modelo pose).",
  "picker.langLabel": "Idioma",
  "picker.langEs": "Español",
  "picker.langEn": "English",
  "picker.exercise.press_militar.label": "Press militar (sentado)",
  "picker.exercise.press_militar.hint": "Setup, alertas y conteo de reps (PWA)",
  "picker.exercise.squat.label": "Sentadilla",
  "picker.exercise.squat.hint": "Próximamente en PWA",
  "session.back": "← Volver",
  "session.loading": "Cargando…",
  "session.calibrate": "Calibrar",
  "session.exitCal": "Salir cal.",
  "session.fpsReps": "{fps} fps · {reps} reps",
  "session.voiceUnlockHint": "En iPhone la voz requiere un toque.",
  "session.voiceUnlockBtn": "Activar voz",
  "session.voiceActivated": "Voz activada. Puedes entrenar.",
  "session.loadError": "Error cargando configuración",
  "session.poseLoading": "Cargando modelo de pose…",
  "session.poseUnavailable": "Pose no disponible",
  "session.poseStarting": "Iniciando detección…",
  "session.exerciseLoading": "Cargando ejercicio…",
  "session.faceCamera": "Colócate de frente a la cámara",
  "hud.calibration": "Calibración",
  "hud.setup": "Setup",
  "hud.execution": "Ejecución",
  "hud.phaseSkipped": "Fase 1 omitida",
  "hud.reps": "reps",
  "hud.view": "Vista",
  "hud.arms": "Brazos",
  "hud.noPose": "Sin pose",
  "hud.invalidRep": "Rep no válida",
  "hud.poseOkHold": "Pose OK — mantén quieto",
  "hud.startIn": "Partida en {sec} s",
  "hud.formOk": "Forma OK",
  "hud.program": "Programa",
  "hud.set": "Serie",
  "hud.setReps": "Reps serie",
  "hud.rest": "Descanso",
  "hud.nextSet": "Siguiente serie {n}",
  "hud.readyPrompt": "¿Listo?",
  "hud.sayReady": "Di listo o otro minuto",
  "hud.workoutDone": "Programa completado",
  "hud.heard": "Oído",
  "hud.skipSetup": "Omitir setup",
  "hud.stopCoach": "Detener voz IA",
  "hud.askCoach": "Preguntar al entrenador",
  "hud.askCoachListening": "Escuchando… habla ahora",
  "hud.askCoachThinking": "Pensando…",
  "hud.angle": "Ángulo",
  "cal.title": "Calibración",
  "cal.close": "Cerrar",
  "cal.hint":
    "Fase 1 omitida. 3–8 = una regla (nombre y aviso arriba). 0 = todas.",
  "cal.all": "0 Todas",
  "cal.thresholdDeg": "Umbral {val}°",
  "cal.threshold": "Umbral {val}",
  "cal.live": "vivo",
  "cal.save": "Guardar (S)",
  "cal.apply": "Aplicar al JSON",
  "cal.slidersRepOnly": "Sliders 1–2 son reps; usa 3–8 para una regla",
  "cal.savedServer": "Guardado en servidor y descargado.",
  "cal.savedLocal": "Descargado (API apagada: solo archivo local).",
  "cal.applyPc": "Aplica en PC: python apply_calibration.py (API no disponible).",
  "cal.applied": "Aplicado: {n} cambio(s).",
  "cal.noChanges": "Sin cambios respecto al JSON principal.",
  "voice.coachDisabled": "Coach desactivado en JSON",
  "voice.openaiRejected":
    "Clave OpenAI rechazada. Revisa VITE_OPENAI_API_KEY en web/.env y reinicia npm run dev",
  "voice.recording": "● Grabando…",
  "voice.transcribing": "Transcribiendo…",
  "voice.listenReady": "Di listo o pide otro minuto…",
  "voice.noQuestion": "No entendí la pregunta. Intenta de nuevo.",
  "voice.noAnswer": "No pude generar una respuesta.",
  "voice.responding": "Respondiendo…",
  "voice.openaiError": "Error al consultar OpenAI.",
  "voice.listening": "Escuchando tu pregunta…",
  "voice.nothingHeard": "No escuché nada. Comprueba permiso de micrófono.",
  "voice.thinking": "Pensando respuesta…",
  "voice.statusOpenai": "OpenAI directo · Di «{wake}» o Preguntar",
  "voice.statusApi": "Coach API (Python) · Di «{wake}» o Preguntar",
  "voice.statusBrowser": "Solo voz navegador (sin OpenAI) · «{wake}»",
  "voice.unavailable": "Voz no disponible.",
  "workout.setOk": "Serie {n} bien. Sigue así.",
  "workout.setReview": "Serie {n} terminada. Revisa: {msg}",
  "workout.sayReadyOrMinute": "Di listo o pide otro minuto",
};

const EN: Record<MessageKey, string> = {
  "picker.title": "pf-IA",
  "picker.sub":
    "React + MediaPipe PWA. Pick an exercise; camera and network are required the first time (pose model).",
  "picker.langLabel": "Language",
  "picker.langEs": "Español",
  "picker.langEn": "English",
  "picker.exercise.press_militar.label": "Seated overhead press",
  "picker.exercise.press_militar.hint": "Setup, alerts and rep counting (PWA)",
  "picker.exercise.squat.label": "Squat",
  "picker.exercise.squat.hint": "Coming soon in PWA",
  "session.back": "← Back",
  "session.loading": "Loading…",
  "session.calibrate": "Calibrate",
  "session.exitCal": "Exit cal.",
  "session.fpsReps": "{fps} fps · {reps} reps",
  "session.voiceUnlockHint": "On iPhone, voice needs a tap first.",
  "session.voiceUnlockBtn": "Enable voice",
  "session.voiceActivated": "Voice enabled. You can train.",
  "session.loadError": "Error loading configuration",
  "session.poseLoading": "Loading pose model…",
  "session.poseUnavailable": "Pose unavailable",
  "session.poseStarting": "Starting detection…",
  "session.exerciseLoading": "Loading exercise…",
  "session.faceCamera": "Face the camera",
  "hud.calibration": "Calibration",
  "hud.setup": "Setup",
  "hud.execution": "Execution",
  "hud.phaseSkipped": "Phase 1 skipped",
  "hud.reps": "reps",
  "hud.view": "View",
  "hud.arms": "Arms",
  "hud.noPose": "No pose",
  "hud.invalidRep": "Invalid rep",
  "hud.poseOkHold": "Pose OK — hold still",
  "hud.startIn": "Start in {sec} s",
  "hud.formOk": "Form OK",
  "hud.program": "Program",
  "hud.set": "Set",
  "hud.setReps": "Set reps",
  "hud.rest": "Rest",
  "hud.nextSet": "Next set {n}",
  "hud.readyPrompt": "Ready?",
  "hud.sayReady": "Say ready or another minute",
  "hud.workoutDone": "Program completed",
  "hud.heard": "Heard",
  "hud.skipSetup": "Skip setup",
  "hud.stopCoach": "Stop AI voice",
  "hud.askCoach": "Ask the coach",
  "hud.askCoachListening": "Listening… speak now",
  "hud.askCoachThinking": "Thinking…",
  "hud.angle": "Angle",
  "cal.title": "Calibration",
  "cal.close": "Close",
  "cal.hint": "Phase 1 skipped. 3–8 = one rule (name and alert above). 0 = all.",
  "cal.all": "0 All",
  "cal.thresholdDeg": "Threshold {val}°",
  "cal.threshold": "Threshold {val}",
  "cal.live": "live",
  "cal.save": "Save (S)",
  "cal.apply": "Apply to JSON",
  "cal.slidersRepOnly": "Sliders 1–2 are reps; use 3–8 for a rule",
  "cal.savedServer": "Saved on server and downloaded.",
  "cal.savedLocal": "Downloaded (API off: local file only).",
  "cal.applyPc": "On PC run: python apply_calibration.py (API unavailable).",
  "cal.applied": "Applied: {n} change(s).",
  "cal.noChanges": "No changes vs main JSON.",
  "voice.coachDisabled": "Coach disabled in JSON",
  "voice.openaiRejected":
    "OpenAI key rejected. Check VITE_OPENAI_API_KEY in web/.env and restart npm run dev",
  "voice.recording": "● Recording…",
  "voice.transcribing": "Transcribing…",
  "voice.listenReady": "Say ready or ask for another minute…",
  "voice.noQuestion": "I didn't catch the question. Try again.",
  "voice.noAnswer": "Couldn't generate an answer.",
  "voice.responding": "Answering…",
  "voice.openaiError": "Error contacting OpenAI.",
  "voice.listening": "Listening to your question…",
  "voice.nothingHeard": "Didn't hear anything. Check microphone permission.",
  "voice.thinking": "Thinking…",
  "voice.statusOpenai": "OpenAI direct · Say «{wake}» or Ask",
  "voice.statusApi": "Coach API (Python) · Say «{wake}» or Ask",
  "voice.statusBrowser": "Browser voice only (no OpenAI) · «{wake}»",
  "voice.unavailable": "Voice unavailable.",
  "workout.setOk": "Set {n} looks good. Keep it up.",
  "workout.setReview": "Set {n} done. Check: {msg}",
  "workout.sayReadyOrMinute": "Say ready or ask for another minute",
};

const BY_LOCALE: Record<AppLocale, Record<MessageKey, string>> = { es: ES, en: EN };

export function translate(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = BY_LOCALE[locale][key] ?? BY_LOCALE.es[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}
