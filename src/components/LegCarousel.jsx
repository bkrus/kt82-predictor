import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { paceToDisplay, formatTime, formatManualCountdown, formatLocalTime, normalizePaceInput, validatePace } from "../utils";
import { PaceInput } from "./PaceInput";
import { LegEditModal } from "./LegEditModal";
import { RatingBadge } from "./RatingBadge";

const FONT = "'Archivo', system-ui, sans-serif";
const AMBER = "#F59E0B";
const GREEN = "#10B981";
const RED   = "#EF4444";

const SWIPE_THRESHOLD = 50;
const GAP = 12;

function computeCarouselDims() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 812;
  const isLandscape = vw > vh;
  const centerCardH = Math.round(Math.min(280, isLandscape ? vh * 0.55 : vh * 0.6));
  const sideCardH = Math.round(centerCardH * (118 / 280));
  const naturalH = centerCardH + 2 * (sideCardH + GAP) + GAP;
  const peek = isLandscape ? 0 : Math.min(68, Math.round(vh * 0.1));
  const maxContainerH = isLandscape ? Math.round(vh * 0.68) : Math.round(vh * 0.95);
  const containerH = Math.min(naturalH + peek, maxContainerH);
  const slots = [
    { offsetY: -(centerCardH / 2 + GAP + sideCardH / 2), scale: 0.85, opacity: 0.6 },
    { offsetY: 0, scale: 1.0, opacity: 1.0 },
    { offsetY: centerCardH / 2 + GAP + sideCardH / 2, scale: 0.85, opacity: 0.7 },
    { offsetY: centerCardH / 2 + 2 * GAP + sideCardH + sideCardH / 2, scale: 0.75, opacity: 0.6 },
  ];
  return { centerCardH, sideCardH, containerH, slots };
}

function useCarouselDimensions() {
  const [dims, setDims] = useState(computeCarouselDims);
  useEffect(() => {
    const handle = () => setDims(computeCarouselDims());
    window.addEventListener('resize', handle);
    window.addEventListener('orientationchange', handle);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
    };
  }, []);
  return dims;
}

// ─── Inline pace-edit modal ───────────────────────────────────────────────────

function PaceEditModal({ leg, runnerName, onSave, onClose }) {
  const initialPace = leg.pace || paceToDisplay(leg.time, leg.distance);
  const [pace, setPace] = useState(initialPace);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const commit = () => {
    const norm = normalizePaceInput(pace);
    const err = validatePace(norm);
    if (err) { setError(err); return; }
    onSave(norm);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.65)", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", fontFamily: FONT }}>Edit Pace</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: FONT, marginBottom: 2 }}>
          {leg.name ?? `Leg ${leg.id}`}
        </div>
        <div style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
          {runnerName} · {leg.distance} mi
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Predicted pace</div>
        <PaceInput value={pace} onChange={(v) => { setPace(v); setError(null); }} error={error} />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#f1f5f9", fontSize: 15, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: FONT }}>Cancel</button>
          <button type="button" onClick={commit} style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: "#0f172a", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: FONT }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit button used on side cards ──────────────────────────────────────────

function EditBtn({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontFamily: FONT, letterSpacing: "0.01em", lineHeight: 1.6, alignSelf: "flex-end" }}
    >
      ✏️ {label}
    </button>
  );
}

// ─── Strava activity deep-link icon ──────────────────────────────────────────

function StravaActivityLink({ stravaActivityId, topOffset = 8 }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title="View on Strava"
      onClick={(e) => {
        e.stopPropagation();
        window.open(`https://www.strava.com/activities/${stravaActivityId}`, "_blank", "noopener,noreferrer");
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        top: topOffset,
        right: 8,
        background: hovered ? "rgba(252,100,0,0.2)" : "rgba(252,100,0,0.10)",
        border: `1px solid ${hovered ? "rgba(252,100,0,0.4)" : "rgba(252,100,0,0.2)"}`,
        borderRadius: 6,
        padding: "3px 5px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fc6400",
        transition: "background 0.15s, border-color 0.15s",
        lineHeight: 0,
      }}
    >
      <ExternalLink size={11} strokeWidth={2.5} />
    </button>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }) {
  const isStrava = source === "strava";
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700,
      color: isStrava ? "#16a34a" : "#6b7280",
      background: isStrava ? "#f0fdf4" : "#f3f4f6",
      border: `1px solid ${isStrava ? "#86efac" : "#d1d5db"}`,
      borderRadius: 6, padding: "1px 6px", marginTop: 3,
    }}>
      {isStrava ? "✓ Synced" : "Manual"}
    </span>
  );
}

// ─── Individual leg card ──────────────────────────────────────────────────────

function LegCard({ item, slot, slotData, cardHeight, runnerMap, legETAMap, onNextRunner, isLastLeg, onOpenPaceEdit, onOpenTimeEdit, fastestLegId, profilePicUrl }) {
  const { leg, result, isCurrent, isCompleted } = item;
  const runner = runnerMap[leg.runnerId];
  const { offsetY, scale, opacity } = slotData;
  const isCenter = slot === 1;
  const distanceFromCenter = slot - 1;

  // ── State-based visual tokens ──────────────────────────────────────────────
  const rating = leg.rating ?? null;

  const cardBg     = isCompleted ? "#f0fdf4" : isCurrent ? "#312e81" : "#ffffff";
  const cardBorder = isCompleted
    ? "1.5px solid #86efac"
    : isCurrent
      ? "2px solid #818cf8"
      : "1px solid #e5e7eb";
  const cardShadow = isCurrent
    ? "0 8px 40px rgba(99,102,241,0.55), 0 0 0 1px rgba(129,140,248,0.3)"
    : isCompleted
      ? "0 2px 12px rgba(34,197,94,0.15)"
      : "0 2px 8px rgba(0,0,0,0.05)";
  const textPrimary  = isCompleted ? "#14532d" : isCurrent ? "#ffffff" : "#0f172a";
  const textMuted    = isCompleted ? "#16a34a" : isCurrent ? "rgba(255,255,255,0.65)" : "#64748b";
  const legNumPrefix = isCompleted ? "✓ " : isCurrent ? "" : "⏭ ";
  const paceColor    = isCompleted ? "#16a34a" : isCurrent ? "#a5b4fc" : "#6366f1";

  // Live countdown tick — center card only
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isCenter || isCompleted) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isCenter, isCompleted]);

  const eta = legETAMap?.get(leg.id);
  const countdownMs = isCenter && !isCompleted && eta?.endMs != null ? eta.endMs - now : null;
  const isOvertime = countdownMs !== null && countdownMs < 0;

  return (
    <motion.div
      initial={false}
      animate={{
        y: offsetY - cardHeight / 2,
        scale,
        opacity,
        rotateY: distanceFromCenter * 60,
      }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      style={{
        position: "absolute",
        top: "50%",
        left: "4%",
        width: "92%",
        height: cardHeight,
        zIndex: 5 - Math.abs(distanceFromCenter),
        transformOrigin: "center center",
        background: cardBg,
        borderRadius: 16,
        border: cardBorder,
        boxShadow: cardShadow,
        display: "flex",
        flexDirection: "column",
        padding: isCenter ? "16px 16px 14px" : "13px 14px 10px",
        boxSizing: "border-box",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
    >
      {/* ── Fastest pace ribbon ── */}
      {isCompleted && result?.legId === fastestLegId && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, fontFamily: FONT, letterSpacing: "0.02em", pointerEvents: "none" }}>
          ⚡ Fastest
        </div>
      )}

      {/* ── Strava activity link ── */}
      {isCompleted && result?.stravaActivityId && (
        <StravaActivityLink
          stravaActivityId={result.stravaActivityId}
          topOffset={result?.legId === fastestLegId ? 36 : 8}
        />
      )}

      {/* ── Top row: leg meta + right stat ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Leg number + difficulty badge on same row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: isCompleted ? "#16a34a" : isCurrent ? "#a5b4fc" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: FONT, flexShrink: 0 }}>
              {legNumPrefix}Leg {leg.id}
            </div>
            {rating && (
              <div style={{ transform: "scale(0.85)", transformOrigin: "left center", lineHeight: 1 }}>
                <RatingBadge rating={rating} />
              </div>
            )}
          </div>
          {isCenter && isCurrent && !isCompleted ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                {profilePicUrl ? (
                  <img src={profilePicUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2.5px solid rgba(255,255,255,0.45)", boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }} />
                ) : (
                  <span style={{ fontSize: 28, lineHeight: 1 }}>🏃</span>
                )}
                <div style={{ fontSize: "clamp(18px, 5.5vw, 26px)", fontWeight: 800, color: textPrimary, fontFamily: FONT, lineHeight: 1.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                  {runner?.name ?? "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenPaceEdit(item); }}
                title="Edit pace"
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.22)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ✏️
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2, minWidth: 0 }}>
              {profilePicUrl && !(isCenter && isCompleted) && (
                <img src={profilePicUrl} alt="" style={{ width: isCenter ? 32 : 26, height: isCenter ? 32 : 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: isCompleted ? "1.5px solid #86efac" : "1px solid rgba(0,0,0,0.10)" }} />
              )}
              <div style={{ fontSize: isCenter ? "clamp(20px, 6vw, 28px)" : "clamp(14px, 4.5vw, 17px)", fontWeight: 800, color: textPrimary, fontFamily: FONT, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {isCurrent ? `🏃 ${runner?.name ?? "—"}` : (runner?.name ?? "—")}
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
            {leg.distance} mi{!isCompleted ? ` · ${paceToDisplay(leg.time, leg.distance)}/mi` : ""}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {isCompleted && result ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, fontFamily: FONT, letterSpacing: "-0.02em" }}>
                {formatTime(Math.round(result.elapsedSeconds))}
              </div>
              <div style={{ fontSize: 12, color: textMuted, marginTop: 1 }}>
                {paceToDisplay(result.elapsedSeconds, result.distance)}/mi
              </div>
              <SourceBadge source={result.source} />
            </>
          ) : !isCenter ? (
            <>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 2 }}>Target</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: paceColor, fontFamily: FONT }}>
                {paceToDisplay(leg.time, leg.distance)}/mi
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Center card: active leg — countdown + NEXT RUNNER ── */}
      {isCenter && !isCompleted && isCurrent && (
        <>
          <div style={{ textAlign: "center", marginTop: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "clamp(48px, 12vw, 84px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: isOvertime ? "#fca5a5" : "#ffffff", fontFamily: FONT, fontVariantNumeric: "tabular-nums", textShadow: isOvertime ? "none" : "0 0 32px rgba(165,180,252,0.5)" }}>
              {countdownMs !== null ? formatManualCountdown(countdownMs) : "--:--"}
            </div>
            {isOvertime && (
              <div style={{ fontSize: 12, color: RED, fontWeight: 700, marginTop: 3 }}>Over predicted time</div>
            )}
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 4 }}>
              Exchange at {formatLocalTime(eta?.endMs)}
            </div>
          </div>
          {onNextRunner && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onNextRunner(); }}
                style={{ width: "100%", padding: "14px 0", background: isLastLeg ? GREEN : AMBER, border: "none", borderRadius: 12, color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em", boxShadow: isLastLeg ? "0 4px 18px rgba(16,185,129,0.38)" : "0 4px 18px rgba(245,158,11,0.38)", transition: "transform 0.1s" }}
                onPointerDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
                onPointerUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
                onPointerLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {isLastLeg ? "🏁 FINISH RACE" : "NEXT RUNNER"}
              </button>
              <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>
                {isLastLeg ? "Records actual finish time" : "Tap when runner exchanges"}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Center card: upcoming leg focused — description + edit pace ── */}
      {isCenter && !isCompleted && !isCurrent && (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", marginTop: 10, padding: "0 4px" }}>
            {leg.name ? (
              <div style={{ fontSize: 15, fontWeight: 500, color: "#374151", fontFamily: FONT, lineHeight: 1.4 }}>
                {leg.name}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: FONT }}>No description</div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenPaceEdit(item); }}
            style={{ width: "100%", marginTop: 10, padding: "12px 0", background: "#eef2ff", border: "1.5px solid #c7d2fe", borderRadius: 12, color: "#4f46e5", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
          >
            ✏️ Edit pace
          </button>
        </>
      )}

      {/* ── Center card: completed leg focused — large stats + edit times ── */}
      {isCenter && isCompleted && result && (
        <>
          <div style={{ textAlign: "center", marginTop: 12, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {profilePicUrl && (
              <img src={profilePicUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2.5px solid #86efac", boxShadow: "0 2px 14px rgba(34,197,94,0.3)", marginBottom: 10 }} />
            )}
            <div style={{ fontSize: 48, fontWeight: 900, color: "#14532d", fontFamily: FONT, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {formatTime(Math.round(result.elapsedSeconds))}
            </div>
            <div style={{ fontSize: 15, color: "#16a34a", marginTop: 6 }}>
              {paceToDisplay(result.elapsedSeconds, result.distance)}/mi
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenTimeEdit(item); }}
            style={{ width: "100%", marginTop: 10, padding: "12px 0", background: "#dcfce7", border: "1.5px solid #86efac", borderRadius: 12, color: "#14532d", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
          >
            ✏️ Edit times
          </button>
        </>
      )}

      {/* ── Side cards: edit button ── */}
      {!isCenter && (
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
          {isCompleted ? (
            <EditBtn label="Edit times" onClick={() => onOpenTimeEdit(item)} />
          ) : (
            <EditBtn label="Edit pace" onClick={() => onOpenPaceEdit(item)} />
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

export function LegCarousel({
  completedLegs,
  currentLegIndex,
  calculatedLegs,
  runnerMap,
  legETAMap,
  onNextRunner,
  isLastLeg,
  onEditPace,
  onEditLegTime,
  stravaConnections,
}) {
  const { centerCardH, sideCardH, containerH, slots } = useCarouselDimensions();
  const safeStart = Math.max(0, Math.min(currentLegIndex >= 0 ? currentLegIndex : 0, calculatedLegs.length - 1));
  const [focusedIdx, setFocusedIdx] = useState(safeStart);
  const [paceModal, setPaceModal] = useState(null);  // { item }
  const [timeModal, setTimeModal] = useState(null);  // { item }
  const touchStartY = useRef(null);
  const mouseStartY = useRef(null);

  useEffect(() => {
    if (focusedIdx >= calculatedLegs.length) {
      setFocusedIdx(Math.max(0, calculatedLegs.length - 1));
    }
  }, [calculatedLegs.length, focusedIdx]);

  const fastestLegId = useMemo(() => {
    if (completedLegs.length === 0) return null;
    return completedLegs.reduce((min, leg) => leg.actualPace < min.actualPace ? leg : min).legId;
  }, [completedLegs]);

  const legItems = calculatedLegs.map((leg, idx) => {
    const resultIndex = completedLegs.findIndex(r => r.legId === leg.id);
    const result = resultIndex >= 0 ? completedLegs[resultIndex] : null;
    const isCurrent = idx === currentLegIndex;
    const isCompleted = !!result;
    return { leg, result, resultIndex, isCurrent, isCompleted, idx };
  });

  const triggerNavigate = useCallback((dir) => {
    setFocusedIdx(prev => {
      const next = prev + dir;
      if (next < 0 || next >= legItems.length) return prev;
      return next;
    });
  }, [legItems.length]);

  const jumpTo = useCallback((i) => {
    setFocusedIdx(i);
  }, []);

  const handleTouchStart = useCallback((e) => { touchStartY.current = e.touches[0].clientY; }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(dy) < SWIPE_THRESHOLD) return;
    triggerNavigate(dy > 0 ? 1 : -1);
  }, [triggerNavigate]);

  const handleMouseDown = useCallback((e) => { mouseStartY.current = e.clientY; }, []);

  const handleMouseUp = useCallback((e) => {
    if (mouseStartY.current === null) return;
    const dy = mouseStartY.current - e.clientY;
    mouseStartY.current = null;
    if (Math.abs(dy) < SWIPE_THRESHOLD) return;
    triggerNavigate(dy > 0 ? 1 : -1);
  }, [triggerNavigate]);

  const slotEntries = [-1, 0, 1, 2].map(offset => {
    const itemIdx = focusedIdx + offset;
    if (itemIdx < 0 || itemIdx >= legItems.length) return null;
    return { item: legItems[itemIdx], slot: offset + 1 };
  });

  const canPrev = focusedIdx > 0;
  const canNext = focusedIdx < legItems.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", userSelect: "none", WebkitUserSelect: "none" }}>
      {/* Jump-to-current button */}
      {currentLegIndex >= 0 && focusedIdx !== currentLegIndex && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
          <button
            onClick={() => jumpTo(currentLegIndex)}
            style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", background: "#6366f1", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: FONT }}
          >
            ↩ Current Leg
          </button>
        </div>
      )}

      {/* Nav row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 4px" }}>
        <button onClick={() => triggerNavigate(-1)} disabled={!canPrev} style={{ fontSize: 12, color: canPrev ? "#6366f1" : "#d1d5db", background: "none", border: "none", cursor: canPrev ? "pointer" : "default", fontFamily: FONT, fontWeight: 600, padding: "4px 0" }}>
          ↑ Previous
        </button>
        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>
          {focusedIdx + 1} / {legItems.length}
        </span>
        <button onClick={() => triggerNavigate(1)} disabled={!canNext} style={{ fontSize: 12, color: canNext ? "#6366f1" : "#d1d5db", background: "none", border: "none", cursor: canNext ? "pointer" : "default", fontFamily: FONT, fontWeight: 600, padding: "4px 0" }}>
          Next ↓
        </button>
      </div>

      {/* Carousel track */}
      <div
        style={{ position: "relative", height: containerH, overflow: "hidden", touchAction: "pan-x", perspective: "1000px" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 14%, transparent 82%, rgba(0,0,0,0.85) 100%)" }} />

        {slotEntries.map(entry => {
          if (!entry) return null;
          return (
            <LegCard
              key={entry.item.leg.id}
              item={entry.item}
              slot={entry.slot}
              slotData={slots[entry.slot]}
              cardHeight={entry.slot === 1 ? centerCardH : sideCardH}
              runnerMap={runnerMap}
              legETAMap={legETAMap}
              onNextRunner={onNextRunner}
              isLastLeg={isLastLeg}
              onOpenPaceEdit={(item) => setPaceModal({ item })}
              onOpenTimeEdit={(item) => setTimeModal({ item })}
              fastestLegId={fastestLegId}
              profilePicUrl={stravaConnections?.[entry.item.leg.runnerId]?.strava_profile_pic_url ?? null}
            />
          );
        })}
      </div>

      {/* Dot indicators */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingTop: 4 }}>
        {legItems.map((_, i) => (
          <button
            key={i}
            onClick={() => jumpTo(i)}
            style={{ width: i === focusedIdx ? 18 : 7, height: 7, borderRadius: 999, background: i === focusedIdx ? "#6366f1" : "#d1d5db", border: "none", padding: 0, cursor: "pointer", transition: "width 0.25s ease, background 0.25s ease" }}
          />
        ))}
      </div>

      {/* Pace edit modal */}
      {paceModal && (
        <PaceEditModal
          leg={paceModal.item.leg}
          runnerName={runnerMap[paceModal.item.leg.runnerId]?.name ?? "—"}
          onSave={(pace) => { onEditPace?.(paceModal.item.leg.id, pace); setPaceModal(null); }}
          onClose={() => setPaceModal(null)}
        />
      )}

      {/* Time edit modal */}
      {timeModal && timeModal.item.result && (
        <LegEditModal
          legId={timeModal.item.leg.id}
          legName={timeModal.item.leg.name ?? `Leg ${timeModal.item.leg.id}`}
          distance={timeModal.item.leg.distance}
          startMs={timeModal.item.result.startTime}
          endMs={timeModal.item.result.endTime}
          onSave={(newStartMs, newEndMs) => {
            onEditLegTime?.(timeModal.item.resultIndex, newStartMs, newEndMs);
            setTimeModal(null);
          }}
          onClose={() => setTimeModal(null)}
        />
      )}
    </div>
  );
}
