import { useState, useEffect } from "react";
import { formatTime, paceToDisplay, formatLocalTime } from "../utils";
import { LegCarousel } from "./LegCarousel";
import { PostRaceReport } from "./PostRaceReport";

const AMBER = "#F59E0B";
const GREEN = "#10B981";
const RED = "#EF4444";
const FONT = "'Archivo', system-ui, sans-serif";


// ─── Phase 1: Pre-Race ────────────────────────────────────────────────────────

function PreRaceScreen({ calculatedLegs, runners, teamTime, startTime, onStartRace }) {
  const h = Math.floor(teamTime / 3600);
  const m = Math.floor((teamTime % 3600) / 60);
  const predictedFinish = h > 0 ? `${h}h ${m}m` : `${m}m`;

  const [sh, sm] = startTime.split(":").map(Number);
  const ampm = sh < 12 ? "AM" : "PM";
  const h12 = sh % 12 || 12;
  const plannedStart = `${h12}:${String(sm).padStart(2, "0")} ${ampm}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", minHeight: "60vh" }}>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#92400e", background: "#fef3c7", border: `1px solid ${AMBER}`, borderRadius: 999, padding: "4px 14px", marginBottom: 36, fontFamily: FONT }}>
        ⏱ MANUAL MODE
      </span>

      <div style={{ textAlign: "center", marginBottom: 44, lineHeight: 1.9 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: FONT }}>
          {calculatedLegs.length} Legs · {runners.length} Runners
        </div>
        <div style={{ fontSize: 16, color: "#374151" }}>Predicted finish: {predictedFinish}</div>
        <div style={{ fontSize: 15, color: "#94a3b8" }}>Planned start: {plannedStart}</div>
      </div>

      <button
        onClick={onStartRace}
        style={{ width: "100%", maxWidth: 380, padding: "20px 0", background: GREEN, border: "none", borderRadius: 16, color: "#fff", fontSize: 22, fontWeight: 800, cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.02em", boxShadow: "0 6px 28px rgba(16,185,129,0.40)", transition: "transform 0.1s" }}
        onPointerDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
        onPointerUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
        onPointerLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        START RACE
      </button>
      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 12, textAlign: "center" }}>
        This will record your actual start time
      </div>
    </div>
  );
}

// ─── Phase 2: Running ─────────────────────────────────────────────────────────

function FabMenuItem({ icon, label, onClick, color, muted }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "16px 20px", background: "none", border: "none",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
        fontFamily: FONT, fontSize: 16, fontWeight: 600,
        color: muted ? "#9ca3af" : (color ?? "#0f172a"),
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ fontSize: 18, width: 24, textAlign: "center", lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

function RunningScreen({
  currentLeg, isLastLeg,
  legETAMap, calculatedLegs, runnerMap, legResults,
  onNextRunner, onAdjustCurrentLegStart,
  onUpdateLegPace, onEditLegTime,
  resetConfirm, onResetRace, onSetResetConfirm,
  stravaConnections, teamTime, onSetMode,
}) {
  const [fabOpen, setFabOpen] = useState(false);
  const currentLegIndex = calculatedLegs.findIndex(l => l.id === currentLeg);

  const lastLegId = calculatedLegs[calculatedLegs.length - 1]?.id;
  const predictedFinishMs = legETAMap?.get(lastLegId)?.endMs;
  const predictedFinishStr = predictedFinishMs ? formatLocalTime(predictedFinishMs) : null;
  const totalRaceTimeStr = teamTime ? formatTime(teamTime) : null;

  const closeFab = () => { setFabOpen(false); onSetResetConfirm(false); };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", margin: 0, padding: 0, boxSizing: "border-box", overflow: "hidden", zIndex: 50, background: "#000" }}>
      {/* Full-screen carousel */}
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px", boxSizing: "border-box" }}>
        <LegCarousel
          completedLegs={legResults}
          currentLegIndex={currentLegIndex}
          calculatedLegs={calculatedLegs}
          runnerMap={runnerMap}
          legETAMap={legETAMap}
          onNextRunner={onNextRunner}
          isLastLeg={isLastLeg}
          onEditPace={onUpdateLegPace}
          onEditLegTime={onEditLegTime}
          stravaConnections={stravaConnections}
        />
      </div>

      {/* FAB trigger */}
      <button
        onClick={() => setFabOpen(true)}
        aria-label="Race options"
        style={{
          position: "fixed",
          bottom: "calc(20px + env(safe-area-inset-bottom))",
          right: 20,
          width: 48, height: 48,
          borderRadius: "50%",
          background: "rgba(15,23,42,0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "#fff", fontSize: 22, lineHeight: 1,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
          boxShadow: "0 4px 18px rgba(0,0,0,0.32)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        ⋮
      </button>

      {/* FAB menu overlay */}
      {fabOpen && (
        <div
          onClick={closeFab}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(15,23,42,0.48)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              margin: "0 16px",
              marginBottom: "calc(16px + env(safe-area-inset-bottom))",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
            }}
          >
            {resetConfirm ? (
              <div style={{ padding: "20px 20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#991b1b", marginBottom: 4, textAlign: "center" }}>
                  Reset race?
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, textAlign: "center" }}>
                  All race data will be lost.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={closeFab}
                    style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#f1f5f9", fontSize: 15, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: FONT }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onResetRace}
                    style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: RED, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: FONT }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <>
                {predictedFinishStr && (
                  <>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(predictedFinishStr).catch(() => {}); closeFab(); }}
                      style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, WebkitTapHighlightColor: "transparent", textAlign: "left" }}
                    >
                      <span style={{ fontSize: 18, width: 24, textAlign: "center", lineHeight: 1, flexShrink: 0 }}>🏁</span>
                      <div style={{ display: "flex", gap: 20, flex: 1 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", fontFamily: FONT, lineHeight: 1.2 }}>Predicted Finish</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", fontFamily: FONT, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{predictedFinishStr}</div>
                        </div>
                        {totalRaceTimeStr && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", fontFamily: FONT, lineHeight: 1.2 }}>Total Time</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", fontFamily: FONT, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{totalRaceTimeStr}</div>
                          </div>
                        )}
                      </div>
                    </button>
                    <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />
                  </>
                )}
                {onSetMode && (
                  <FabMenuItem
                    icon="🏠"
                    label="Home"
                    onClick={() => { closeFab(); onSetMode("predictor"); }}
                  />
                )}
                <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />
                <FabMenuItem
                  icon="⏱"
                  label="Adjust start time"
                  onClick={() => { setFabOpen(false); onAdjustCurrentLegStart(); }}
                />
                <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />
                <FabMenuItem
                  icon="↺"
                  label="Reset race"
                  onClick={() => onSetResetConfirm(true)}
                  color={RED}
                />
                <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />
                <FabMenuItem icon="✕" label="Close" onClick={closeFab} muted />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phase 3: Exchange ────────────────────────────────────────────────────────

function ExchangeScreen({ data, onContinue }) {
  const { legNum, runnerName, distance, elapsedSeconds, diff, isLast } = data;
  const elapsedDisplay = formatTime(Math.round(Math.max(0, elapsedSeconds)));
  const paceStr = paceToDisplay(Math.max(1, elapsedSeconds), distance);
  const ahead = diff > 1;
  const behind = diff < -1;
  const diffDisplay = formatTime(Math.round(Math.abs(diff)));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", minHeight: "70vh", textAlign: "center" }}>
      <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 16, color: GREEN }}>✓</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", fontFamily: FONT, letterSpacing: "-0.02em", marginBottom: 10 }}>
        {isLast ? "🏁 Race Complete!" : `Leg ${legNum} Complete!`}
      </div>
      <div style={{ fontSize: 16, color: "#64748b", marginBottom: 16 }}>
        {runnerName} · {distance}mi · {elapsedDisplay} · {paceStr}/mi
      </div>
      {ahead && <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", marginBottom: 32 }}>Ahead by {diffDisplay}</div>}
      {behind && <div style={{ fontSize: 16, fontWeight: 700, color: RED, marginBottom: 32 }}>Behind by {diffDisplay}</div>}
      {!ahead && !behind && <div style={{ fontSize: 16, fontWeight: 700, color: "#64748b", marginBottom: 32 }}>On pace!</div>}
      <button
        onClick={onContinue}
        style={{ padding: "14px 36px", background: "#f1f5f9", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: FONT, color: "#374151" }}
      >
        Continue →
      </button>
    </div>
  );
}

// ─── Phase 4: Finish ──────────────────────────────────────────────────────────

function FinishScreen({
  elapsedDisplay, fastestLeg, slowestLeg, totalElapsedSec, totalDist,
  legResults, calculatedLegs, runnerMap,
  onSetLegEditModal,
  resetConfirm, onResetRace, onSetResetConfirm,
  onShowReport,
}) {
  return (
    <div style={{ padding: "32px 20px 32px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#374151", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          🏁 Race Complete!
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, color: "#0f172a", fontFamily: FONT, letterSpacing: "-0.04em", lineHeight: 1 }}>
          {elapsedDisplay ?? "--"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {totalDist > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(0,0,0,0.04)", borderRadius: 10, minHeight: 48 }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>Team avg pace</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: FONT }}>{paceToDisplay(totalElapsedSec, totalDist)}/mi</span>
          </div>
        )}
        {fastestLeg && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 10, minHeight: 48, gap: 8 }}>
            <span style={{ fontSize: 14, color: "#16a34a", flexShrink: 0 }}>Fastest leg</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: FONT, textAlign: "right" }}>
              Leg {fastestLeg.legId} · {runnerMap[fastestLeg.runnerId]?.name} · {paceToDisplay(fastestLeg.elapsedSeconds, fastestLeg.distance)}/mi
            </span>
          </div>
        )}
        {slowestLeg && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, minHeight: 48, gap: 8 }}>
            <span style={{ fontSize: 14, color: "#dc2626", flexShrink: 0 }}>Slowest leg</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: FONT, textAlign: "right" }}>
              Leg {slowestLeg.legId} · {runnerMap[slowestLeg.runnerId]?.name} · {paceToDisplay(slowestLeg.elapsedSeconds, slowestLeg.distance)}/mi
            </span>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 10, fontFamily: FONT }}>All Legs</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {legResults.map((res, ri) => {
          const cl = calculatedLegs.find(l => l.id === res.legId);
          const rn = runnerMap[res.runnerId];
          const diff = (cl?.time ?? 0) - res.elapsedSeconds;
          return (
            <div key={res.legId} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", flexShrink: 0 }}>Leg {res.legId}</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{rn?.name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{formatTime(Math.round(res.elapsedSeconds))}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: diff >= 0 ? "#16a34a" : RED }}>
                  {diff >= 0 ? "+" : ""}{formatTime(Math.round(Math.abs(diff)))}
                </span>
                <button
                  onClick={() => onSetLegEditModal({ resultIndex: ri, legId: res.legId, legName: cl?.name ?? `Leg ${res.legId}`, distance: res.distance, startMs: res.startTime, endMs: res.endTime })}
                  style={{ fontSize: 11, background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 7px", cursor: "pointer", color: "#64748b", fontFamily: "inherit" }}
                >✏️</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          onClick={onShowReport}
          style={{ width: "100%", padding: "14px 0", background: "#009DE0", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 12 }}
        >
          View Race Report
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        {resetConfirm ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#991b1b", fontWeight: 600 }}>Reset race? All data will be lost.</span>
            <button onClick={onResetRace} style={{ padding: "6px 14px", background: RED, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
            <button onClick={() => onSetResetConfirm(false)} style={{ padding: "6px 14px", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => onSetResetConfirm(true)} style={{ fontSize: 14, background: "#f1f5f9", border: "none", borderRadius: 8, color: "#374151", cursor: "pointer", fontFamily: "inherit", padding: "10px 20px", fontWeight: 600 }}>
            ↺ Reset Race
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ManualRacePanel({
  status,
  exchangeScreen,
  currentLeg,
  legResults,
  calculatedLegs,
  runnerMap,
  runners,
  currentRunner,
  currentCalcLeg,
  isLastLeg,
  countdownMs,
  legETAMap,
  elapsedDisplay,
  fastestLeg,
  slowestLeg,
  longestLeg,
  totalElapsedSec,
  totalDist,
  teamTime,
  startTime,
  resetConfirm,
  onStartRace,
  onNextRunner,
  onResetRace,
  onSetLegEditModal,
  onAdjustCurrentLegStart,
  onSetResetConfirm,
  onClearExchange,
  onUpdateLegPace,
  onEditLegTime,
  stravaConnections,
  onSetMode,
  raceStartedAt,
  raceEndedAt,
}) {
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (status === "completed") setShowReport(true);
  }, [status]);

  useEffect(() => {
    if (!exchangeScreen) return;
    const t = setTimeout(onClearExchange, 3000);
    return () => clearTimeout(t);
  }, [exchangeScreen, onClearExchange]);

  if (exchangeScreen) {
    return <ExchangeScreen data={exchangeScreen} onContinue={onClearExchange} />;
  }

  if (status === "idle") {
    return (
      <PreRaceScreen
        calculatedLegs={calculatedLegs}
        runners={runners}
        teamTime={teamTime}
        startTime={startTime}
        onStartRace={onStartRace}
      />
    );
  }

  if (status === "in_progress") {
    return (
      <RunningScreen
        currentLeg={currentLeg}
        isLastLeg={isLastLeg}
        legETAMap={legETAMap}
        calculatedLegs={calculatedLegs}
        runnerMap={runnerMap}
        legResults={legResults}
        onNextRunner={onNextRunner}
        onAdjustCurrentLegStart={onAdjustCurrentLegStart}
        onUpdateLegPace={onUpdateLegPace}
        onEditLegTime={onEditLegTime}
        resetConfirm={resetConfirm}
        onResetRace={onResetRace}
        onSetResetConfirm={onSetResetConfirm}
        stravaConnections={stravaConnections}
        teamTime={teamTime}
        onSetMode={onSetMode}
      />
    );
  }

  if (status === "completed") {
    return (
      <>
        <FinishScreen
          elapsedDisplay={elapsedDisplay}
          fastestLeg={fastestLeg}
          slowestLeg={slowestLeg}
          totalElapsedSec={totalElapsedSec}
          totalDist={totalDist}
          legResults={legResults}
          calculatedLegs={calculatedLegs}
          runnerMap={runnerMap}
          onSetLegEditModal={onSetLegEditModal}
          resetConfirm={resetConfirm}
          onResetRace={onResetRace}
          onSetResetConfirm={onSetResetConfirm}
          onShowReport={() => setShowReport(true)}
        />
        {showReport && (
          <PostRaceReport
            teamTime={teamTime}
            totalElapsedSec={totalElapsedSec}
            totalDist={totalDist}
            fastestLeg={fastestLeg}
            slowestLeg={slowestLeg}
            longestLeg={longestLeg}
            legResults={legResults}
            calculatedLegs={calculatedLegs}
            runnerMap={runnerMap}
            raceStartedAt={raceStartedAt}
            raceEndedAt={raceEndedAt}
            onClose={() => setShowReport(false)}
          />
        )}
      </>
    );
  }

  // Unknown/stale status — fall back to pre-race view
  return (
    <PreRaceScreen
      calculatedLegs={calculatedLegs}
      runners={runners}
      teamTime={teamTime}
      startTime={startTime}
      onStartRace={onStartRace}
    />
  );
}
