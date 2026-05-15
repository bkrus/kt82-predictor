import { supabase } from "./supabaseClient";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const defaultRunners = [
  { id: "r1", name: "Runner 1", pace: "9:30" },
  { id: "r2", name: "Runner 2", pace: "9:30" },
  { id: "r3", name: "Runner 3", pace: "9:30" },
  { id: "r4", name: "Runner 4", pace: "9:30" },
  { id: "r5", name: "Runner 5", pace: "9:30" },
  { id: "r6", name: "Runner 6", pace: "9:30" },
];

const defaultLegs = [
  { id: 1,  name: "Aquaport to Lakehouse Bar & Grill",              distance: 5.10, runnerId: "r1", rating: "Medium",       factor: 1.03, pace: "" },
  { id: 2,  name: "Lakehouse Bar & Grill to 364 Access",            distance: 3.93, runnerId: "r2", rating: "Easy",         factor: 1.0,  pace: "" },
  { id: 3,  name: "364 Access to Greens Bottom Rd",                 distance: 3.20, runnerId: "r3", rating: "Single Track", factor: 1.12, pace: "" },
  { id: 4,  name: "Greens Bottom Rd to Missouri Research Park",     distance: 7.24, runnerId: "r4", rating: "Difficult",    factor: 1.08, pace: "" },
  { id: 5,  name: "MO Research Park to Lewis & Clark TH",           distance: 4.72, runnerId: "r5", rating: "Medium",       factor: 1.03, pace: "" },
  { id: 6,  name: "Lewis and Clark TH to Weldon Spring TH",         distance: 5.89, runnerId: "r6", rating: "Difficult",    factor: 1.08, pace: "" },
  { id: 7,  name: "Weldon Spring TH to Weldon Spring Conservation", distance: 5.73, runnerId: "r1", rating: "Medium",       factor: 1.03, pace: "" },
  { id: 8,  name: "Weldon Spring Conservation to Matson",           distance: 4.43, runnerId: "r2", rating: "Easy",         factor: 1.0,  pace: "" },
  { id: 9,  name: "Matson to Klondike Park",                        distance: 3.61, runnerId: "r3", rating: "Easy",         factor: 1.12, pace: "" },
  { id: 10, name: "Klondike Park to Augusta",                       distance: 2.58, runnerId: "r4", rating: "Easy",         factor: 1.0,  pace: "" },
  { id: 11, name: "Augusta to Dutzow",                              distance: 7.56, runnerId: "r5", rating: "Difficult",    factor: 1.08, pace: "" },
  { id: 12, name: "Dutzow to Marthasville",                         distance: 3.67, runnerId: "r6", rating: "Medium",       factor: 1.03, pace: "" },
  { id: 13, name: "Marthasville to Treloar",                        distance: 6.96, runnerId: "r1", rating: "Difficult",    factor: 1.08, pace: "" },
  { id: 14, name: "Treloar to Bernheimer Rd",                       distance: 4.17, runnerId: "r2", rating: "Easy",         factor: 1.0,  pace: "" },
  { id: 15, name: "Bernheimer Rd to Gore-Case Comm Ctr",            distance: 6.14, runnerId: "r3", rating: "Medium",       factor: 1.03, pace: "" },
  { id: 16, name: "Gore-Case Comm Ctr to Case Road",                distance: 2.69, runnerId: "r4", rating: "Single Track", factor: 1.12, pace: "" },
  { id: 17, name: "Case Road to McKittrick",                        distance: 3.89, runnerId: "r5", rating: "Easy",         factor: 1.0,  pace: "" },
  { id: 18, name: "McKittrick to Hermann!",                         distance: 2.55, runnerId: "r6", rating: "Medium",       factor: 1.03, pace: "" },
];

// ─── Utilities ───────────────────────────────────────────────────
function paceToSeconds(pace) {
  const m = pace?.match(/^(\d+):(\d{2})$/);
  if (!m) return 600;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function timeToSeconds(time) {
  const [h, mn] = time.split(":").map(Number);
  return h * 3600 + mn * 60;
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
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
}
function formatSavedTime(lastSaved, currentTime) {
  if (!lastSaved) return "Not saved yet";
  const ago = Math.floor((currentTime - lastSaved) / 1000);
  if (ago < 10) return "Saved just now";
  if (ago < 3600) return `Saved ${Math.max(1, Math.floor(ago / 60))} min ago`;
  return `Saved ${lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
function normalizePaceInput(value) {
  if (!value || typeof value !== "string" || value.includes(":")) return value;
  const num = value.replace(/[^0-9]/g, "");
  if (!num.length) return value;
  if (num.length <= 2) return `${parseInt(num, 10)}:00`;
  if (num.length === 3) return `${parseInt(num[0], 10)}:${num.slice(1).padStart(2, "0")}`;
  if (num.length === 4) return `${parseInt(num.slice(0, 2), 10)}:${num.slice(2).padStart(2, "0")}`;
  return value;
}
function validatePace(value) {
  if (!value || value.trim() === "") return null;
  const t = value.trim();
  if (/\s/.test(t)) return "No spaces — use MM:SS";
  if (/\./.test(t)) return "Use MM:SS, not decimals";
  if (!/^\d+:\d{2}$/.test(t)) return "Format: MM:SS (e.g. 9:30)";
  const [, sec] = t.split(":").map(Number);
  if (sec >= 60) return "Seconds must be 00–59";
  return null;
}
function exchangeLocation(legName) {
  const idx = legName.indexOf(" to ");
  return idx >= 0 ? legName.slice(idx + 4) : legName;
}
function getCountdownUrgency(seconds) {
  if (seconds < 600)  return { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.45)",  color: "#dc2626" };
  if (seconds < 1500) return { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.45)", color: "#b45309" };
  return                     { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)", color: "#e2e8f0" };
}
let _uid = 100;
const genId = () => `r${++_uid}`;

// ─── Badge config ────────────────────────────────────────────────
const baseBadge = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "2px 8px 2px 6px", borderRadius: 999,
  fontSize: 11, fontWeight: 600, lineHeight: 1.6, whiteSpace: "nowrap",
};
const RATING_BADGE = {
  "Single Track": { style: { ...baseBadge, background: "rgba(16,185,129,0.12)", color: "#065f46", border: "1px solid rgba(16,185,129,0.26)" }, icons: ["🥾","🌲"], label: "Trail" },
  "Easy":         { style: { ...baseBadge, background: "rgba(14,165,233,0.12)", color: "#0c4a6e", border: "1px solid rgba(14,165,233,0.26)" }, icons: ["🌿"],      label: "Easy" },
  "Medium":       { style: { ...baseBadge, background: "rgba(251,191,36,0.12)", color: "#92400e", border: "1px solid rgba(251,191,36,0.26)" }, icons: ["⚡"],      label: "Medium" },
  "Difficult":    { style: { ...baseBadge, background: "rgba(239,68,68,0.12)",  color: "#991b1b", border: "1px solid rgba(239,68,68,0.26)"  }, icons: ["🔥"],      label: "Difficult" },
};
const RUNNER_LEG_BADGE_STYLE = {
  "Easy":         { background: "rgba(34,197,94,0.12)",  color: "#166534", border: "1px solid rgba(34,197,94,0.26)"  },
  "Medium":       { background: "rgba(251,191,36,0.12)", color: "#92400e", border: "1px solid rgba(251,191,36,0.26)" },
  "Difficult":    { background: "rgba(239,68,68,0.12)",  color: "#991b1b", border: "1px solid rgba(239,68,68,0.26)"  },
  "Single Track": { background: "rgba(180,83,9,0.12)",   color: "#7c2d12", border: "1px solid rgba(180,83,9,0.26)"   },
};

// ─── Sub-components ──────────────────────────────────────────────
function RatingBadge({ rating }) {
  const cfg = RATING_BADGE[rating];
  if (!cfg) return null;
  return (
    <span style={cfg.style}>
      {cfg.icons.map((ic, i) => <span key={i}>{ic}</span>)}
      <span>{cfg.label}</span>
    </span>
  );
}

function PaceInput({ value, onChange, error }) {
  const parsed = value?.match(/^(\d+):(\d{2})$/);
  const mins = parsed ? parseInt(parsed[1], 10) : NaN;
  const secs = parsed ? parseInt(parsed[2], 10) : NaN;
  const ok = !isNaN(mins) && !isNaN(secs);

  const set = (nm, ns) =>
    onChange(`${Math.max(0, nm)}:${String(Math.max(0, Math.min(59, ns))).padStart(2, "0")}`);
  const dM = (d) => (ok ? set(mins + d, secs) : set(d > 0 ? 10 : 9, 0));
  const dS = (d) => {
    if (!ok) return;
    let ns = secs + d, nm = mins;
    if (ns >= 60) { ns -= 60; nm++; }
    if (ns < 0)   { ns += 60; nm = Math.max(0, nm - 1); }
    set(nm, ns);
  };

  const btn = {
    background: "none", border: "none", cursor: "pointer", color: "#94a3b8",
    fontSize: 8, lineHeight: 1, padding: "2px 5px",
    userSelect: "none", WebkitUserSelect: "none",
  };
  const col = { display: "flex", flexDirection: "column", alignItems: "center" };
  const inp = {
    width: 30, textAlign: "center", border: "none", background: "transparent",
    fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "inherit",
    padding: "4px 0", outline: "none",
  };

  return (
    <div>
      <div
        style={{
          display: "inline-flex", alignItems: "center",
          border: `1.5px solid ${error ? "#fca5a5" : "#e5e7eb"}`,
          borderRadius: 8, background: error ? "#fff5f5" : "#f9fafb",
          padding: "0 8px 0 4px", minWidth: 116,
        }}
      >
        <div style={col}>
          <button type="button" style={btn} onClick={() => dM(1)} tabIndex={-1}>▲</button>
          <input
            style={inp}
            value={ok ? String(mins) : (value || "")}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && ok) set(n, secs);
              else onChange(e.target.value);
            }}
          />
          <button type="button" style={btn} onClick={() => dM(-1)} tabIndex={-1}>▼</button>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#cbd5e1", padding: "0 1px", userSelect: "none" }}>:</span>
        <div style={col}>
          <button type="button" style={btn} onClick={() => dS(5)} tabIndex={-1}>▲</button>
          <input
            style={{ ...inp, width: 28 }}
            value={ok ? String(secs).padStart(2, "0") : ""}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && ok) set(mins, n);
            }}
          />
          <button type="button" style={btn} onClick={() => dS(-5)} tabIndex={-1}>▼</button>
        </div>
        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 5, userSelect: "none" }}>/mi</span>
      </div>
      {error && (
        <span style={{ display: "block", color: "#dc2626", fontSize: 11, marginTop: 3, fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
}

function RunnerNameModal({ runnerIndex, value, onSave, onClose }) {
  const [val, setVal] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 60);
    return () => { document.body.style.overflow = ""; clearTimeout(t); };
  }, []);

  const commit = () => onSave(val);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.65)", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end" }}
      onClick={commit}
    >
      <div
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", fontFamily: "'Archivo', system-ui, sans-serif" }}>
            Runner {runnerIndex + 1} Name
          </span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>×</button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onClose(); }}
          placeholder="Runner name"
          style={{
            display: "block", width: "100%", padding: "14px 16px",
            fontSize: 20, fontWeight: 600, fontFamily: "inherit",
            border: `2px solid ${!val.trim() ? "#fca5a5" : "#e5e7eb"}`,
            borderRadius: 12, background: !val.trim() ? "#fff5f5" : "#f9fafb",
            color: "#0f172a", outline: "none", boxSizing: "border-box",
          }}
        />
        {!val.trim() && <span style={{ display: "block", color: "#dc2626", fontSize: 12, marginTop: 5, fontWeight: 500 }}>Name cannot be blank</span>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#f1f5f9", fontSize: 15, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button type="button" onClick={commit} style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: "#0f172a", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Done</button>
        </div>
      </div>
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0, color: "#9ca3af" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Global CSS ──────────────────────────────────────────────────
const GLOBAL_CSS = `
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
`;

// ─── Styles ──────────────────────────────────────────────────────
const S = {
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

  // ── Race Dashboard ──
  raceDashboard: {
    background: "#0f172a",
    border: "2px solid #dc2626",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  raceDashboardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 20px",
    background: "rgba(220,38,38,0.12)",
    borderBottom: "1px solid rgba(220,38,38,0.25)",
  },
  raceDashboardHeaderLabel: {
    fontSize: 11, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.12em", color: "#fca5a5",
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  raceDashboardHeaderMeta: { fontSize: 11, color: "#64748b" },
  raceHeroBody: { padding: "20px 20px 18px" },
  raceHeroTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  raceHeroRunnerBlock: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  heroMicroLabel: {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.12em", color: "#475569",
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  heroMicroLabelLight: {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.12em", color: "#475569",
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  heroRunnerName: {
    fontSize: 30, fontWeight: 900, color: "#f8fafc",
    letterSpacing: "-0.03em", lineHeight: 1.05,
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  heroLegLine: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 },
  heroLegText: { fontSize: 13, color: "#64748b", lineHeight: 1.4 },
  countdownBlock: { display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 2 },
  countdownValue: {
    fontSize: 40, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1,
    color: "#ef4444", fontFamily: "'Archivo', system-ui, sans-serif",
  },
  countdownLabel: {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.1em", color: "#475569",
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  exchangeRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid",
    flexWrap: "wrap",
  },
  exchangeLocationBlock: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  exchangeLocationName: { fontSize: 18, fontWeight: 800, color: "#f8fafc", lineHeight: 1.2, fontFamily: "'Archivo', system-ui, sans-serif" },
  exchangeETABlock: { display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 },
  exchangeETAValue: { fontSize: 17, fontWeight: 700, color: "#f8fafc" },

  // ── Upcoming ──
  upcomingSection: { borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px 16px" },
  upcomingSectionLabel: {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.12em", color: "#475569",
    marginBottom: 8, display: "block",
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  upcomingRow: {
    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
    borderRadius: 8, background: "rgba(255,255,255,0.04)",
    marginBottom: 5, cursor: "default", transition: "background 0.1s",
  },
  upcomingLegNum: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", flexShrink: 0, width: 42 },
  upcomingRunner: { fontSize: 13, fontWeight: 600, color: "#94a3b8", flexShrink: 0, width: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  upcomingArrow: { fontSize: 12, color: "#334155", flexShrink: 0 },
  upcomingExchangeName: { fontSize: 13, color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  upcomingETA: { fontSize: 13, fontWeight: 700, color: "#e2e8f0", flexShrink: 0, textAlign: "right" },

  // ── Stats bar ──
  statsBar: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 },
  statCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 },
  statLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", fontFamily: "'Archivo', system-ui, sans-serif" },
  statValue: { fontSize: 20, fontWeight: 800, color: "#0f172a", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  statValueMd: { fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  startTimeInput: { width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 17, fontWeight: 700, color: "#0f172a", outline: "none", marginTop: 2, fontFamily: "inherit" },

  // ── Section cards ──
  sectionCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" },
  sectionHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  sectionTitle: {
    fontSize: 13, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.1em", color: "#0f172a", margin: 0,
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  sectionMeta: { fontSize: 12, color: "#9ca3af" },
  sectionBody: { padding: "14px 20px 18px", borderTop: "1px solid #f1f5f9" },

  // ── Runner rows ──
  runnerRow: { display: "grid", gridTemplateColumns: "28px 1fr 1fr 28px", gap: 10, alignItems: "start", padding: "9px 0", borderBottom: "1px solid #f8fafc" },
  runnerRowLast: { display: "grid", gridTemplateColumns: "28px 1fr 1fr 28px", gap: 10, alignItems: "start", padding: "9px 0" },
  runnerIndex: { width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#64748b", flexShrink: 0, marginTop: 2 },

  // ── Inputs ──
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit" },
  inputError: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #fca5a5", background: "#fff5f5", fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit" },
  inputLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", display: "block", marginBottom: 5, fontFamily: "'Archivo', system-ui, sans-serif" },
  select: { padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 14, color: "#0f172a", minWidth: 140, fontFamily: "inherit", width: "100%" },

  // ── Leg cards ──
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

  // ── Runner totals ──
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

  // ── Summary footer ──
  summaryBar: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 24px", display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center" },
  summaryItem: { display: "flex", flexDirection: "column", gap: 3 },
  summaryLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", fontFamily: "'Archivo', system-ui, sans-serif" },
  summaryValue: { fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.1, fontFamily: "'Archivo', system-ui, sans-serif" },

  // ── Inline error / warning ──
  fieldError: { display: "block", color: "#dc2626", fontSize: 11, marginTop: 3, fontWeight: 500 },
  deleteBlockMsg: { marginTop: 6, padding: "6px 10px", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, color: "#991b1b" },
};

// ─── App ─────────────────────────────────────────────────────────
export default function App() {
  const [runners, setRunners] = useState(() => {
    try { const s = localStorage.getItem("kt82_runners"); return s ? JSON.parse(s) : defaultRunners; } catch { return defaultRunners; }
  });
  const [legs, setLegs] = useState(() => {
    try { const s = localStorage.getItem("kt82_legs"); return s ? JSON.parse(s) : defaultLegs; } catch { return defaultLegs; }
  });
  const [startTime, setStartTime] = useState(() => {
    try { return localStorage.getItem("kt82_startTime") || "08:00"; } catch { return "08:00"; }
  });

  const [lastSaved, setLastSaved] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [runnerPaceErrors, setRunnerPaceErrors] = useState({});
  const [legPaceErrors, setLegPaceErrors] = useState({});
  const [resetConfirm, setResetConfirm] = useState(null); // 'runners' | 'legs'
  const [deleteBlocked, setDeleteBlocked] = useState(null); // { id, legIds }
  const [mode, setMode] = useState("predictor"); // "predictor" | "race"
  const [stravaConnections, setStravaConnections] = useState({}); // { [runnerId]: { runner_name, strava_profile_pic_url } }
  const [stravaToast, setStravaToast] = useState(null); // { type: "success"|"warning"|"error", message }
  const [stravaExpanded, setStravaExpanded] = useState(true);

  const isMobileDevice = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [nameEditModal, setNameEditModal] = useState(null); // { runnerId, runnerIndex, value }

  const hasSkippedInitialLocalSave = useRef(false);
  const hasSkippedInitialSupabaseSave = useRef(false);
  const isApplyingRemoteUpdate = useRef(false);
  const [runnersExpanded, setRunnersExpanded] = useState(true);
  const [legsExpanded, setLegsExpanded] = useState(true);
  const [totalsExpanded, setTotalsExpanded] = useState(true);
  const supabaseSaveTimer = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("team_plan").select("*").eq("id", "default").single();
      if (error) { console.error("Supabase load error:", error); return; }
      if (data) {
        isApplyingRemoteUpdate.current = true;
        setRunners(Array.isArray(data.runners) && data.runners.length > 0 ? data.runners : defaultRunners);
        setLegs(Array.isArray(data.legs) && data.legs.length > 0 ? data.legs : defaultLegs);
        setStartTime(data.start_time || "08:00");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!hasSkippedInitialLocalSave.current) { hasSkippedInitialLocalSave.current = true; return; }
    try {
      localStorage.setItem("kt82_runners", JSON.stringify(runners));
      localStorage.setItem("kt82_legs", JSON.stringify(legs));
      localStorage.setItem("kt82_startTime", startTime);
      setLastSaved(new Date());
    } catch {}
  }, [runners, legs, startTime]);

  useEffect(() => {
    if (!hasSkippedInitialSupabaseSave.current) { hasSkippedInitialSupabaseSave.current = true; return; }
    if (isApplyingRemoteUpdate.current) { isApplyingRemoteUpdate.current = false; return; }
    if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
    supabaseSaveTimer.current = window.setTimeout(async () => {
      const { error } = await supabase.from("team_plan").update({ runners, legs, start_time: startTime }).eq("id", "default");
      if (error) console.error("Supabase save error:", error);
    }, 900);
    return () => { if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current); };
  }, [runners, legs, startTime]);

  useEffect(() => {
    const ch = supabase
      .channel("team_plan_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_plan" }, (payload) => {
        const d = payload.new;
        if (d?.id === "default") {
          isApplyingRemoteUpdate.current = true;
          if (Array.isArray(d.runners)) setRunners(d.runners);
          if (Array.isArray(d.legs)) setLegs(d.legs);
          if (d.start_time) setStartTime(d.start_time);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const fetchStravaConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/strava/connections");
      if (!res.ok) return;
      const { connections } = await res.json();
      const map = {};
      for (const c of connections) map[c.runner_id] = c;
      setStravaConnections(map);
    } catch {}
  }, []);

  useEffect(() => { fetchStravaConnections(); }, [fetchStravaConnections]);

  // Handle post-OAuth redirect: /?strava=connected&runner=r1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("strava");
    if (!status) return;
    window.history.replaceState({}, "", window.location.pathname);
    const runnerParam = params.get("runner");
    const runnerName = runners.find((r) => r.id === runnerParam)?.name ?? runnerParam ?? "";
    if (status === "connected") {
      setStravaToast({ type: "success", message: `Strava connected${runnerName ? ` for ${runnerName}` : ""}!` });
      fetchStravaConnections();
    } else if (status === "denied") {
      setStravaToast({ type: "warning", message: "Strava connection was cancelled." });
    } else {
      const reason = params.get("reason");
      setStravaToast({ type: "error", message: `Strava connection failed${reason ? ` (${reason})` : ""}. Please try again.` });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss toast after 5 s
  useEffect(() => {
    if (!stravaToast) return;
    const t = setTimeout(() => setStravaToast(null), 5000);
    return () => clearTimeout(t);
  }, [stravaToast]);

  const runnerMap = useMemo(() => Object.fromEntries(runners.map((r) => [r.id, r])), [runners]);
  const legRefs = useRef({});
  const startSeconds = timeToSeconds(startTime);

  const { calculatedLegs, teamTime, runnerTotals } = useMemo(() => {
    let cur = startSeconds;
    const calcLegs = legs.map((leg) => {
      const runner = runnerMap[leg.runnerId];
      const paceStr = leg.pace || runner?.pace || "10:00";
      const duration = paceToSeconds(paceStr) * leg.distance;
      const data = { ...leg, runner, time: duration, startSeconds: cur, endSeconds: cur + duration };
      cur += duration;
      return data;
    });
    const totalTime = calcLegs.reduce((s, l) => s + l.time, 0);
    const totals = runners.map((runner) => {
      const rl = calcLegs.filter((l) => l.runnerId === runner.id);
      const totalDistance = rl.reduce((s, l) => s + l.distance, 0);
      const totalTime = rl.reduce((s, l) => s + l.time, 0);
      return { ...runner, totalDistance, totalTime, assignedLegs: rl.map((l) => l.id), averagePaceSeconds: totalDistance > 0 ? totalTime / totalDistance : Infinity };
    });
    return { calculatedLegs: calcLegs, teamTime: totalTime, runnerTotals: totals };
  }, [legs, runners, runnerMap, startSeconds]);

  const nowSeconds = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();
  const currentLeg = mode === "race"
    ? calculatedLegs.find((l) => nowSeconds >= l.startSeconds && nowSeconds <= l.endSeconds)
    : null;
  const nextLeg = mode === "race"
    ? calculatedLegs.find((l) => l.startSeconds > nowSeconds)
    : null;
  const currentRunnerName = currentLeg ? (runnerMap[currentLeg.runnerId]?.name ?? "Unknown") : null;
  const nextExchangeLocation = currentLeg ? exchangeLocation(currentLeg.name) : null;
  const exchangeETA = currentLeg ? formatTime12Hour(currentLeg.endSeconds) : null;
  const timeToExchange = currentLeg
    ? Math.max(0, currentLeg.endSeconds - nowSeconds)
    : nextLeg ? Math.max(0, nextLeg.startSeconds - nowSeconds) : null;
  const countdownUrgency = currentLeg && timeToExchange !== null
    ? getCountdownUrgency(timeToExchange)
    : { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", color: "#e2e8f0" };
  const currentLegIndex = currentLeg ? calculatedLegs.findIndex((l) => l.id === currentLeg.id) : -1;
  const upcomingLegs = currentLegIndex >= 0 ? calculatedLegs.slice(currentLegIndex + 1, currentLegIndex + 4) : [];
  const fastestAveragePace = Math.min(...runnerTotals.map((r) => r.averagePaceSeconds));
  const fastestRunnerId = runnerTotals.find((r) => r.averagePaceSeconds === fastestAveragePace)?.id;
  const totalLegDistance = calculatedLegs.reduce((s, l) => s + l.distance, 0).toFixed(1);

  const scrollToCurrentLeg = () => {
    if (!currentLeg) return;
    const go = () => legRefs.current[currentLeg.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!legsExpanded) { setLegsExpanded(true); setTimeout(go, 100); } else go();
  };

  // ── Handlers ──
  const tryDeleteRunner = (runnerId) => {
    const blocking = legs.filter((l) => l.runnerId === runnerId).map((l) => l.id);
    if (blocking.length > 0) {
      setDeleteBlocked({ id: runnerId, legIds: blocking });
      return;
    }
    setRunners((prev) => prev.filter((r) => r.id !== runnerId));
    setDeleteBlocked(null);
  };

  const addRunner = () => {
    setRunners((prev) => [...prev, { id: genId(), name: `Runner ${prev.length + 1}`, pace: "9:30" }]);
  };

  const handleRunnerPaceChange = (runnerId, val) => {
    setRunners((prev) => prev.map((r) => r.id === runnerId ? { ...r, pace: val } : r));
    if (runnerPaceErrors[runnerId]) setRunnerPaceErrors((p) => ({ ...p, [runnerId]: null }));
  };

  const handleRunnerPaceBlur = (runnerId, val) => {
    const norm = normalizePaceInput(val);
    const err = validatePace(norm);
    setRunnerPaceErrors((p) => ({ ...p, [runnerId]: err }));
    if (!err) setRunners((prev) => prev.map((r) => r.id === runnerId ? { ...r, pace: norm } : r));
  };

  const handleLegPaceChange = (legId, val) => {
    setLegs((prev) => prev.map((l) => l.id === legId ? { ...l, pace: val } : l));
    if (legPaceErrors[legId]) setLegPaceErrors((p) => ({ ...p, [legId]: null }));
  };

  const handleLegPaceBlur = (legId, val) => {
    const norm = normalizePaceInput(val);
    const err = validatePace(norm);
    setLegPaceErrors((p) => ({ ...p, [legId]: err }));
    if (!err) setLegs((prev) => prev.map((l) => l.id === legId ? { ...l, pace: norm } : l));
  };

  const doReset = (section) => {
    if (section === "runners") {
      setRunners(defaultRunners);
      setRunnerPaceErrors({});
      setDeleteBlocked(null);
    } else {
      setLegs(defaultLegs);
      setLegPaceErrors({});
    }
    setResetConfirm(null);
  };

  // ── Render ──
  return (
    <div style={S.page}>
      <style>{GLOBAL_CSS}</style>
      <div style={S.container}>

        {/* Page header */}
        <div style={S.pageHeader}>
          <div>
            <h1 style={S.pageTitle}>KT82 Predictor</h1>
            <p style={S.pageTitleSub}>Katy Trail 82 · Race pace planner</p>
          </div>
          <span style={S.saveStatus}>{formatSavedTime(lastSaved, currentTime)}</span>
        </div>

        {/* Mode switcher */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "inline-flex", background: "#e2e8f0", borderRadius: 10, padding: 3, gap: 2 }}>
            {[
              { key: "predictor", icon: "📋", label: "Race Predictor" },
              { key: "race",      icon: "🏁", label: "Race Day" },
            ].map(({ key, icon, label }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    fontFamily: "'Archivo', system-ui, sans-serif",
                    letterSpacing: active ? "-0.01em" : "0",
                    background: active ? (key === "race" ? "#dc2626" : "#ffffff") : "transparent",
                    color: active ? (key === "race" ? "#ffffff" : "#0f172a") : "#64748b",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="kt82-stats-bar"
          style={{ ...S.statsBar, gridTemplateColumns: mode === "predictor" ? "repeat(3,1fr)" : "repeat(4,1fr)" }}
        >
          <div style={S.statCard} className="kt82-stat-card">
            <span style={S.statLabel}>Race start</span>
            <input type="time" className="kt82-input" style={S.startTimeInput} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          {mode === "race" && (
            <div
              className={`kt82-stat-card${currentLeg ? " kt82-current-leg" : ""}`}
              style={{ ...S.statCard, ...(currentLeg ? { background: "#eff6ff", borderColor: "#bfdbfe", cursor: "pointer" } : {}) }}
              onClick={currentLeg ? scrollToCurrentLeg : undefined}
              title={currentLeg ? "Go to current leg" : undefined}
            >
              <span style={S.statLabel}>Current leg</span>
              <span style={{ ...S.statValue, color: currentLeg ? "#1d4ed8" : "#0f172a" }}>{currentLeg ? `Leg ${currentLeg.id}` : "—"}</span>
              {currentLeg && <span style={{ fontSize: 11, color: "#93c5fd", marginTop: 1 }}>Tap to jump ↓</span>}
            </div>
          )}
          <div style={S.statCard} className="kt82-stat-card">
            <span style={S.statLabel}>Est. finish</span>
            <span style={S.statValueMd}>{formatTime12Hour(startSeconds + teamTime)}</span>
          </div>
          <div style={S.statCard} className="kt82-stat-card">
            <span style={S.statLabel}>Total time</span>
            <span style={S.statValue}>{formatTime(teamTime)}</span>
          </div>
        </div>

        {/* Race Dashboard — only in race mode when a leg is active */}
        {mode === "race" && currentLeg && (
          <div className="kt82-race-active" style={S.raceDashboard}>
            <div style={S.raceDashboardHeader}>
              <span style={S.raceDashboardHeaderLabel}>🏃 Race in progress</span>
              <span style={S.raceDashboardHeaderMeta}>Leg {currentLeg.id} of {calculatedLegs.length}</span>
            </div>
            <div style={S.raceHeroBody}>
              <div className="kt82-hero-top" style={S.raceHeroTop}>
                <div style={S.raceHeroRunnerBlock}>
                  <span style={S.heroMicroLabelLight}>Currently running</span>
                  <span style={S.heroRunnerName}>{currentRunnerName}</span>
                  <div style={S.heroLegLine}>
                    <span style={S.heroLegText}>Leg {currentLeg.id} · {currentLeg.distance} mi</span>
                    <RatingBadge rating={currentLeg.rating} />
                  </div>
                </div>
                <div className="kt82-countdown-block" style={S.countdownBlock}>
                  <span style={S.countdownLabel}>Time to exchange</span>
                  <span style={S.countdownValue}>{formatTime(timeToExchange)}</span>
                </div>
              </div>
              <div style={{ ...S.exchangeRow, background: countdownUrgency.bg, borderColor: countdownUrgency.border }}>
                <div style={S.exchangeLocationBlock}>
                  <span style={S.heroMicroLabelLight}>Next exchange</span>
                  <span style={S.exchangeLocationName}>{nextExchangeLocation}</span>
                </div>
                <div style={S.exchangeETABlock}>
                  <span style={S.heroMicroLabelLight}>ETA</span>
                  <span style={S.exchangeETAValue}>{exchangeETA}</span>
                </div>
              </div>
            </div>
            {upcomingLegs.length > 0 && (
              <div style={S.upcomingSection}>
                <span style={S.upcomingSectionLabel}>Upcoming exchanges</span>
                {upcomingLegs.map((leg) => (
                  <div key={leg.id} className="kt82-upcoming-row" style={S.upcomingRow}>
                    <span style={S.upcomingLegNum}>Leg {leg.id}</span>
                    <span style={S.upcomingRunner}>{runnerMap[leg.runnerId]?.name ?? "—"}</span>
                    <span style={S.upcomingArrow}>→</span>
                    <span style={S.upcomingExchangeName}>{exchangeLocation(leg.name)}</span>
                    <span style={S.upcomingETA}>{formatTime12Hour(leg.endSeconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Strava Connections (race tab) ── */}
        {mode === "race" && (
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <div
              className="kt82-section-header"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}
              onClick={() => setStravaExpanded(!stravaExpanded)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", fontFamily: "'Archivo', system-ui, sans-serif" }}>
                  Strava Connections
                </span>
                <span style={{ fontSize: 11, color: "#334155" }}>
                  {Object.keys(stravaConnections).length}/{runners.length} connected
                </span>
              </div>
              <Chevron open={stravaExpanded} />
            </div>
            {stravaExpanded && (
              <div style={{ padding: "4px 18px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {runners.map((r) => {
                  const conn = stravaConnections[r.id];
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 12px 7px 8px",
                        background: conn ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${conn ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 999,
                      }}
                    >
                      {conn?.strava_profile_pic_url
                        ? <img src={conn.strava_profile_pic_url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#475569", flexShrink: 0 }}>
                            {(r.name[0] ?? "?").toUpperCase()}
                          </span>
                      }
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: conn ? "#d1fae5" : "#64748b", lineHeight: 1.2, whiteSpace: "nowrap" }}>{r.name}</span>
                        {conn
                          ? <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 600 }}>Connected</span>
                          : <a href={`/api/strava/auth?runnerId=${r.id}`} style={{ fontSize: 10, color: "#FC4C02", textDecoration: "none", fontWeight: 600 }}>Connect →</a>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Runners ── */}
        <div style={S.sectionCard}>
          <div className="kt82-section-header" style={S.sectionHeader} onClick={() => setRunnersExpanded(!runnersExpanded)}>
            <div style={S.sectionHeaderLeft}>
              <span style={S.sectionTitle}>Runners</span>
              <span style={S.sectionMeta}>{runners.length} runners</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {resetConfirm === "runners" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Reset to defaults?</span>
                  <button
                    style={{ fontSize: 11, background: "#ef4444", color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}
                    onClick={() => doReset("runners")}
                  >Yes</button>
                  <button
                    style={{ fontSize: 11, background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                    onClick={() => setResetConfirm(null)}
                  >Cancel</button>
                </span>
              ) : (
                <button
                  className="kt82-reset-btn"
                  onClick={(e) => { e.stopPropagation(); setResetConfirm("runners"); }}
                >↺ Reset</button>
              )}
              <Chevron open={runnersExpanded} />
            </div>
          </div>
          {runnersExpanded && (
            <div style={S.sectionBody}>
              {runners.map((r, i) => {
                const isLast = i === runners.length - 1;
                const paceErr = runnerPaceErrors[r.id];
                const isBlocked = deleteBlocked?.id === r.id;
                return (
                  <div key={r.id}>
                    <div
                      className="kt82-runner-row"
                      style={isLast ? S.runnerRowLast : S.runnerRow}
                    >
                      <div style={S.runnerIndex}>{i + 1}</div>
                      <div>
                        <input
                          className="kt82-input"
                          style={{ ...(!r.name.trim() ? S.inputError : S.input), ...(isMobileDevice.current ? { cursor: "pointer" } : {}) }}
                          placeholder="Runner name"
                          aria-label="Runner name"
                          value={r.name}
                          readOnly={isMobileDevice.current}
                          onChange={isMobileDevice.current ? undefined : (e) => setRunners((prev) => prev.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))}
                          onClick={isMobileDevice.current ? () => setNameEditModal({ runnerId: r.id, runnerIndex: i, value: r.name }) : undefined}
                        />
                        {!r.name.trim() && <span style={S.fieldError}>Name cannot be blank</span>}
                        <div style={{ marginTop: 5 }}>
                          {stravaConnections[r.id] ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#166534", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 999, padding: "2px 8px 2px 5px" }}>
                              {stravaConnections[r.id].strava_profile_pic_url
                                ? <img src={stravaConnections[r.id].strava_profile_pic_url} alt="" style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 9, color: "#22c55e" }}>●</span>
                              }
                              <span>Strava connected</span>
                            </span>
                          ) : (
                            <a
                              href={`/api/strava/auth?runnerId=${r.id}`}
                              className="kt82-strava-connect"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#c2410c", background: "rgba(252,76,2,0.07)", border: "1px solid rgba(252,76,2,0.2)", borderRadius: 999, padding: "2px 8px", textDecoration: "none" }}
                            >
                              Connect Strava
                            </a>
                          )}
                        </div>
                      </div>
                      <div>
                        <PaceInput
                          value={r.pace}
                          onChange={(val) => handleRunnerPaceChange(r.id, val)}
                          error={paceErr}
                        />
                        {/* PaceInput renders its own error */}
                        <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginTop: 3 }}>
                          Assigned: {legs.filter((l) => l.runnerId === r.id).map((l) => `Leg ${l.id}`).join(", ") || "none"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="kt82-delete-btn"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: "4px", lineHeight: 1, borderRadius: 5, marginTop: 4 }}
                        onClick={() => tryDeleteRunner(r.id)}
                        title="Remove runner"
                      >×</button>
                    </div>
                    {isBlocked && (
                      <div style={S.deleteBlockMsg}>
                        Can't delete — assigned to {deleteBlocked.legIds.map((id) => `Leg ${id}`).join(", ")}.
                        Reassign those legs first.{" "}
                        <button
                          style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 11, padding: 0 }}
                          onClick={() => setDeleteBlocked(null)}
                        >Dismiss</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                style={{ marginTop: 10, padding: "8px 14px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}
                onClick={addRunner}
              >+ Add runner</button>
            </div>
          )}
        </div>

        {/* ── Legs ── */}
        <div style={S.sectionCard}>
          <div className="kt82-section-header" style={S.sectionHeader} onClick={() => setLegsExpanded(!legsExpanded)}>
            <div style={S.sectionHeaderLeft}>
              <span style={S.sectionTitle}>Legs</span>
              <span style={S.sectionMeta}>{calculatedLegs.length} legs · {totalLegDistance} mi</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {resetConfirm === "legs" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Reset leg paces?</span>
                  <button
                    style={{ fontSize: 11, background: "#ef4444", color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}
                    onClick={() => doReset("legs")}
                  >Yes</button>
                  <button
                    style={{ fontSize: 11, background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                    onClick={() => setResetConfirm(null)}
                  >Cancel</button>
                </span>
              ) : (
                <button
                  className="kt82-reset-btn"
                  onClick={(e) => { e.stopPropagation(); setResetConfirm("legs"); }}
                >↺ Reset</button>
              )}
              <Chevron open={legsExpanded} />
            </div>
          </div>
          {legsExpanded && (
            <div style={S.sectionBody}>
              {calculatedLegs.map((leg) => {
                const isDifficult = leg.rating === "Difficult";
                const isTrail = leg.rating === "Single Track";
                const paceErr = legPaceErrors[leg.id];
                return (
                  <div
                    key={leg.id}
                    ref={(el) => { legRefs.current[leg.id] = el; }}
                    className="kt82-leg-card"
                    style={{
                      ...S.legCard,
                      borderLeft: isDifficult
                        ? "3px solid #ef4444"
                        : isTrail
                        ? "3px solid #10b981"
                        : undefined,
                    }}
                  >
                    <div style={S.legHeaderRow}>
                      <span style={S.legNumber}>Leg {leg.id}</span>
                      <span style={S.legDot}>·</span>
                      <span style={S.legDist}>{leg.distance} mi</span>
                      <RatingBadge rating={leg.rating} />
                    </div>
                    <div style={S.legName}>{leg.name}</div>
                    <div className="kt82-leg-controls" style={S.legControlsRow}>
                      <div style={{ ...S.controlBlock, flex: "1 1 140px" }}>
                        <label style={S.inputLabel}>Runner</label>
                        <select
                          className="kt82-select kt82-input"
                          style={S.select}
                          value={leg.runnerId}
                          onChange={(e) => setLegs((prev) => prev.map((l) => l.id === leg.id ? { ...l, runnerId: e.target.value } : l))}
                        >
                          {runners.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={S.controlBlock}>
                        <label style={S.inputLabel}>Leg pace <span style={{ color: "#cbd5e1", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(overrides runner)</span></label>
                        <PaceInput
                          value={leg.pace}
                          onChange={(val) => handleLegPaceChange(leg.id, val)}
                          error={paceErr}
                        />
                      </div>
                    </div>
                    <div style={S.legMetricRow}>
                      <span style={S.metricChip}>⏱ {formatTime(leg.time)}</span>
                      <span style={S.metricChip}>Starts {formatTime12Hour(leg.startSeconds)}</span>
                      <span style={S.metricChip}>Ends {formatTime12Hour(leg.endSeconds)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Runner Totals ── */}
        <div style={S.sectionCard}>
          <div className="kt82-section-header" style={S.sectionHeader} onClick={() => setTotalsExpanded(!totalsExpanded)}>
            <div style={S.sectionHeaderLeft}>
              <span style={S.sectionTitle}>Runner Totals</span>
              <span style={S.sectionMeta}>{runners.length} runners</span>
            </div>
            <Chevron open={totalsExpanded} />
          </div>
          {totalsExpanded && (
            <div style={S.sectionBody}>
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
            </div>
          )}
        </div>

        {/* Summary footer */}
        <div style={S.summaryBar}>
          <div style={S.summaryItem}>
            <span style={S.summaryLabel}>Total race time</span>
            <span style={S.summaryValue}>{formatTime(teamTime)}</span>
          </div>
          <div style={S.summaryItem}>
            <span style={S.summaryLabel}>Estimated finish</span>
            <span style={S.summaryValue}>{formatTime12Hour(startSeconds + teamTime)}</span>
          </div>
        </div>

      </div>
    {stravaToast && (
      <div
        style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 10001, display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px 12px 16px", borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.22)",
          background:
            stravaToast.type === "success" ? "#166534" :
            stravaToast.type === "warning" ? "#92400e" : "#991b1b",
          color: "#fff", fontSize: 13, fontWeight: 600,
          maxWidth: "90vw", whiteSpace: "nowrap",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <span>{stravaToast.message}</span>
        <button
          type="button"
          onClick={() => setStravaToast(null)}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 18, padding: "0 2px", lineHeight: 1 }}
        >×</button>
      </div>
    )}
    {nameEditModal && (
      <RunnerNameModal
        runnerIndex={nameEditModal.runnerIndex}
        value={nameEditModal.value}
        onSave={(val) => {
          setRunners((prev) => prev.map((x) => x.id === nameEditModal.runnerId ? { ...x, name: val } : x));
          setNameEditModal(null);
        }}
        onClose={() => setNameEditModal(null)}
      />
    )}
    </div>
  );
}
