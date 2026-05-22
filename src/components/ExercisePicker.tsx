import { unlockSpeech } from "@/lib/speechSynth";

interface ExercisePickerProps {
  onSelect: (exerciseId: string) => void;
}

const EXERCISES = [
  {
    id: "press_militar",
    label: "Press militar (sentado)",
    hint: "Setup, alertas y conteo de reps (PWA)",
  },
  {
    id: "squat_knee_dominant",
    label: "Sentadilla",
    hint: "Próximamente en PWA",
    disabled: true,
  },
] as const;

export function ExercisePicker({ onSelect }: ExercisePickerProps) {
  return (
    <section className="picker">
      <h1>pf-IA</h1>
      <p className="picker-sub">
        PWA con React + MediaPipe. Elige un ejercicio; necesitas cámara y conexión
        la primera vez (modelo pose).
      </p>
      <ul className="picker-list">
        {EXERCISES.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              className="picker-btn"
              disabled={"disabled" in ex && ex.disabled}
              onClick={() => {
                unlockSpeech();
                onSelect(ex.id);
              }}
            >
              <span className="picker-btn-title">{ex.label}</span>
              <span className="picker-btn-hint">{ex.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
