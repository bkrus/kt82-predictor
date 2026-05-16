export function PaceInput({ value, onChange, error }) {
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

  const btn = { background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 8, lineHeight: 1, padding: "2px 5px", userSelect: "none", WebkitUserSelect: "none" };
  const col = { display: "flex", flexDirection: "column", alignItems: "center" };
  const inp = { width: 30, textAlign: "center", border: "none", background: "transparent", fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "inherit", padding: "4px 0", outline: "none" };

  return (
    <div>
      <div style={{ display: "inline-flex", alignItems: "center", border: `1.5px solid ${error ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 8, background: error ? "#fff5f5" : "#f9fafb", padding: "0 8px 0 4px", minWidth: 116 }}>
        <div style={col}>
          <button type="button" style={btn} onClick={() => dM(1)} tabIndex={-1}>▲</button>
          <input style={inp} value={ok ? String(mins) : (value || "")} onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && ok) set(n, secs); else onChange(e.target.value); }} />
          <button type="button" style={btn} onClick={() => dM(-1)} tabIndex={-1}>▼</button>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#cbd5e1", padding: "0 1px", userSelect: "none" }}>:</span>
        <div style={col}>
          <button type="button" style={btn} onClick={() => dS(5)} tabIndex={-1}>▲</button>
          <input style={{ ...inp, width: 28 }} value={ok ? String(secs).padStart(2, "0") : ""} onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && ok) set(mins, n); }} />
          <button type="button" style={btn} onClick={() => dS(-5)} tabIndex={-1}>▼</button>
        </div>
        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 5, userSelect: "none" }}>/mi</span>
      </div>
      {error && <span style={{ display: "block", color: "#dc2626", fontSize: 11, marginTop: 3, fontWeight: 500 }}>{error}</span>}
    </div>
  );
}
