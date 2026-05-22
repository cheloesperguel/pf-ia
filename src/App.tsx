import { useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { SessionView } from "@/components/SessionView";
import "./App.css";

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

export default App;
