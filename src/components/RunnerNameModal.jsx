import { useState, useRef, useEffect } from "react";

export function RunnerNameModal({ runnerIndex, value, onSave, onClose }) {
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
