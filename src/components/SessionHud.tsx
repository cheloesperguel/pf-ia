import type { SessionHudState } from "@/hooks/useExerciseSession";
import { useT } from "@/i18n/LocaleContext";

interface SessionHudProps {
  hud: SessionHudState;
  calibrationMode?: boolean;
  onSkipSetup?: () => void;
  onAskCoach?: () => void;
  coachStatus?: string;
  hearPreview?: { text: string; interim: boolean } | null;
  coachSpeaking?: boolean;
  onStopCoachSpeech?: () => void;
  loadingMessage?: string | null;
}

function formatAngle(phaseAngle: number | undefined): string {
  const n = Number(phaseAngle);
  return Number.isFinite(n) ? `${n.toFixed(0)}°` : "—";
}

function formatRestClock(secondsLeft: number): string {
  const s = Math.max(0, Math.ceil(secondsLeft));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}:${String(r).padStart(2, "0")}`;
  return `${s}`;
}

export function SessionHud({
  hud,
  calibrationMode = false,
  onSkipSetup,
  onAskCoach,
  coachStatus,
  hearPreview,
  coachSpeaking = false,
  onStopCoachSpeech,
  loadingMessage,
}: SessionHudProps) {
  const t = useT();
  const inSetup = !calibrationMode && hud.phase === "setup";
  const inExecution = !calibrationMode && hud.phase === "execution";
  const angleStr = formatAngle(hud.phaseAngle);
  const holdProgress = Number.isFinite(hud.holdProgress) ? hud.holdProgress : 0;
  const holdMs = Number.isFinite(hud.holdMs) ? hud.holdMs : 1500;
  const holdSecLeft = Math.max(
    0,
    Math.ceil((1 - holdProgress) * (holdMs / 1000)),
  );

  const phaseTitle = calibrationMode
    ? t("hud.calibration")
    : inSetup
      ? t("hud.setup")
      : t("hud.execution");

  const phaseDetail = calibrationMode
    ? t("hud.phaseSkipped")
    : inSetup
      ? hud.positionLabel
      : `${hud.repCount} ${t("hud.reps")}`;

  return (
    <div className="session-hud" aria-live="polite">
      <header className="session-hud__header">
        {loadingMessage && (
          <p className="session-hud__loading">{loadingMessage}</p>
        )}
        <div className="session-hud__header-row">
          <div className="session-hud__phase-block">
            <span className="session-hud__phase-tag">{phaseTitle}</span>
            <span className="session-hud__phase-detail">{phaseDetail}</span>
          </div>
          <div className="session-hud__chips" role="status">
            <span className={`session-hud__chip${hud.viewOk ? " ok" : " bad"}`}>
              {t("hud.view")}
            </span>
            <span className={`session-hud__chip${hud.trackingOk ? " ok" : " bad"}`}>
              {t("hud.arms")}
            </span>
            {hud.noPose && (
              <span className="session-hud__chip bad">{t("hud.noPose")}</span>
            )}
          </div>
          {inExecution && (
            <div className="session-hud__metric-pill" title={hud.angleLabel}>
              <span className="session-hud__metric-label">{hud.angleLabel}</span>
              <span className="session-hud__metric-value">{angleStr}</span>
            </div>
          )}
          {inExecution && (
            <div
              className="session-hud__rep-hero"
              aria-label={`${hud.repCount} ${t("hud.reps")}`}
            >
              {hud.repCount}
            </div>
          )}
        </div>
      </header>

      <main className="session-hud__body">
        {hud.rejectFlash && hud.rejectMessages.length > 0 && (
          <div className="session-hud__card session-hud__card--reject">
            <span className="session-hud__card-title">{t("hud.invalidRep")}</span>
            <p>{hud.rejectMessages.join(" · ")}</p>
          </div>
        )}

        {inSetup ? (
          <div className="session-hud__card session-hud__card--setup">
            {hud.setupFailures.length > 0 ? (
              <ul className="session-hud__alert-list session-hud__alert-list--warn">
                {hud.setupFailures.map(([id, msg]) => (
                  <li key={id}>{msg}</li>
                ))}
              </ul>
            ) : (
              <p className="session-hud__ok-line">{t("hud.poseOkHold")}</p>
            )}
            <div className="session-hud__progress">
              <div
                className="session-hud__progress-fill"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
            <p className="session-hud__progress-label">
              {t("hud.startIn", { sec: holdSecLeft })}
            </p>
          </div>
        ) : (
          <div className="session-hud__card session-hud__card--form">
            {hud.alerts.length > 0 ? (
              <ul className="session-hud__alert-list">
                {hud.alerts.map((msg, i) => (
                  <li key={`${i}-${msg.slice(0, 24)}`}>{msg}</li>
                ))}
              </ul>
            ) : (
              <p className="session-hud__ok-line">{t("hud.formOk")}</p>
            )}
            {hud.alertOverflow && (
              <p className="session-hud__muted">{hud.alertOverflow}</p>
            )}
          </div>
        )}

        {!calibrationMode && hud.workout?.active && (
          <div className="session-hud__card session-hud__card--workout">
            <div className="session-hud__workout-grid">
              <div className="session-hud__stat">
                <span className="session-hud__stat-label">{t("hud.program")}</span>
                <span className="session-hud__stat-value session-hud__stat-value--short">
                  {hud.workout.displayName}
                </span>
              </div>
              <div className="session-hud__stat">
                <span className="session-hud__stat-label">{t("hud.set")}</span>
                <span className="session-hud__stat-value">
                  {hud.workout.currentSet}/{hud.workout.totalSets}
                </span>
              </div>
              {hud.workout.phase === "set_active" && (
                <div className="session-hud__stat session-hud__stat--wide">
                  <span className="session-hud__stat-label">{t("hud.setReps")}</span>
                  <span className="session-hud__stat-value">
                    {hud.workout.repsInSet}/{hud.workout.repsPerSet}
                  </span>
                </div>
              )}
            </div>

            {hud.workout.phase === "rest" && (
              <div className="session-hud__rest" aria-live="polite">
                <span className="session-hud__rest-label">{t("hud.rest")}</span>
                <span className="session-hud__rest-clock">
                  {formatRestClock(hud.workout.restSecondsLeft)}
                </span>
                {hud.workout.restSecondsTotal > 0 && (
                  <div
                    className="session-hud__rest-bar"
                    role="progressbar"
                    aria-valuenow={Math.ceil(hud.workout.restSecondsLeft)}
                    aria-valuemin={0}
                    aria-valuemax={hud.workout.restSecondsTotal}
                  >
                    <div
                      className="session-hud__rest-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          (100 *
                            (hud.workout.restSecondsTotal -
                              hud.workout.restSecondsLeft)) /
                            hud.workout.restSecondsTotal,
                        )}%`,
                      }}
                    />
                  </div>
                )}
                <span className="session-hud__rest-meta">
                  {t("hud.nextSet", { n: hud.workout.currentSet + 1 })}
                </span>
              </div>
            )}

            {hud.workout.phase === "rest_prompt" && (
              <div className="session-hud__rest session-hud__rest--prompt">
                <span className="session-hud__rest-label">{t("hud.readyPrompt")}</span>
                <span className="session-hud__rest-meta">{t("hud.sayReady")}</span>
              </div>
            )}

            {hud.workout.phase === "done" && (
              <p className="session-hud__ok-line">{t("hud.workoutDone")}</p>
            )}

            {hud.workout.hudNote && (
              <p className="session-hud__muted">{hud.workout.hudNote}</p>
            )}
          </div>
        )}
      </main>

      <footer className="session-hud__footer">
        {coachStatus && (
          <p className="session-hud__coach">{coachStatus}</p>
        )}
        {hearPreview?.text && (
          <p
            className={`session-hud__heard${hearPreview.interim ? " session-hud__heard--interim" : ""}`}
          >
            <span className="session-hud__heard-label">{t("hud.heard")}</span>
            {hearPreview.text}
          </p>
        )}
        <div className="session-hud__actions">
          {inSetup && onSkipSetup && (
            <button
              type="button"
              className="session-hud__btn session-hud__btn--secondary"
              onClick={onSkipSetup}
            >
              {t("hud.skipSetup")}
            </button>
          )}
          {coachSpeaking && onStopCoachSpeech && (
            <button
              type="button"
              className="session-hud__btn session-hud__btn--danger"
              onClick={() => onStopCoachSpeech()}
            >
              {t("hud.stopCoach")}
            </button>
          )}
          {onAskCoach && inExecution && !coachSpeaking && (
            <button
              type="button"
              className="session-hud__btn session-hud__btn--primary"
              onClick={() => onAskCoach()}
            >
              {t("hud.askCoach")}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
