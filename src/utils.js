export function paceToSeconds(pace) {
  const m = pace?.match(/^(\d+):(\d{2})$/);
  if (!m) return 600;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function timeToSeconds(time) {
  const [h, mn] = time.split(":").map(Number);
  return h * 3600 + mn * 60;
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatTime12Hour(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
}

export function formatSavedTime(lastSaved, currentTime) {
  if (!lastSaved) return "Not saved yet";
  const ago = Math.floor((currentTime - lastSaved) / 1000);
  if (ago < 10) return "Saved just now";
  if (ago < 3600) return `Saved ${Math.max(1, Math.floor(ago / 60))} min ago`;
  return `Saved ${lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function normalizePaceInput(value) {
  if (!value || typeof value !== "string" || value.includes(":")) return value;
  const num = value.replace(/[^0-9]/g, "");
  if (!num.length) return value;
  if (num.length <= 2) return `${parseInt(num, 10)}:00`;
  if (num.length === 3) return `${parseInt(num[0], 10)}:${num.slice(1).padStart(2, "0")}`;
  if (num.length === 4) return `${parseInt(num.slice(0, 2), 10)}:${num.slice(2).padStart(2, "0")}`;
  return value;
}

export function validatePace(value) {
  if (!value || value.trim() === "") return null;
  const t = value.trim();
  if (/\s/.test(t)) return "No spaces — use MM:SS";
  if (/\./.test(t)) return "Use MM:SS, not decimals";
  if (!/^\d+:\d{2}$/.test(t)) return "Format: MM:SS (e.g. 9:30)";
  const [, sec] = t.split(":").map(Number);
  if (sec >= 60) return "Seconds must be 00–59";
  return null;
}

export function exchangeLocation(legName) {
  const idx = legName.indexOf(" to ");
  return idx >= 0 ? legName.slice(idx + 4) : legName;
}

export function getCountdownUrgency(seconds) {
  if (seconds < 600)  return { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.45)",  color: "#dc2626" };
  if (seconds < 1500) return { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.45)", color: "#b45309" };
  return                     { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)", color: "#e2e8f0" };
}

let _uid = 100;
export const genId = () => `r${++_uid}`;

export function formatManualCountdown(ms) {
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${neg ? "-" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatLocalTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function paceToDisplay(totalSeconds, distance) {
  if (!distance) return "—";
  const paceSeconds = totalSeconds / distance;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function computeLegETAs(calcLegs, legResults, raceStartedAt) {
  const map = new Map();
  if (!raceStartedAt) return map;
  let cursor = raceStartedAt;
  for (const leg of calcLegs) {
    const result = legResults.find((r) => r.legId === leg.id);
    if (result) {
      const endMs = result.endTime
        ?? (result.startTime != null ? result.startTime + result.elapsedSeconds * 1000 : cursor);
      map.set(leg.id, { startMs: result.startTime, endMs, actual: true });
      cursor = endMs;
    } else {
      const endMs = cursor + leg.time * 1000;
      map.set(leg.id, { startMs: cursor, endMs, actual: false });
      cursor = endMs;
    }
  }
  return map;
}

export function msToTimeInput(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function applyTimeInput(refMs, timeStr) {
  if (!timeStr || !refMs) return refMs ?? 0;
  const d = new Date(refMs);
  const p = timeStr.split(":").map(Number);
  d.setHours(p[0] || 0, p[1] || 0, p[2] || 0, 0);
  let result = d.getTime();
  // If result is >12 h before reference, the time wrapped past midnight — advance one day
  if (result < refMs - 12 * 3600 * 1000) result += 24 * 3600 * 1000;
  return result;
}
