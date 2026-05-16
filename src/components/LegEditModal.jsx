import { useState, useEffect } from "react";
import { msToTimeInput, applyTimeInput, paceToDisplay, formatTime } from "../utils";

export function LegEditModal({ legId, legName, distance, startMs, endMs, startOnly, onSave, onClose }) {
  const [si, setSi] = useState(() => msToTimeInput(startMs));
  const [ei, setEi] = useState(() => msToTimeInput(endMs ?? startMs));
  const ns = applyTimeInput(startMs, si);
  const ne = startOnly ? ns : applyTimeInput(endMs ?? startMs, ei);
  const elapsed = startOnly ? null : (ne - ns) / 1000;
  const valid = startOnly || ne > ns;

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.8)", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#0f172a", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#334155", margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b", marginBottom: 4 }}>
              {startOnly ? "Adjust Leg Start Time" : `Edit Leg ${legId}`}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{legName}{distance ? ` · ${distance} mi` : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#475569", cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: 8, fontFamily: "'Archivo', system-ui, sans-serif" }}>
            {startOnly ? "New Start Time" : "Start Time"}
          </label>
          <input type="time" step="1" value={si} onChange={(e) => setSi(e.target.value)}
            style={{ width: "100%", padding: "14px", borderRadius: 10, border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", fontSize: 20, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>

        {!startOnly && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: 8, fontFamily: "'Archivo', system-ui, sans-serif" }}>End Time</label>
              <input type="time" step="1" value={ei} onChange={(e) => setEi(e.target.value)}
                style={{ width: "100%", padding: "14px", borderRadius: 10, border: `1px solid ${valid ? "#334155" : "#ef4444"}`, background: "#1e293b", color: "#f8fafc", fontSize: 20, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              {!valid && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>End time must be after start time</div>}
            </div>
            <div style={{ display: "flex", gap: 20, padding: "12px 14px", background: "#1e293b", borderRadius: 10, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Duration</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>{elapsed != null && elapsed > 0 ? formatTime(Math.round(elapsed)) : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pace</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>{elapsed != null && elapsed > 0 && distance ? `${paceToDisplay(elapsed, distance)}/mi` : "—"}</div>
              </div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button
            onClick={() => valid && onSave(ns, ne)}
            disabled={!valid}
            style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: valid ? "#f59e0b" : "#374151", color: valid ? "#fff" : "#64748b", fontSize: 15, fontWeight: 700, cursor: valid ? "pointer" : "default", fontFamily: "inherit" }}
          >Save Changes</button>
        </div>
      </div>
    </div>
  );
}
