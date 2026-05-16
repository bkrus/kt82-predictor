import { formatTime } from "../utils";
import { S, RUNNER_LEG_BADGE_STYLE } from "../styles";

export function RunnerTotals({ runnerTotals, calculatedLegs, fastestRunnerId }) {
  return (
    <div style={S.runnerTotalsGrid}>
      {runnerTotals.map((r) => {
        const heavy = r.totalDistance > 16;
        return (
          <div
            key={r.id}
            className="kt82-runner-card"
            style={{
              ...S.runnerCard,
              borderColor: heavy ? "#fca5a5" : "#e5e7eb",
              background: heavy ? "rgba(254,242,242,0.6)" : "#fafafa",
              borderLeft: heavy ? "3px solid #ef4444" : undefined,
            }}
          >
            <div style={S.runnerCardTop}>
              <span style={S.runnerCardName}>{r.name}</span>
              {r.id === fastestRunnerId && <span style={S.runnerFastBadge}>Fastest avg pace</span>}
              {heavy && <span style={S.runnerHeavyBadge}>16+ miles</span>}
            </div>
            <div style={S.runnerStatsGrid}>
              <div style={S.runnerStat}>
                <span style={S.runnerStatLabel}>Miles</span>
                <span style={{ ...S.runnerStatValue, color: heavy ? "#dc2626" : "#0f172a" }}>{r.totalDistance.toFixed(1)}</span>
              </div>
              <div style={S.runnerStat}>
                <span style={S.runnerStatLabel}>Time</span>
                <span style={S.runnerStatValue}>{formatTime(r.totalTime)}</span>
              </div>
              <div style={S.runnerStat}>
                <span style={S.runnerStatLabel}>Avg pace</span>
                <span style={S.runnerStatValue}>{Number.isFinite(r.averagePaceSeconds) ? formatTime(Math.round(r.averagePaceSeconds)) : "—"}</span>
              </div>
            </div>
            <div style={S.runnerLegBadges}>
              {r.assignedLegs.map((legId) => {
                const rating = calculatedLegs.find((l) => l.id === legId)?.rating;
                const ratingStyle = RUNNER_LEG_BADGE_STYLE[rating] ?? {};
                return (
                  <span key={legId} style={{ ...S.runnerLegBadge, ...ratingStyle }}>Leg {legId}</span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
