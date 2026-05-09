import { useState, useMemo, useRef, useEffect } from "react";

const defaultRunners = [
  { id: "r1", name: "Runner 1", pace: "9:30" },
  { id: "r2", name: "Runner 2", pace: "9:30" },
  { id: "r3", name: "Runner 3", pace: "9:30" },
  { id: "r4", name: "Runner 4", pace: "9:30" },
  { id: "r5", name: "Runner 5", pace: "9:30" },
  { id: "r6", name: "Runner 6", pace: "9:30" },
];


const defaultLegs = [
  { id: 1, name: "Aquaport to Lakehouse Bar & Grill", distance: 5.10, runnerId: "r1", rating: "Medium", factor: 1.03, pace: "" },
  { id: 2, name: "Lakehouse Bar & Grill to 364 Access", distance: 3.90, runnerId: "r2", rating: "Easy", factor: 1.0, pace: "" },
  { id: 3, name: "364 Access to Greens Bottom Rd", distance: 3.20, runnerId: "r3", rating: "Single Track", factor: 1.12, pace: "" },
  { id: 4, name: "Greens Bottom Rd to Missouri Research Park", distance: 7.24, runnerId: "r4", rating: "Difficult", factor: 1.08, pace: "" },
  { id: 5, name: "MO Research Park to Lewis & Clark TH", distance: 4.72, runnerId: "r5", rating: "Medium", factor: 1.03, pace: "" },
  { id: 6, name: "Lewis and Clark TH to Weldon Spring TH", distance: 5.89, runnerId: "r6", rating: "Difficult", factor: 1.08, pace: "" },
  { id: 7, name: "Weldon Spring TH to Weldon Spring CA", distance: 5.73, runnerId: "r1", rating: "Medium", factor: 1.03, pace: "" },
  { id: 8, name: "Weldon Spring Conservation to Matson", distance: 4.43, runnerId: "r2", rating: "Easy", factor: 1.0, pace: "" },
  { id: 9, name: "Matson to Klondike Park", distance: 3.20, runnerId: "r3", rating: "Single Track", factor: 1.12, pace: "" },
  { id: 10, name: "Klondike Park to Augusta", distance: 3.17, runnerId: "r4", rating: "Easy", factor: 1.0, pace: "" },
  { id: 11, name: "Augusta to Dutzow", distance: 7.56, runnerId: "r5", rating: "Difficult", factor: 1.08, pace: "" },
  { id: 12, name: "Dutzow to Marthasville", distance: 3.78, runnerId: "r6", rating: "Medium", factor: 1.03, pace: "" },
  { id: 13, name: "Marthasville to Treloar", distance: 6.96, runnerId: "r1", rating: "Difficult", factor: 1.08, pace: "" },
  { id: 14, name: "Treloar to Bernheimer Rd", distance: 4.17, runnerId: "r2", rating: "Easy", factor: 1.0, pace: "" },
  { id: 15, name: "Bernheimer Rd to Gore-Case Comm Ctr", distance: 6.14, runnerId: "r3", rating: "Medium", factor: 1.03, pace: "" },
  { id: 16, name: "Gore-Case Comm Ctr to Case Road", distance: 2.69, runnerId: "r4", rating: "Single Track", factor: 1.12, pace: "" },
  { id: 17, name: "Case Road to McKittrick", distance: 3.90, runnerId: "r5", rating: "Easy", factor: 1.0, pace: "" },
  { id: 18, name: "McKittrick to Hermann!", distance: 2.60, runnerId: "r6", rating: "Medium", factor: 1.03, pace: "" },
];

function paceToSeconds(pace) {
  const [min, sec] = pace.split(":").map(Number);
  return min * 60 + sec;
}

function timeToSeconds(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 3600 + m * 60;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime12Hour(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
}

export default function App() {
  const [runners, setRunners] = useState(defaultRunners);
  const [legs, setLegs] = useState(defaultLegs);
  const [startTime, setStartTime] = useState("08:00");

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const styles = {
    page: {
      padding: "28px 18px 40px",
      fontFamily: "Inter, Segoe UI, sans-serif",
      background: "#f4f7fb",
      minHeight: "100vh",
      color: "#111827",
    },
    content: {
      maxWidth: 1160,
      margin: "0 auto",
    },
    header: {
      marginBottom: 28,
    },
    title: {
      margin: 0,
      fontSize: 40,
      letterSpacing: "-0.04em",
      lineHeight: 1.05,
      fontWeight: 800,
    },
    subtitle: {
      marginTop: 12,
      color: "#4b5563",
      fontSize: 16,
      maxWidth: 760,
      lineHeight: 1.75,
    },
    topBar: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 22,
      alignItems: "stretch",
      marginBottom: 0,
    },
    startCard: {
      background: "#ffffff",
      borderRadius: 24,
      border: "1px solid rgba(148, 163, 184, 0.24)",
      boxShadow: "0 22px 58px rgba(15, 23, 42, 0.08)",
      padding: 24,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: 180,
    },
    startBlock: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      width: "100%",
    },
    startLabel: {
      color: "#6b7280",
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      marginBottom: 8,
    },
    summaryGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 18,
      alignItems: "stretch",
      width: "100%",
    },
    summaryBox: {
      background: "#ffffff",
      borderRadius: 22,
      border: "1px solid rgba(229, 231, 235, 0.9)",
      padding: 22,
      minHeight: 140,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 8,
      textAlign: "left",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
    },
    panel: {
      background: "#ffffff",
      borderRadius: 24,
      boxShadow: "0 24px 64px rgba(15, 23, 42, 0.08)",
      border: "1px solid rgba(229, 231, 235, 0.85)",
      padding: 24,
      marginBottom: 28,
    },
    sectionTitle: {
      margin: 0,
      marginBottom: 20,
      fontSize: 22,
      borderBottom: "1px solid #e5e7eb",
      paddingBottom: 14,
      color: "#111827",
    },
    row: {
      display: "flex",
      flexWrap: "wrap",
      gap: 16,
      alignItems: "center",
      marginBottom: 18,
    },
    labelBlock: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minWidth: 180,
      flex: "1 1 260px",
      color: "#374151",
      fontSize: 15,
    },
    input: {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #d1d5db",
      background: "#f8fafc",
      fontSize: 15,
      color: "#111827",
      outline: "none",
      transition: "all 0.2s ease",
    },
    smallInput: {
      width: 120,
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #d1d5db",
      background: "#f8fafc",
      fontSize: 15,
      color: "#111827",
    },
    select: {
      width: 160,
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #d1d5db",
      background: "#ffffff",
      fontSize: 15,
      color: "#111827",
    },
    summaryLabel: {
      fontSize: 13,
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
    },
    summaryValue: {
      margin: 0,
      fontSize: 28,
      fontWeight: 700,
      color: "#111827",
      lineHeight: 1.1,
    },
    legCard: {
      position: "relative",
      marginBottom: 18,
      padding: 24,
      borderRadius: 24,
      background: "#ffffff",
      border: "1px solid rgba(229, 231, 235, 0.95)",
      boxShadow: "0 20px 52px rgba(15, 23, 42, 0.06)",
    },
    trailBadge: {
      position: "absolute",
      top: 16,
      left: 16,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16, 185, 129, 0.12)",
      color: "#065f46",
      fontSize: 13,
      fontWeight: 700,
      border: "1px solid rgba(16, 185, 129, 0.26)",
      zIndex: 1,
    },
    easyBadge: {
      position: "absolute",
      top: 16,
      left: 16,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(14, 165, 233, 0.12)",
      color: "#0c4a6e",
      fontSize: 13,
      fontWeight: 700,
      border: "1px solid rgba(14, 165, 233, 0.26)",
      zIndex: 1,
    },
    mediumBadge: {
      position: "absolute",
      top: 16,
      left: 16,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(251, 191, 36, 0.12)",
      color: "#92400e",
      fontSize: 13,
      fontWeight: 700,
      border: "1px solid rgba(251, 191, 36, 0.26)",
      zIndex: 1,
    },
    difficultBadge: {
      position: "absolute",
      top: 16,
      left: 16,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(239, 68, 68, 0.12)",
      color: "#991b1b",
      fontSize: 13,
      fontWeight: 700,
      border: "1px solid rgba(239, 68, 68, 0.26)",
      zIndex: 1,
    },
    legTop: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 20,
    },
    legTitle: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#2563eb",
    },
    legName: {
      fontSize: 20,
      fontWeight: 700,
      color: "#111827",
      lineHeight: 1.3,
    },
    legSub: {
      color: "#6b7280",
      fontSize: 14,
      lineHeight: 1.5,
    },
    legControls: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 16,
      alignItems: "flex-end",
      marginBottom: 18,
    },
    controlBlock: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: 180,
    },
    controlLabel: {
      fontSize: 13,
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontWeight: 700,
    },
    legPillRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
    },
    metricPill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "10px 14px",
      borderRadius: 999,
      background: "#f8fafc",
      border: "1px solid #e5e7eb",
      color: "#111827",
      fontSize: 14,
      fontWeight: 600,
    },
    runnerTotalsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: 18,
    },
    runnerCard: {
      background: "#ffffff",
      borderRadius: 24,
      border: "1px solid rgba(229, 231, 235, 0.9)",
      boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
      padding: 22,
      minHeight: 220,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
    },
    runnerCardHeader: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    runnerCardName: {
      fontSize: 18,
      fontWeight: 700,
      color: "#111827",
    },
    runnerCardMeta: {
      color: "#6b7280",
      fontSize: 14,
      lineHeight: 1.5,
    },
    runnerCardStats: {
      display: "grid",
      gap: 10,
      marginTop: 18,
    },
    runnerCardStat: {
      display: "flex",
      justifyContent: "space-between",
      color: "#374151",
      fontSize: 14,
      fontWeight: 600,
    },
    runnerBestBadge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      padding: "8px 12px",
      background: "#dcfce7",
      color: "#166534",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.06em",
      marginTop: 6,
    },
    runnerLegBadges: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 16,
    },
    runnerLegBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "8px 12px",
      borderRadius: 999,
      background: "#f8fafc",
      border: "1px solid #e5e7eb",
      color: "#111827",
      fontSize: 13,
      fontWeight: 600,
    },
    runnerTotal: {
      padding: "18px 20px",
      borderRadius: 20,
      background: "#f8fafc",
      border: "1px solid #e5e7eb",
      marginBottom: 14,
      fontSize: 15,
    },
  };

  const runnerMap = useMemo(
    () => Object.fromEntries(runners.map((r) => [r.id, r])),
    [runners]
  );

  const legRefs = useRef({});

  const scrollToCurrentLeg = () => {
    if (currentLeg && legRefs.current[currentLeg.id]) {
      legRefs.current[currentLeg.id].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const startSeconds = timeToSeconds(startTime);

  const legDurations = legs.map((leg) => {
    const runner = runnerMap[leg.runnerId];
    const paceStr = leg.pace || runner?.pace || "10:00";
    const paceSec = paceToSeconds(paceStr);
    return paceSec * leg.distance;
  });

  const cumulativeDurations = legDurations.reduce((acc, dur, i) => {
    acc.push((acc[i - 1] || 0) + dur);
    return acc;
  }, []);

  const calculatedLegs = legs.map((leg, index) => {
    const runner = runnerMap[leg.runnerId];
    const paceStr = leg.pace || runner?.pace || "10:00";
    const paceSec = paceToSeconds(paceStr);
    const time = paceSec * leg.distance;
    const startSecondsLeg = startSeconds + (cumulativeDurations[index - 1] || 0);
    const endSecondsLeg = startSecondsLeg + time;
    return { ...leg, runner, time, startSeconds: startSecondsLeg, endSeconds: endSecondsLeg };
  });

  const nowSeconds = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

  const currentLeg = calculatedLegs.find(
    (leg) => nowSeconds >= leg.startSeconds && nowSeconds <= leg.endSeconds
  );

  const nextLeg = calculatedLegs.find((leg) => leg.startSeconds > nowSeconds);
  const timeUntilNextLeg = nextLeg ? Math.max(0, nextLeg.startSeconds - nowSeconds) : 0;

  const teamTime = calculatedLegs.reduce((sum, l) => sum + l.time, 0);

  const runnerTotals = runners.map((runner) => {
  const legsForRunner = calculatedLegs.filter(
    (l) => l.runnerId === runner.id
  );

  const totalDistance = legsForRunner.reduce(
    (sum, l) => sum + l.distance,
    0
  );

  const totalTime = legsForRunner.reduce(
    (sum, l) => sum + l.time,
    0
  );

  const assignedLegs = legsForRunner.map((l) => l.id);
  const averagePaceSeconds = totalDistance > 0 ? totalTime / totalDistance : Infinity;

  return {
    ...runner,
    totalDistance,
    totalTime,
    assignedLegs,
    averagePaceSeconds,
  };
});

  const fastestAveragePace = Math.min(
    ...runnerTotals.map((r) => r.averagePaceSeconds)
  );
  const fastestRunnerId = runnerTotals.find(
    (r) => r.averagePaceSeconds === fastestAveragePace
  )?.id;
  return (
    <div style={styles.page}>
      <div style={styles.content}>
        <header style={styles.header}>
          <h1 style={styles.title}>KT82 Predictor</h1>
          <p style={styles.subtitle}>
            Enter your start time, runner pace, and per-leg pace overrides to see a polished race plan with expected leg start and finish times.
          </p>
        </header>

        <section style={styles.panel}>
          <div style={styles.topBar}>
            <div style={styles.startCard}>
              <div style={styles.startBlock}>
                <span style={styles.startLabel}>Race start time</span>
                <input
                  type="time"
                  style={styles.input}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.summaryGrid}>
              <div
                style={{
                  ...styles.summaryBox,
                  cursor: currentLeg ? "pointer" : "default",
                  background: currentLeg ? "#dbeafe" : styles.summaryBox.background,
                  borderColor: currentLeg ? "#2563eb" : styles.summaryBox.border,
                  boxShadow: currentLeg ? "0 10px 30px rgba(59, 130, 246, 0.12)" : styles.summaryBox.boxShadow,
                  animation: currentLeg ? "pulse 1.8s ease-in-out infinite" : undefined,
                }}
                onClick={currentLeg ? scrollToCurrentLeg : undefined}
                title={currentLeg ? "Go to current leg" : undefined}
              >
                <span style={styles.summaryLabel}>Current leg</span>
                <p style={styles.summaryValue}>
                  {currentLeg ? `Leg ${currentLeg.id}` : "Not started"}
                </p>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>Estimated finish</span>
                <p style={styles.summaryValue}>{formatTime12Hour(startSeconds + teamTime)}</p>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>Total team time</span>
                <p style={styles.summaryValue}>{formatTime(teamTime)}</p>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>Time until next leg</span>
                <p style={styles.summaryValue}>
                  {nextLeg ? formatTime(timeUntilNextLeg) : "Finished"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.sectionTitle}>Runners</h2>
          {runners.map((r) => (
            <div key={r.id} style={styles.runnerTotal}>
              <div style={styles.row}>
                <input
                  style={styles.input}
                  placeholder="Runner name"
                  aria-label="Runner name"
                  value={r.name}
                  onChange={(e) =>
                    setRunners((prev) =>
                      prev.map((x) =>
                        x.id === r.id ? { ...x, name: e.target.value } : x
                      )
                    )
                  }
                />

                <input
                  style={styles.input}
                  placeholder="Default pace"
                  aria-label="Default pace"
                  value={r.pace}
                  onChange={(e) =>
                    setRunners((prev) =>
                      prev.map((x) =>
                        x.id === r.id ? { ...x, pace: e.target.value } : x
                      )
                    )
                  }
                />
              </div>
            </div>
          ))}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.sectionTitle}>Legs</h2>
          {calculatedLegs.map((leg) => (
            <div
              key={leg.id}
              ref={(el) => {
                legRefs.current[leg.id] = el;
              }}
              style={styles.legCard}
            >
              {leg.rating === "Single Track" && (
                <div style={styles.trailBadge}>
                  <span>🥾</span>
                  <span>🌲</span>
                  <span>Trail</span>
                </div>
              )}
              {leg.rating === "Easy" && (
                <div style={styles.easyBadge}>
                  <span>🌿</span>
                  <span>Easy</span>
                </div>
              )}
              {leg.rating === "Medium" && (
                <div style={styles.mediumBadge}>
                  <span>⚡</span>
                  <span>Medium</span>
                </div>
              )}
              {leg.rating === "Difficult" && (
                <div style={styles.difficultBadge}>
                  <span>🔥</span>
                  <span>Difficult</span>
                </div>
              )}
              <div style={styles.legTop}>
                <div style={styles.legTitle}>Leg {leg.id}</div>
                <div style={styles.legName}>{leg.name}</div>
                <div style={styles.legSub}>
                  {leg.distance} mi · {leg.rating}
                </div>
              </div>

              <div style={styles.legControls}>
                <div style={styles.controlBlock}>
                  <div style={styles.controlLabel}>Runner</div>
                  <select
                    style={styles.select}
                    value={leg.runnerId}
                    onChange={(e) =>
                      setLegs((prev) =>
                        prev.map((l) =>
                          l.id === leg.id
                            ? { ...l, runnerId: e.target.value }
                            : l
                        )
                      )
                    }
                  >
                    {runners.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.controlBlock}>
                  <div style={styles.controlLabel}>Leg pace</div>
                  <input
                    style={styles.smallInput}
                    value={leg.pace}
                    onChange={(e) =>
                      setLegs((prev) =>
                        prev.map((l) =>
                          l.id === leg.id ? { ...l, pace: e.target.value } : l
                        )
                      )
                    }
                    placeholder="MM:SS"
                  />
                </div>
              </div>

              <div style={styles.legPillRow}>
                <span style={styles.metricPill}>
                  Duration: {formatTime(leg.time)}
                </span>
                <span style={styles.metricPill}>
                  Start: {formatTime12Hour(leg.startSeconds)}
                </span>
                <span style={styles.metricPill}>
                  End: {formatTime12Hour(leg.endSeconds)}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section style={styles.panel}>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryBox}>
              <span style={styles.summaryLabel}>Total time</span>
              <p style={styles.summaryValue}>{formatTime(teamTime)}</p>
            </div>
            <div style={styles.summaryBox}>
              <span style={styles.summaryLabel}>End time</span>
              <p style={styles.summaryValue}>{formatTime12Hour(startSeconds + teamTime)}</p>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.sectionTitle}>Runner Totals</h2>
          <div style={styles.runnerTotalsGrid}>
            {runnerTotals.map((r) => (
              <div
                key={r.id}
                style={{
                  ...styles.runnerCard,
                  borderColor: r.id === fastestRunnerId ? "#16a34a" : r.totalDistance > 16 ? "#2563eb" : styles.runnerCard.border,
                  background: r.id === fastestRunnerId ? "#ecfdf5" : styles.runnerCard.background,
                  boxShadow: r.id === fastestRunnerId ? "0 18px 48px rgba(22, 163, 74, 0.14)" : styles.runnerCard.boxShadow,
                }}
              >
                <div style={styles.runnerCardHeader}>
                  <div style={styles.runnerCardName}>{r.name}</div>
                  <div style={styles.runnerCardMeta}>Assigned legs: {r.assignedLegs.join(", ") || "None"}</div>
                  {r.id === fastestRunnerId && (
                    <div style={styles.runnerBestBadge}>Fastest average pace</div>
                  )}
                </div>

                <div style={styles.runnerCardStats}>
                  <div style={styles.runnerCardStat}>
                    <span>Total miles</span>
                    <span>{r.totalDistance.toFixed(1)}</span>
                  </div>
                  <div style={styles.runnerCardStat}>
                    <span>Total time</span>
                    <span>{formatTime(r.totalTime)}</span>
                  </div>
                  <div style={styles.runnerCardStat}>
                    <span>Average pace</span>
                    <span>{Number.isFinite(r.averagePaceSeconds) ? `${formatTime(Math.round(r.averagePaceSeconds))} /mi` : "—"}</span>
                  </div>
                </div>

                <div style={styles.runnerLegBadges}>
                  {r.assignedLegs.map((legId) => (
                    <span key={legId} style={styles.runnerLegBadge}>
                      Leg {legId}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}