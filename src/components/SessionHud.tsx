import type { SessionHudState } from "@/hooks/useExerciseSession";

interface SessionHudProps {
  hud: SessionHudState;
  onSkipSetup?: () => void;
  onAskCoach?: () => void;
  coachStatus?: string;
  /** Mensaje mientras carga config o modelo de pose. */
  loadingMessage?: string | null;
}

function formatAngle(phaseAngle: number | undefined): string {
  const n = Number(phaseAngle);
  return Number.isFinite(n) ? `${n.toFixed(0)}°` : "—";
}

export function SessionHud({
  hud,
  onSkipSetup,
  onAskCoach,
  coachStatus,
  loadingMessage,
}: SessionHudProps) {
  const inSetup = hud.phase === "setup";
  const angleStr = formatAngle(hud.phaseAngle);
  const holdProgress = Number.isFinite(hud.holdProgress) ? hud.holdProgress : 0;
  const holdMs = Number.isFinite(hud.holdMs) ? hud.holdMs : 1500;

  return (
    <div className="session-hud" aria-live="polite">
      {loadingMessage && (
        <p className="session-hud-loading">{loadingMessage}</p>
      )}
      <div className="session-hud-top">
        <span className="session-hud-phase">
          {inSetup
            ? `FASE 1 — Pose inicial (${hud.positionLabel})`
            : `FASE 2 — Reps: ${hud.repCount}`}
        </span>
        {!inSetup && (
          <span className="session-hud-angle">
            {hud.angleLabel}: {angleStr}
          </span>
        )}
      </div>

      {hud.rejectFlash && hud.rejectMessages.length > 0 && (
        <div className="session-hud-reject">
          Rep no válida: {hud.rejectMessages.join(" · ")}
        </div>
      )}

      {inSetup ? (
        <>
          {hud.setupFailures.length > 0 ? (
            <ul className="session-hud-alerts session-hud-alerts--warn">
              {hud.setupFailures.map(([id, msg]) => (
                <li key={id}>{msg}</li>
              ))}
            </ul>
          ) : (
            <p className="session-hud-ok">Pose OK — mantén quieto…</p>
          )}
          <div className="session-hud-bar">
            <div
              className="session-hud-bar-fill"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
          <p className="session-hud-bar-label">
            Partida en{" "}
            {Math.max(
              0,
              Math.ceil((1 - holdProgress) * (holdMs / 1000)),
            )}{" "}
            s
          </p>
          {onSkipSetup && (
            <button
              type="button"
              className="btn-skip-setup"
              onClick={onSkipSetup}
            >
              Omitir setup
            </button>
          )}
        </>
      ) : (
        <>
          {hud.alerts.length > 0 ? (
            <ul className="session-hud-alerts">
              {hud.alerts.map((msg, i) => (
                <li key={`${i}-${msg.slice(0, 24)}`}>{msg}</li>
              ))}
            </ul>
          ) : (
            <p className="session-hud-ok">Forma OK</p>
          )}
          {hud.alertOverflow && (
            <p className="session-hud-overflow">{hud.alertOverflow}</p>
          )}
        </>
      )}

      {hud.workout?.active && (
        <div className="session-hud-workout">
          <strong>{hud.workout.displayName}</strong>
          <span>
            Serie {hud.workout.currentSet}/{hud.workout.totalSets}
          </span>
          {hud.workout.phase === "set_active" && (
            <span>
              Reps: {hud.workout.repsInSet}/{hud.workout.repsPerSet}
            </span>
          )}
          {hud.workout.phase === "rest" && (
            <span className="session-hud-rest">
              Descanso{" "}
              {Math.ceil(hud.workout.restSecondsLeft)}s · siguiente serie{" "}
              {hud.workout.currentSet + 1}
            </span>
          )}
          {hud.workout.phase === "rest_prompt" && (
            <span className="session-hud-rest">Di LISTO o «otro minuto»</span>
          )}
          {hud.workout.phase === "done" && (
            <span className="session-hud-ok">Programa completado</span>
          )}
          {hud.workout.hudNote && (
            <span className="session-hud-overflow">{hud.workout.hudNote}</span>
          )}
        </div>
      )}

      <div className="session-hud-status">
        <span className={hud.viewOk ? "ok" : "bad"}>Vista</span>
        <span className={hud.trackingOk ? "ok" : "bad"}>Brazos</span>
        {hud.noPose && <span className="bad">Sin pose</span>}
      </div>

      {coachStatus && (
        <p className="session-hud-coach">{coachStatus}</p>
      )}
      {onAskCoach && hud.phase === "execution" && (
        <button type="button" className="btn-coach" onClick={() => onAskCoach()}>
          Preguntar al entrenador
        </button>
      )}
    </div>
  );
}
