import { unlockSpeech } from "@/lib/speechSynth";
import { useLocale } from "@/i18n/LocaleContext";
import type { MessageKey } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/locale";

interface ExercisePickerProps {
  onSelect: (exerciseId: string) => void;
}

const EXERCISES = [
  {
    id: "press_militar",
    labelKey: "picker.exercise.press_militar.label" as MessageKey,
    hintKey: "picker.exercise.press_militar.hint" as MessageKey,
  },
  {
    id: "squat_knee_dominant",
    labelKey: "picker.exercise.squat.label" as MessageKey,
    hintKey: "picker.exercise.squat.hint" as MessageKey,
    disabled: true,
  },
] as const;

export function ExercisePicker({ onSelect }: ExercisePickerProps) {
  const { locale, setLocale, t } = useLocale();

  const setLang = (next: AppLocale) => {
    setLocale(next);
  };

  return (
    <section className="picker">
      <h1>{t("picker.title")}</h1>
      <p className="picker-sub">{t("picker.sub")}</p>

      <div className="picker-lang" role="group" aria-label={t("picker.langLabel")}>
        <span className="picker-lang-label">{t("picker.langLabel")}</span>
        <div className="picker-lang-toggle">
          <button
            type="button"
            className={locale === "es" ? "active" : ""}
            aria-pressed={locale === "es"}
            onClick={() => setLang("es")}
          >
            {t("picker.langEs")}
          </button>
          <button
            type="button"
            className={locale === "en" ? "active" : ""}
            aria-pressed={locale === "en"}
            onClick={() => setLang("en")}
          >
            {t("picker.langEn")}
          </button>
        </div>
      </div>

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
              <span className="picker-btn-title">{t(ex.labelKey)}</span>
              <span className="picker-btn-hint">{t(ex.hintKey)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
