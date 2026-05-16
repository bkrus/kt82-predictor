import { formatTime, formatManualCountdown, formatLocalTime, paceToDisplay } from "../utils";

export function ManualRacePanel({
  status,
  currentLeg,
  legResults,
  calculatedLegs,
  runnerMap,
  runners,
  currentTime,
  currentRunner,
  currentCalcLeg,
  isLastLeg,
  countdownMs,
  legETAMap,
  elapsedDisplay,
  legElapsedDisplay,
  projectedFinishMs,
  fastestLeg,
  slowestLeg,
  totalElapsedSec,
  totalDist,
  resetConfirm,
  onStartRace,
  onNextRunner,
  onResetRace,
  onSetLegEditModal,
  onAdjustCurrentLegStart,
  onSetResetConfirm,
}) {
  return (
    <>
      {status !== "idle" && (
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#92400e", fontFamily: "'Archivo', system-ui, sans-serif" }}>⏱ MANUAL MODE</span>
          <span style={{ fontSize: 12, color: "#b45309", fontWeight: 500 }}>Strava sync disabled — recording actual exchange times</span>
        </div>
      )}

      {status === "idle" && (
        <div style={{ textAlign: "center", padding: "28px 0 16px" }}>
          <button
            onClick={onStartRace}
            style={{ padding: "16px 44px", background: "#f59e0b", border: "none", borderRadius: 14, color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: "'Archivo', system-ui, sans-serif", letterSpacing: "-0.02em", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}
          >
            Start Race (Manual Mode)
          </button>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
            Records actual exchange times · Works without Strava
          </div>
        </div>
      )}

      {status === "in_progress" && (
        <div style={{ background: "#0f172a", border: "2px solid #f59e0b", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "rgba(245,158,11,0.1)", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#fbbf24", fontFamily: "'Archivo', system-ui, sans-serif" }}>🏃 Race in progress</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>Leg {currentLeg} of {calculatedLegs.length}</span>
          </div>

          <div style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginBottom: 4, fontFamily: "'Archivo', system-ui, sans-serif" }}>Currently running</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em", fontFamily: "'Archivo', system-ui, sans-serif" }}>{currentRunner?.name ?? "—"}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Leg {currentLeg} · {currentCalcLeg?.distance} mi</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#f59e0b", marginBottom: 6, fontFamily: "'Archivo', system-ui, sans-serif" }}>⏱ Manual Timing</div>
                <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: countdownMs != null && countdownMs < 0 ? "#ef4444" : "#f8fafc", fontFamily: "'Archivo', system-ui, sans-serif", border: `2px solid ${countdownMs != null && countdownMs < 0 ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.3)"}`, borderRadius: 10, padding: "6px 14px", display: "inline-block" }}>
                  {countdownMs != null ? formatManualCountdown(countdownMs) : "--:--"}
                </div>
                {countdownMs != null && countdownMs < 0 && (
                  <div style={{ fontSize: 10, color: "#ef4444", marginTop: 3, fontWeight: 600 }}>Over predicted time</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
              {[
                { label: "Expected at", val: formatLocalTime(legETAMap.get(currentLeg)?.endMs) },
                { label: "Current time", val: currentTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) },
                { label: "Total elapsed", val: elapsedDisplay ?? "--" },
                { label: "Projected finish", val: formatLocalTime(projectedFinishMs) },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{val}</div>
                </div>
              ))}
            </div>

            <button
              onClick={onNextRunner}
              style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: isLastLeg ? "#16a34a" : "#f59e0b", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "'Archivo', system-ui, sans-serif", letterSpacing: "-0.02em", marginBottom: 6 }}
            >
              {isLastLeg ? "🏁 Finish Race" : "Next Runner →"}
            </button>
            <div style={{ fontSize: 11, color: "#475569", textAlign: "center" }}>
              {isLastLeg ? "Records final exchange time" : "Records actual exchange time"}
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button
                onClick={onAdjustCurrentLegStart}
                style={{ fontSize: 11, background: "none", border: "none", color: "#475569", cursor: "pointer", textDecoration: "underline", padding: "4px 8px", fontFamily: "inherit" }}
              >
                Adjust ✏️ start time for this leg
              </button>
            </div>
          </div>

          {legResults.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px 16px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", display: "block", marginBottom: 8, fontFamily: "'Archivo', system-ui, sans-serif" }}>Completed legs</span>
              {legResults.map((res, ri) => {
                const cl = calculatedLegs.find((l) => l.id === res.legId);
                const rn = runnerMap[res.runnerId];
                const diff = (cl?.time ?? 0) - res.elapsedSeconds;
                const ahead = diff > 0;
                return (
                  <div key={res.legId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", width: 44, flexShrink: 0 }}>Leg {res.legId}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", minWidth: 70, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rn?.name ?? "—"}</span>
                    <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{res.distance} mi</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", flexShrink: 0 }}>{formatTime(Math.round(res.elapsedSeconds))}</span>
                    <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{paceToDisplay(res.elapsedSeconds, res.distance)}/mi</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: ahead ? "#4ade80" : "#f87171", flexShrink: 0 }}>
                      {ahead ? "+" : "-"}{formatTime(Math.round(Math.abs(diff)))}
                    </span>
                    <button
                      onClick={() => onSetLegEditModal({ resultIndex: ri, legId: res.legId, legName: cl?.name ?? `Leg ${res.legId}`, distance: res.distance, startMs: res.startTime, endMs: res.endTime })}
                      style={{ fontSize: 11, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 5, padding: "2px 7px", cursor: "pointer", color: "#f59e0b", flexShrink: 0, fontFamily: "inherit" }}
                    >Edit ✏️</button>
                  </div>
                );
              })}
            </div>
          )}

          {currentLeg < calculatedLegs.length && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px 16px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", display: "block", marginBottom: 8, fontFamily: "'Archivo', system-ui, sans-serif" }}>Upcoming legs</span>
              {calculatedLegs.filter((l) => l.id > currentLeg).map((leg) => {
                const eta = legETAMap.get(leg.id);
                const rn = runnerMap[leg.runnerId];
                return (
                  <div key={leg.id} className="kt82-upcoming-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", width: 44, flexShrink: 0 }}>Leg {leg.id}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", minWidth: 80, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rn?.name ?? "—"}</span>
                    <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{leg.distance} mi</span>
                    <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{formatTime(Math.round(leg.time))}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", flexShrink: 0 }}>~{formatLocalTime(eta?.endMs)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {status === "completed" && (
        <div style={{ background: "#0f172a", border: "2px solid #16a34a", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "rgba(22,163,74,0.12)", borderBottom: "1px solid rgba(22,163,74,0.2)" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#4ade80", fontFamily: "'Archivo', system-ui, sans-serif" }}>🏁 Race Complete!</span>
            <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>⏱ Manual Mode</span>
          </div>
          <div style={{ padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 10, marginBottom: 20 }}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total time</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc", fontFamily: "'Archivo', system-ui, sans-serif" }}>{elapsedDisplay ?? "--"}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Team avg pace</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc", fontFamily: "'Archivo', system-ui, sans-serif" }}>{totalDist > 0 ? `${paceToDisplay(totalElapsedSec, totalDist)}/mi` : "--"}</div>
              </div>
              {fastestLeg && (
                <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.1em" }}>Fastest leg</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>Leg {fastestLeg.legId}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{runnerMap[fastestLeg.runnerId]?.name} · {paceToDisplay(fastestLeg.elapsedSeconds, fastestLeg.distance)}/mi</div>
                </div>
              )}
              {slowestLeg && (
                <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.1em" }}>Slowest leg</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>Leg {slowestLeg.legId}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{runnerMap[slowestLeg.runnerId]?.name} · {paceToDisplay(slowestLeg.elapsedSeconds, slowestLeg.distance)}/mi</div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginBottom: 8, fontFamily: "'Archivo', system-ui, sans-serif" }}>Runner results</div>
            {runners.map((runner) => {
              const rResults = legResults.filter((r) => r.runnerId === runner.id);
              if (!rResults.length) return null;
              const rSec = rResults.reduce((s, r) => s + r.elapsedSeconds, 0);
              const rDist = rResults.reduce((s, r) => s + r.distance, 0);
              const rPredSec = calculatedLegs.filter((l) => l.runnerId === runner.id && rResults.some((r) => r.legId === l.id)).reduce((s, l) => s + l.time, 0);
              const diff = rPredSec - rSec;
              return (
                <div key={runner.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", flex: 1, minWidth: 80 }}>{runner.name}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{rDist.toFixed(1)} mi</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{formatTime(Math.round(rSec))}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{paceToDisplay(rSec, rDist)}/mi</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: diff >= 0 ? "#4ade80" : "#f87171" }}>
                    {diff >= 0 ? `+${formatTime(Math.round(diff))} ahead` : `-${formatTime(Math.round(-diff))} behind`}
                  </span>
                </div>
              );
            })}

            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginTop: 18, marginBottom: 8, fontFamily: "'Archivo', system-ui, sans-serif" }}>All legs</div>
            {legResults.map((res, ri) => {
              const cl = calculatedLegs.find((l) => l.id === res.legId);
              const rn = runnerMap[res.runnerId];
              const diff = (cl?.time ?? 0) - res.elapsedSeconds;
              return (
                <div key={res.legId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", width: 44, flexShrink: 0 }}>Leg {res.legId}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 60 }}>{rn?.name ?? "—"}</span>
                  <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{res.distance} mi</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", flexShrink: 0 }}>{formatTime(Math.round(res.elapsedSeconds))}</span>
                  <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{paceToDisplay(res.elapsedSeconds, res.distance)}/mi</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: diff >= 0 ? "#4ade80" : "#f87171", flexShrink: 0 }}>
                    {diff >= 0 ? "+" : "-"}{formatTime(Math.round(Math.abs(diff)))}
                  </span>
                  <button
                    onClick={() => onSetLegEditModal({ resultIndex: ri, legId: res.legId, legName: cl?.name ?? `Leg ${res.legId}`, distance: res.distance, startMs: res.startTime, endMs: res.endTime })}
                    style={{ fontSize: 11, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 5, padding: "2px 7px", cursor: "pointer", color: "#f59e0b", flexShrink: 0, fontFamily: "inherit" }}
                  >Edit ✏️</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {status !== "idle" && (
        <div style={{ marginBottom: 12 }}>
          {resetConfirm ? (
            <div style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#991b1b", fontWeight: 600, flex: 1 }}>Reset race? All timing data will be lost.</span>
              <button onClick={onResetRace} style={{ padding: "6px 14px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
              <button onClick={() => onSetResetConfirm(false)} style={{ padding: "6px 14px", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button className="kt82-reset-btn" onClick={() => onSetResetConfirm(true)}>↺ Reset Race</button>
          )}
        </div>
      )}
    </>
  );
}
