import { useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { SessionView } from "@/components/SessionView";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { initLocale } from "@/i18n/locale";
import "./App.css";

initLocale();

function App() {
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  if (exerciseId) {
    return (
      <SessionView exerciseId={exerciseId} onBack={() => setExerciseId(null)} />
    );
  }

  return (
    <main className="app">
      <ExercisePicker onSelect={setExerciseId} />
    </main>
  );
}

export default function AppRoot() {
  return (
    <LocaleProvider>
      <App />
    </LocaleProvider>
  );
}
