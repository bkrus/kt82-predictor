import { useRef } from "react";
import { formatTime, paceToDisplay } from "../utils";

const GO_BLUE = "#009DE0";
const NAVY = "#0a1628";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

export function PostRaceReport({
  teamTime,
  totalElapsedSec,
  totalDist,
  fastestLeg,
  slowestLeg,
  legResults,
  calculatedLegs,
  runnerMap,
  raceStartedAt,
  raceEndedAt,
  onClose,
}) {
  const reportRef = useRef(null);

  const totalTimeStr = formatTime(teamTime);
  const avgPace = totalDist > 0 ? paceToDisplay(totalElapsedSec, totalDist) : "—";
  const startDate = raceStartedAt ? new Date(raceStartedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const startTime = raceStartedAt ? new Date(raceStartedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  const endTime = raceEndedAt ? new Date(raceEndedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  const predictions = legResults.map((res) => {
    const cl = calculatedLegs.find(l => l.id === res.legId);
    return { legId: res.legId, accuracy: Math.abs((cl?.time ?? 0) - res.elapsedSeconds) };
  });
  const bestPred = predictions.sort((a, b) => a.accuracy - b.accuracy)[0];

  const downloadAsImage = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: NAVY, scale: 2, logging: false });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `KT82-Race-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const S = {
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1000, fontFamily: FONT },
    modal: { background: NAVY, borderRadius: 20, maxWidth: 420, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" },
    hero: { background: GO_BLUE, padding: "32px 28px 24px", position: "relative", overflow: "hidden" },
    eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", marginBottom: 12 },
    time: { fontSize: 58, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 },
    date: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 10 },
    chips: { display: "flex", gap: 10, marginTop: 20 },
    chip: { background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "10px 14px", flex: 1 },
    chipLabel: { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 },
    chipVal: { fontSize: 18, fontWeight: 700, color: "#fff" },
    body: { padding: "24px 28px" },
    sectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GO_BLUE, marginBottom: 14 },
    highlight: { display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
    icon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 },
    hName: { fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 },
    hSub: { fontSize: 12, color: "#64748b" },
    hRight: { marginLeft: "auto", textAlign: "right" },
    legsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 14 },
    leg: { background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "9px 11px", display: "flex", alignItems: "center" },
    legId: { fontSize: 11, color: "#475569", fontWeight: 600, marginRight: 6, flexShrink: 0 },
    legRunner: { fontSize: 11, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    divider: { height: 1, background: "rgba(255,255,255,0.06)", margin: "22px 0" },
    footer: { padding: "0 28px 28px", display: "flex", gap: 10 },
    btnPrimary: { flex: 1, padding: 14, background: GO_BLUE, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT },
    btnSecondary: { flex: 1, padding: 14, background: "rgba(255,255,255,0.07)", color: "#94a3b8", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT },
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div ref={reportRef}>
          {/* Hero */}
          <div style={S.hero}>
            <div style={S.eyebrow}>KT82 Trail Relay · {startDate}</div>
            <div style={S.time}>{totalTimeStr}</div>
            <div style={S.date}>{startTime} start · {endTime} finish · {totalDist.toFixed(1)} mi</div>
            <div style={S.chips}>
              <div style={S.chip}>
                <div style={S.chipLabel}>Avg pace</div>
                <div style={S.chipVal}>{avgPace}</div>
              </div>
              <div style={S.chip}>
                <div style={S.chipLabel}>Runners</div>
                <div style={S.chipVal}>{Object.keys(runnerMap).length}</div>
              </div>
              <div style={S.chip}>
                <div style={S.chipLabel}>Legs</div>
                <div style={S.chipVal}>{legResults.length}</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={S.body}>
            <div style={S.sectionLabel}>Highlights</div>

            {fastestLeg && (
              <div style={S.highlight}>
                <div style={{ ...S.icon, background: "rgba(0,157,224,0.15)" }}>⚡</div>
                <div>
                  <div style={S.hName}>{runnerMap[fastestLeg.runnerId]?.name} · Leg {fastestLeg.legId}</div>
                  <div style={S.hSub}>Fastest leg · {fastestLeg.distance?.toFixed(1)} mi</div>
                </div>
                <div style={S.hRight}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: GO_BLUE }}>{paceToDisplay(fastestLeg.elapsedSeconds, fastestLeg.distance)}/mi</div>
                </div>
              </div>
            )}

            {slowestLeg && (
              <div style={{ ...S.highlight, borderBottom: "none" }}>
                <div style={{ ...S.icon, background: "rgba(248,113,113,0.12)" }}>🛡</div>
                <div>
                  <div style={S.hName}>{runnerMap[slowestLeg.runnerId]?.name} · Leg {slowestLeg.legId}</div>
                  <div style={S.hSub}>Longest leg · {slowestLeg.distance?.toFixed(1)} mi</div>
                </div>
                <div style={S.hRight}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>{paceToDisplay(slowestLeg.elapsedSeconds, slowestLeg.distance)}/mi</div>
                </div>
              </div>
            )}

            {bestPred && (
              <div style={{ ...S.highlight, borderBottom: "none" }}>
                <div style={{ ...S.icon, background: "rgba(251,191,36,0.12)" }}>🎯</div>
                <div>
                  <div style={S.hName}>Best prediction · Leg {bestPred.legId}</div>
                  <div style={S.hSub}>Off by {formatTime(Math.round(bestPred.accuracy))}</div>
                </div>
              </div>
            )}

            <div style={S.divider} />
            <div style={S.sectionLabel}>All legs · vs predicted</div>

            <div style={S.legsGrid}>
              {legResults.map((res) => {
                const cl = calculatedLegs.find(l => l.id === res.legId);
                const diff = (cl?.time ?? 0) - res.elapsedSeconds;
                const isAhead = diff > 0;
                return (
                  <div key={res.legId} style={S.leg}>
                    <span style={S.legId}>L{res.legId}</span>
                    <span style={S.legRunner}>{runnerMap[res.runnerId]?.name ?? "—"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isAhead ? "#10b981" : "#f87171", flexShrink: 0 }}>
                      {isAhead ? "+" : ""}{formatTime(Math.round(Math.abs(diff)))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.btnPrimary} onClick={downloadAsImage}>⬇ Download</button>
          <button style={S.btnSecondary} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
