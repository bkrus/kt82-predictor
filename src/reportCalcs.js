// Pure calculation functions shared by App.jsx, PostRaceReport.jsx, and regression-test.js.
// Keeping them here ensures the regression test runs the same code as production.

// ── App.jsx leg-result aggregations ──────────────────────────────────────────

export const calcFastestLeg = legResults =>
  legResults.length
    ? legResults.reduce((b, r) => (!b || r.actualPace < b.actualPace) ? r : b, null)
    : null;

export const calcSlowestLeg = legResults =>
  legResults.length
    ? legResults.reduce((w, r) => (!w || r.actualPace > w.actualPace) ? r : w, null)
    : null;

export const calcLongestLeg = legResults =>
  legResults.length
    ? legResults.reduce((b, r) => (!b || r.distance > b.distance) ? r : b, null)
    : null;

export const calcMountainGoatLeg = legResults =>
  legResults.length
    ? legResults.reduce((b, r) => (!b || (r.elevationGainFt ?? 0) > (b.elevationGainFt ?? 0)) ? r : b, null)
    : null;

export const calcTotalElapsedSec = legResults =>
  legResults.reduce((s, r) => s + r.elapsedSeconds, 0);

export const calcTotalDist = legResults =>
  legResults.reduce((s, r) => s + r.distance, 0);

// ── PostRaceReport.jsx aggregations ──────────────────────────────────────────

export const calcTotalElevationFt = legResults =>
  legResults.reduce((s, r) => s + (r.elevationGainFt ?? 0), 0);

export function calcBestPrediction(legResults, calculatedLegs) {
  if (!legResults.length) return null;
  const predictions = legResults.map(res => {
    const cl = calculatedLegs.find(l => l.id === res.legId);
    return { legId: res.legId, accuracy: Math.abs((cl?.time ?? 0) - res.elapsedSeconds) };
  });
  return predictions.sort((a, b) => a.accuracy - b.accuracy)[0];
}

// Mountain Goat render condition — PostRaceReport.jsx
export const shouldShowMountainGoat = mountainGoatLeg =>
  mountainGoatLeg != null && (mountainGoatLeg.elevationGainFt ?? 0) > 0;

// ── Leg-edit cascade — App.jsx handleSaveLegEdit pure transform ───────────────
// Returns an updated copy of legResults with recomputed times.
// Does NOT call Supabase — callers handle persistence.

export function applyLegEditCascade(legResults, resultIndex, newStartMs, newEndMs) {
  const updated = legResults.map(r => ({ ...r }));
  const r = updated[resultIndex];
  if (!r) return updated;
  const elapsed  = Math.max(1, (newEndMs - newStartMs) / 1000);
  const editedAt = new Date().toISOString();

  // Backward cascade: if start changed, sync previous leg's end time to match
  if (resultIndex > 0 && newStartMs !== r.startTime) {
    const prev      = updated[resultIndex - 1];
    const prevElapsed = Math.max(1, (newStartMs - prev.startTime) / 1000);
    updated[resultIndex - 1] = {
      ...prev,
      endTime:       newStartMs,
      elapsedSeconds: prevElapsed,
      actualPace:    prevElapsed / 60 / prev.distance,
      editedAt,
      runnerStravaId: prev.runnerStravaId || null,
      runnerName:    prev.runnerName     || "Unknown",
    };
  }

  updated[resultIndex] = {
    ...r,
    startTime:      newStartMs,
    endTime:        newEndMs,
    elapsedSeconds: elapsed,
    actualPace:     elapsed / 60 / r.distance,
    editedAt,
    runnerStravaId: r.runnerStravaId || null,
    runnerName:     r.runnerName     || "Unknown",
  };

  // Forward cascade: propagate end-time change into subsequent legs' start times
  for (let i = resultIndex + 1; i < updated.length; i++) {
    const prevEnd = updated[i - 1].endTime;
    const cur     = updated[i];
    const e       = Math.max(1, (cur.endTime - prevEnd) / 1000);
    updated[i] = {
      ...cur,
      startTime:      prevEnd,
      elapsedSeconds: e,
      actualPace:     e / 60 / cur.distance,
      editedAt,
      runnerStravaId: cur.runnerStravaId || null,
      runnerName:     cur.runnerName     || "Unknown",
    };
  }
  return updated;
}
