export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  .kt82-input, .kt82-select {
    font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .kt82-input:focus, .kt82-select:focus {
    outline: none;
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
    background: #fff !important;
  }
  .kt82-select { cursor: pointer; }
  .kt82-section-header:hover { background: rgba(0,0,0,0.022); }
  .kt82-stat-card { transition: box-shadow 0.15s, transform 0.15s; }
  .kt82-stat-card:hover { box-shadow: 0 4px 14px rgba(15,23,42,0.1) !important; transform: translateY(-1px); }
  .kt82-leg-card { transition: border-color 0.15s, box-shadow 0.15s; }
  .kt82-leg-card:hover { border-color: #c7d2dc !important; box-shadow: 0 2px 8px rgba(15,23,42,0.06) !important; }
  .kt82-runner-card { transition: border-color 0.15s, box-shadow 0.15s; }
  .kt82-runner-card:hover { box-shadow: 0 4px 14px rgba(15,23,42,0.08) !important; }
  .kt82-upcoming-row:hover { background: rgba(255,255,255,0.07) !important; }
  .kt82-delete-btn { opacity: 0; transition: opacity 0.15s, color 0.15s; }
  .kt82-runner-row:hover .kt82-delete-btn { opacity: 0.45; }
  .kt82-delete-btn:hover { opacity: 1 !important; color: #ef4444 !important; }
  .kt82-reset-btn { opacity: 0.45; font-size: 11px; transition: opacity 0.15s; cursor: pointer; background: none; border: none; color: #9ca3af; padding: 4px 8px; border-radius: 6px; font-family: inherit; }
  .kt82-reset-btn:hover { opacity: 1; background: rgba(239,68,68,0.07); color: #dc2626; }
  @keyframes kt82-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }
  .kt82-current-leg { animation: kt82-pulse 2s ease-in-out infinite; }
  @keyframes kt82-glow { 0%,100% { box-shadow: 0 0 0 2px rgba(220,38,38,0.6), 0 8px 40px rgba(220,38,38,0.2); } 50% { box-shadow: 0 0 0 2px rgba(220,38,38,0.9), 0 12px 60px rgba(220,38,38,0.35); } }
  .kt82-race-active { animation: kt82-glow 2.5s ease-in-out infinite; }
  @keyframes kt82-pulse-amber { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); } 50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); } }
  .kt82-current-leg-amber { animation: kt82-pulse-amber 2s ease-in-out infinite; }
  @media (max-width: 640px) { .kt82-stats-bar { grid-template-columns: repeat(2,1fr) !important; } }
  @media (max-width: 380px) { .kt82-stats-bar { grid-template-columns: 1fr !important; } }
  @media (max-width: 540px) {
    .kt82-hero-top { flex-direction: column !important; gap: 14px !important; }
    .kt82-countdown-block { flex-direction: row !important; align-items: baseline !important; gap: 10px !important; }
  }
  @media (max-width: 768px) {
    .kt82-leg-controls { flex-direction: column !important; gap: 10px !important; }
    .kt82-runner-row { grid-template-columns: 28px 1fr auto !important; }
  }
  .kt82-strava-connect { transition: background 0.15s, border-color 0.15s; }
  .kt82-strava-connect:hover { background: rgba(252,76,2,0.13) !important; border-color: rgba(252,76,2,0.38) !important; }
  .kt82-strava-disconnect { opacity: 0.45; transition: opacity 0.15s, color 0.15s; }
  .kt82-strava-disconnect:hover { opacity: 1 !important; color: #dc2626 !important; }
`;

export const baseBadge = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "2px 8px 2px 6px", borderRadius: 999,
  fontSize: 11, fontWeight: 600, lineHeight: 1.6, whiteSpace: "nowrap",
};

export const RATING_BADGE = {
  "Single Track": { style: { ...baseBadge, background: "rgba(16,185,129,0.12)", color: "#065f46", border: "1px solid rgba(16,185,129,0.26)" }, icons: ["🥾","🌲"], label: "Trail" },
  "Easy":         { style: { ...baseBadge, background: "rgba(14,165,233,0.12)", color: "#0c4a6e", border: "1px solid rgba(14,165,233,0.26)" }, icons: ["🌿"],      label: "Easy" },
  "Medium":       { style: { ...baseBadge, background: "rgba(251,191,36,0.12)", color: "#92400e", border: "1px solid rgba(251,191,36,0.26)" }, icons: ["⚡"],      label: "Medium" },
  "Difficult":    { style: { ...baseBadge, background: "rgba(239,68,68,0.12)",  color: "#991b1b", border: "1px solid rgba(239,68,68,0.26)"  }, icons: ["🔥"],      label: "Difficult" },
};

export const RUNNER_LEG_BADGE_STYLE = {
  "Easy":         { background: "rgba(34,197,94,0.12)",  color: "#166534", border: "1px solid rgba(34,197,94,0.26)"  },
  "Medium":       { background: "rgba(251,191,36,0.12)", color: "#92400e", border: "1px solid rgba(251,191,36,0.26)" },
  "Difficult":    { background: "rgba(239,68,68,0.12)",  color: "#991b1b", border: "1px solid rgba(239,68,68,0.26)"  },
  "Single Track": { background: "rgba(180,83,9,0.12)",   color: "#7c2d12", border: "1px solid rgba(180,83,9,0.26)"   },
};

export const S = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    color: "#111827",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  container: { maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" },
  pageTitle: {
    margin: 0, fontSize: 26, fontWeight: 900,
    letterSpacing: "-0.04em", color: "#0f172a", lineHeight: 1.1,
    fontFamily: "'Archivo', 'Segoe UI', system-ui, sans-serif",
  },
  pageTitleSub: { margin: "4px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 500 },
  saveStatus: { fontSize: 12, color: "#94a3b8", paddingTop: 6, flexShrink: 0 },

  raceDashboard: { background: "#0f172a", border: "2px solid #dc2626", borderRadius: 16, marginBottom: 12, overflow: "hidden" },
  raceDashboardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "rgba(220,38,38,0.12)", borderBottom: "1px solid rgba(220,38,38,0.25)" },
  raceDashboardHeaderLabel: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#fca5a5", fontFamily: "'Archivo', system-ui, sans-serif" },
  raceDashboardHeaderMeta: { fontSize: 11, color: "#64748b" },
  raceHeroBody: { padding: "20px 20px 18px" },
  raceHeroTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  raceHeroRunnerBlock: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  heroMicroLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", fontFamily: "'Archivo', system-ui, sans-serif" },
  heroMicroLabelLight: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", fontFamily: "'Archivo', system-ui, sans-serif" },
  heroRunnerName: { fontSize: 30, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em", lineHeight: 1.05, fontFamily: "'Archivo', system-ui, sans-serif" },
  heroLegLine: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 },
  heroLegText: { fontSize: 13, color: "#64748b", lineHeight: 1.4 },
  countdownBlock: { display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 2 },
  countdownValue: { fontSize: 40, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "#ef4444", fontFamily: "'Archivo', system-ui, sans-serif" },
  countdownLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", fontFamily: "'Archivo', system-ui, sans-serif" },
  exchangeRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid", flexWrap: "wrap" },
  exchangeLocationBlock: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  exchangeLocationName: { fontSize: 18, fontWeight: 800, color: "#f8fafc", lineHeight: 1.2, fontFamily: "'Archivo', system-ui, sans-serif" },
  exchangeETABlock: { display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 },
  exchangeETAValue: { fontSize: 17, fontWeight: 700, color: "#f8fafc" },

  upcomingSection: { borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px 16px" },
  upcomingSectionLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginBottom: 8, display: "block", fontFamily: "'Archivo', system-ui, sans-serif" },
  upcomingRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 5, cursor: "default", transition: "background 0.1s" },
  upcomingLegNum: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", flexShrink: 0, width: 42 },
  upcomingRunner: { fontSize: 13, fontWeight: 600, color: "#94a3b8", flexShrink: 0, width: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  upcomingArrow: { fontSize: 12, color: "#334155", flexShrink: 0 },
  upcomingExchangeName: { fontSize: 13, color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  upcomingETA: { fontSize: 13, fontWeight: 700, color: "#e2e8f0", flexShrink: 0, textAlign: "right" },

  statsBar: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 },
  statCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 },
  statLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", fontFamily: "'Archivo', system-ui, sans-serif" },
  statValue: { fontSize: 20, fontWeight: 800, color: "#0f172a", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  statValueMd: { fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  startTimeInput: { width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 17, fontWeight: 700, color: "#0f172a", outline: "none", marginTop: 2, fontFamily: "inherit" },

  sectionCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" },
  sectionHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#0f172a", margin: 0, fontFamily: "'Archivo', system-ui, sans-serif" },
  sectionMeta: { fontSize: 12, color: "#9ca3af" },
  sectionBody: { padding: "14px 20px 18px", borderTop: "1px solid #f1f5f9" },

  runnerRow: { display: "grid", gridTemplateColumns: "28px 1fr 1fr 28px", gap: 10, alignItems: "start", padding: "9px 0", borderBottom: "1px solid #f8fafc" },
  runnerRowLast: { display: "grid", gridTemplateColumns: "28px 1fr 1fr 28px", gap: 10, alignItems: "start", padding: "9px 0" },
  runnerIndex: { width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#64748b", flexShrink: 0, marginTop: 2 },

  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit" },
  inputError: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #fca5a5", background: "#fff5f5", fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit" },
  inputLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", display: "block", marginBottom: 5, fontFamily: "'Archivo', system-ui, sans-serif" },
  select: { padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 14, color: "#0f172a", minWidth: 140, fontFamily: "inherit", width: "100%" },

  legCard: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "15px 16px", marginBottom: 8 },
  legHeaderRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 },
  legNumber: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" },
  legDot: { fontSize: 11, color: "#cbd5e1" },
  legDist: { fontSize: 11, fontWeight: 600, color: "#94a3b8" },
  legName: { fontSize: 15, fontWeight: 600, color: "#0f172a", lineHeight: 1.4, marginBottom: 14 },
  legControlsRow: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 },
  controlBlock: { display: "flex", flexDirection: "column" },
  legMetricRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  metricChip: { fontSize: 12, fontWeight: 600, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", whiteSpace: "nowrap" },

  runnerTotalsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px,1fr))", gap: 10 },
  runnerCard: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 12 },
  runnerCardTop: { display: "flex", flexDirection: "column", gap: 5 },
  runnerCardName: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  runnerFastBadge: { alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#166534", background: "#dcfce7", borderRadius: 999, padding: "3px 8px" },
  runnerHeavyBadge: { alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#991b1b", background: "#fee2e2", borderRadius: 999, padding: "3px 8px" },
  runnerStatsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" },
  runnerStat: { display: "flex", flexDirection: "column", gap: 3 },
  runnerStatLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", fontFamily: "'Archivo', system-ui, sans-serif" },
  runnerStatValue: { fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 },
  runnerLegBadges: { display: "flex", flexWrap: "wrap", gap: 5 },
  runnerLegBadge: { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569" },

  summaryBar: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 24px", display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center" },
  summaryItem: { display: "flex", flexDirection: "column", gap: 3 },
  summaryLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", fontFamily: "'Archivo', system-ui, sans-serif" },
  summaryValue: { fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.1, fontFamily: "'Archivo', system-ui, sans-serif" },

  fieldError: { display: "block", color: "#dc2626", fontSize: 11, marginTop: 3, fontWeight: 500 },
  deleteBlockMsg: { marginTop: 6, padding: "6px 10px", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, color: "#991b1b" },
};
