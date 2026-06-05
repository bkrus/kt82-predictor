import { supabase } from "./supabaseClient";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { defaultRunners, defaultLegs } from "./data";
import {
  paceToSeconds, timeToSeconds, formatTime, formatTime12Hour,
  formatSavedTime, normalizePaceInput, validatePace, exchangeLocation,
  getCountdownUrgency, genId, formatLocalTime, paceToDisplay, computeLegETAs,
} from "./utils";
import { GLOBAL_CSS, S } from "./styles";
import { RatingBadge } from "./components/RatingBadge";
import { PaceInput } from "./components/PaceInput";
import { Chevron } from "./components/Chevron";
import { RunnerNameModal } from "./components/RunnerNameModal";
import { LegEditModal } from "./components/LegEditModal";
import { ManualRacePanel } from "./components/ManualRacePanel";
import { PredictorDashboard } from "./components/PredictorDashboard";
import { RunnerTotals } from "./components/RunnerTotals";

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
  const [stravaConnections, setStravaConnections] = useState({});
  const [stravaToast, setStravaToast] = useState(null); // { type: "success"|"warning"|"error", message }
  const [stravaExpanded, setStravaExpanded] = useState(true);
  const [stravaDisconnecting, setStravaDisconnecting] = useState(new Set());

  const [manualRaceStatus, setManualRaceStatus] = useState("idle"); // "idle" | "in_progress" | "completed"
  const [manualRaceStartedAt, setManualRaceStartedAt] = useState(null);
  const [manualRaceEndedAt, setManualRaceEndedAt] = useState(null);
  const [manualCurrentLeg, setManualCurrentLeg] = useState(1);
  const [manualLegResults, setManualLegResults] = useState([]);
  const [manualCurrentLegStartTime, setManualCurrentLegStartTime] = useState(null);
  const [manualResetConfirm, setManualResetConfirm] = useState(false);
  const [manualExchangeScreen, setManualExchangeScreen] = useState(null); // { legNum, runnerName, distance, elapsedSeconds, diff, isLast }
  const [legEditModal, setLegEditModal] = useState(null); // { resultIndex, legId, legName, distance, startMs, endMs, startOnly? }

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
        if (["idle","in_progress","completed"].includes(data.race_status)) setManualRaceStatus(data.race_status);
        if (data.race_started_at) {
          const value = new Date(data.race_started_at).getTime();
          console.log("[raceStartedAt SET]", { source: "initial_db_load", value, readable: value ? new Date(value).toLocaleString() : null, currentStatus: data.race_status, currentLocal: null, currentLocalReadable: null });
          setManualRaceStartedAt(value);
        }
        if (data.race_ended_at) setManualRaceEndedAt(new Date(data.race_ended_at).getTime());
        if (data.current_leg != null) setManualCurrentLeg(data.current_leg);
        if (Array.isArray(data.leg_results)) setManualLegResults(data.leg_results);
        if (data.current_leg_start_time) setManualCurrentLegStartTime(new Date(data.current_leg_start_time).getTime());
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
          if (d.race_status !== undefined) setManualRaceStatus(d.race_status || "idle");
          if (d.race_started_at !== undefined && d.race_status !== "in_progress") {
            const value = d.race_started_at ? new Date(d.race_started_at).getTime() : null;
            setManualRaceStartedAt(value);
          }
          if (d.race_ended_at !== undefined) setManualRaceEndedAt(d.race_ended_at ? new Date(d.race_ended_at).getTime() : null);
          if (d.current_leg != null) setManualCurrentLeg(d.current_leg);
          if (Array.isArray(d.leg_results)) setManualLegResults(d.leg_results);
          if (d.current_leg_start_time !== undefined) setManualCurrentLegStartTime(d.current_leg_start_time ? new Date(d.current_leg_start_time).getTime() : null);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleStravaDisconnect = useCallback(async (runnerId, athleteName) => {
    if (!window.confirm(`Disconnect ${athleteName}?`)) return;
    setStravaDisconnecting((prev) => new Set(prev).add(runnerId));
    try {
      const res = await fetch("/api/strava/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runnerId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Disconnect failed");
      }
      setStravaConnections((prev) => { const next = { ...prev }; delete next[runnerId]; return next; });
      setStravaToast({ type: "success", message: `${athleteName} disconnected.` });
    } catch (err) {
      setStravaToast({ type: "error", message: `Could not disconnect: ${err.message}` });
    } finally {
      setStravaDisconnecting((prev) => { const next = new Set(prev); next.delete(runnerId); return next; });
    }
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("strava");
    if (!status) return;
    window.history.replaceState({}, "", window.location.pathname);
    const runnerParam = params.get("runner");
    const runnerName = runners.find((r) => r.id === runnerParam)?.name ?? runnerParam ?? "";
    if (status === "connected") {
      setStravaToast({ type: "success", message: `Connected${runnerName ? ` for ${runnerName}` : ""}!` });
      fetchStravaConnections();
    } else if (status === "denied") {
      setStravaToast({ type: "warning", message: "Connection was cancelled." });
    } else {
      const reason = params.get("reason");
      setStravaToast({ type: "error", message: `Connection failed${reason ? ` (${reason})` : ""}. Please try again.` });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const manualLegStart = manualCurrentLegStartTime
    ?? (manualLegResults.length > 0
      ? manualLegResults[manualLegResults.length - 1].endTime
      : manualRaceStartedAt);

  const manualLegETAMap = useMemo(
    () => computeLegETAs(calculatedLegs, manualLegResults, manualRaceStartedAt),
    [calculatedLegs, manualLegResults, manualRaceStartedAt]
  );

  const manualCurrentCalcLeg = calculatedLegs.find((l) => l.id === manualCurrentLeg);
  const manualCurrentRunner = manualCurrentCalcLeg ? runnerMap[manualCurrentCalcLeg.runnerId] : null;
  const manualIsLastLeg = manualCurrentLeg === calculatedLegs.length;

  const manualCountdownMs =
    manualRaceStatus === "in_progress" &&
    manualLegStart &&
    manualCurrentCalcLeg
      ? Math.max(
          0,
          (manualLegStart + manualCurrentCalcLeg.time * 1000) -
            currentTime.getTime()
        )
      : null;

  const manualElapsedMs = manualRaceStatus !== "idle" && manualRaceStartedAt
    ? (manualRaceStatus === "completed" && manualRaceEndedAt
        ? manualRaceEndedAt - manualRaceStartedAt
        : currentTime.getTime() - manualRaceStartedAt)
    : null;
  const manualElapsedDisplay = manualElapsedMs != null ? formatTime(Math.floor(manualElapsedMs / 1000)) : null;

  const manualProjectedFinishMs = manualLegETAMap.get(calculatedLegs[calculatedLegs.length - 1]?.id)?.endMs;

  const manualFastestLeg = manualLegResults.length > 0
    ? manualLegResults.reduce((b, r) => (!b || r.actualPace < b.actualPace) ? r : b, null)
    : null;
  const manualSlowestLeg = manualLegResults.length > 0
    ? manualLegResults.reduce((w, r) => (!w || r.actualPace > w.actualPace) ? r : w, null)
    : null;
  const manualLongestLeg = manualLegResults.length > 0
    ? manualLegResults.reduce((b, r) => (!b || r.distance > b.distance) ? r : b, null)
    : null;
  const manualMountainGoatLeg = manualLegResults.length > 0
    ? manualLegResults.reduce((b, r) => (!b || (r.elevationGainFt ?? 0) > (b.elevationGainFt ?? 0)) ? r : b, null)
    : null;
  const manualTotalElapsedSec = manualLegResults.reduce((s, r) => s + r.elapsedSeconds, 0);
  const manualTotalDist = manualLegResults.reduce((s, r) => s + r.distance, 0);

  const manualLegElapsedMs = manualRaceStatus === "in_progress" && manualLegStart
    ? currentTime.getTime() - manualLegStart : null;
  const manualLegElapsedDisplay = manualLegElapsedMs != null ? formatTime(Math.floor(manualLegElapsedMs / 1000)) : null;

  const scrollToCurrentLeg = () => {
    if (!currentLeg) return;
    const go = () => legRefs.current[currentLeg.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!legsExpanded) { setLegsExpanded(true); setTimeout(go, 100); } else go();
  };

  const tryDeleteRunner = (runnerId) => {
    const blocking = legs.filter((l) => l.runnerId === runnerId).map((l) => l.id);
    if (blocking.length > 0) { setDeleteBlocked({ id: runnerId, legIds: blocking }); return; }
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

  const saveRaceState = async (status, startedAt, endedAt, currentLeg, legResults) => {
    const { error } = await supabase.from("team_plan").update({
      race_status: status,
      race_started_at: startedAt ? new Date(startedAt).toISOString() : null,
      race_ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      current_leg: currentLeg,
      leg_results: legResults,
    }).eq("id", "default");
    if (error) {
      console.error("Race state save error:", error);
      setStravaToast({ type: "error", message: "Sync failed — changes saved locally" });
    }
  };

  const upsertManualEntry = async (res, editedAt = null) => {
    const { error } = await supabase.from("manual_entries").upsert({
      team_plan_id: "default",
      leg_id: res.legId,
      runner_strava_id: res.runnerStravaId,
      runner_name: res.runnerName,
      distance_mi: res.distance,
      pace_min_per_mi: res.actualPace,
      elapsed_time_s: Math.round(res.elapsedSeconds),
      start_time: new Date(res.startTime).toISOString(),
      end_time: new Date(res.endTime).toISOString(),
      completed_at: new Date(res.endTime).toISOString(),
      source: res.source || "manual",
      strava_activity_id: res.stravaActivityId || null,
      ...(editedAt ? { edited_at: editedAt } : {}),
    }, { onConflict: "team_plan_id,leg_id" });
    if (error) console.error("manual_entries upsert error:", error);
  };

  const handleStartRace = async () => {
    if (supabaseSaveTimer.current) { clearTimeout(supabaseSaveTimer.current); supabaseSaveTimer.current = null; }
    const now = Date.now();
    setManualRaceStatus("in_progress");
    setManualRaceStartedAt(now);
    setManualRaceEndedAt(null);
    setManualCurrentLeg(1);
    setManualLegResults([]);
    await saveRaceState("in_progress", now, null, 1, []);
  };

  const handleNextRunner = async () => {
    const now = Date.now();
    const legStart = manualLegResults.length > 0
      ? manualLegResults[manualLegResults.length - 1].endTime
      : manualRaceStartedAt;
    if (!legStart) return;
    const calcLeg = calculatedLegs.find((l) => l.id === manualCurrentLeg);
    if (!calcLeg) return;
    const elapsedSeconds = (now - legStart) / 1000;
    const runner = runnerMap[calcLeg.runnerId];
    const stravaConn = stravaConnections[calcLeg.runnerId];
    const result = {
      legId: manualCurrentLeg,
      runnerId: calcLeg.runnerId,
      runnerName: runner?.name || "Unknown",
      runnerStravaId: stravaConn?.runner_strava_id || null,
      startTime: legStart,
      endTime: now,
      elapsedSeconds,
      actualPace: elapsedSeconds / 60 / calcLeg.distance,
      distance: calcLeg.distance,
      source: "manual",
      elevationGainFt: 0,
    };
    const newResults = [...manualLegResults, result];
    const isLast = manualCurrentLeg === calculatedLegs.length;
    const newStatus = isLast ? "completed" : "in_progress";
    const newCurrent = isLast ? manualCurrentLeg : manualCurrentLeg + 1;
    const newEndedAt = isLast ? now : null;
    setManualExchangeScreen({
      legNum: manualCurrentLeg,
      runnerName: runnerMap[calcLeg.runnerId]?.name ?? "Runner",
      distance: calcLeg.distance,
      elapsedSeconds,
      diff: calcLeg.time - elapsedSeconds,
      isLast,
    });
    setManualLegResults(newResults);
    setManualCurrentLeg(newCurrent);
    if (isLast) { setManualRaceStatus("completed"); setManualRaceEndedAt(now); }
    await Promise.all([
      saveRaceState(newStatus, manualRaceStartedAt, newEndedAt, newCurrent, newResults),
      upsertManualEntry(result),
    ]);
  };

  const handleClearExchange = useCallback(() => setManualExchangeScreen(null), []);

  const handleResetRace = async () => {
    setManualRaceStatus("idle");
    console.log("[raceStartedAt SET]", { source: "handleResetRace", value: null, readable: null, currentStatus: manualRaceStatus, currentLocal: manualRaceStartedAt, currentLocalReadable: manualRaceStartedAt ? new Date(manualRaceStartedAt).toLocaleString() : null });
    setManualRaceStartedAt(null);
    setManualRaceEndedAt(null);
    setManualCurrentLeg(1);
    setManualLegResults([]);
    setManualResetConfirm(false);
    setManualExchangeScreen(null);
    await saveRaceState("idle", null, null, 1, []);
  };

  const handleSaveLegEdit = async (resultIndex, newStartMs, newEndMs) => {
    if (resultIndex === -1) {
      console.log("[raceStartedAt SET]", { source: "handleSaveLegEdit_minus1", value: newStartMs, readable: newStartMs ? new Date(newStartMs).toLocaleString() : null, currentStatus: manualRaceStatus, currentLocal: manualRaceStartedAt, currentLocalReadable: manualRaceStartedAt ? new Date(manualRaceStartedAt).toLocaleString() : null });
      setManualRaceStartedAt(newStartMs);
      await saveRaceState(manualRaceStatus, newStartMs, manualRaceEndedAt, manualCurrentLeg, manualLegResults);
      setLegEditModal(null);
      setStravaToast({ type: "success", message: "Race start time updated" });
      return;
    }
    if (resultIndex === -2) {
      const updated = [...manualLegResults];
      const lastIdx = updated.length - 1;
      const prev = updated[lastIdx];
      const elapsed = Math.max(1, (newStartMs - prev.startTime) / 1000);
      const editedAt = new Date().toISOString();
      updated[lastIdx] = { ...prev, endTime: newStartMs, elapsedSeconds: elapsed, actualPace: elapsed / 60 / prev.distance, editedAt, runnerStravaId: prev.runnerStravaId || null, runnerName: prev.runnerName || "Unknown" };
      setManualLegResults(updated);
      await Promise.all([
        saveRaceState(manualRaceStatus, manualRaceStartedAt, manualRaceEndedAt, manualCurrentLeg, updated),
        upsertManualEntry(updated[lastIdx], editedAt),
      ]);
      setLegEditModal(null);
      setStravaToast({ type: "success", message: `Leg ${manualCurrentLeg} start time adjusted` });
      return;
    }
    const updated = [...manualLegResults];
    const r = updated[resultIndex];
    if (!r) return;
    const elapsed = Math.max(1, (newEndMs - newStartMs) / 1000);
    const editedAt = new Date().toISOString();

    // Backward cascade: if start time changed, sync previous leg's end to match
    let cascadeFrom = resultIndex;
    if (resultIndex > 0 && newStartMs !== r.startTime) {
      const prev = updated[resultIndex - 1];
      const prevElapsed = Math.max(1, (newStartMs - prev.startTime) / 1000);
      updated[resultIndex - 1] = { ...prev, endTime: newStartMs, elapsedSeconds: prevElapsed, actualPace: prevElapsed / 60 / prev.distance, editedAt, runnerStravaId: prev.runnerStravaId || null, runnerName: prev.runnerName || "Unknown" };
      cascadeFrom = resultIndex - 1;
    }

    updated[resultIndex] = { ...r, startTime: newStartMs, endTime: newEndMs, elapsedSeconds: elapsed, actualPace: elapsed / 60 / r.distance, editedAt, runnerStravaId: r.runnerStravaId || null, runnerName: r.runnerName || "Unknown" };

    // Forward cascade: propagate end time changes into subsequent legs' start times
    for (let i = resultIndex + 1; i < updated.length; i++) {
      const prevEnd = updated[i - 1].endTime;
      const cur = updated[i];
      const e = Math.max(1, (cur.endTime - prevEnd) / 1000);
      updated[i] = { ...cur, startTime: prevEnd, elapsedSeconds: e, actualPace: e / 60 / cur.distance, editedAt, runnerStravaId: cur.runnerStravaId || null, runnerName: cur.runnerName || "Unknown" };
    }

    const newRaceStart = (resultIndex === 0 && r.legId === 1) ? newStartMs : manualRaceStartedAt;
    setManualLegResults(updated);
    if (newRaceStart !== manualRaceStartedAt) {
      console.log("[raceStartedAt SET]", { source: "handleSaveLegEdit_leg1_cascade", value: newRaceStart, readable: newRaceStart ? new Date(newRaceStart).toLocaleString() : null, currentStatus: manualRaceStatus, currentLocal: manualRaceStartedAt, currentLocalReadable: manualRaceStartedAt ? new Date(manualRaceStartedAt).toLocaleString() : null });
      setManualRaceStartedAt(newRaceStart);
    }
    await Promise.all([
      saveRaceState(manualRaceStatus, newRaceStart, manualRaceEndedAt, manualCurrentLeg, updated),
      ...updated.slice(cascadeFrom).map((res) => upsertManualEntry(res, editedAt)),
    ]);
    setLegEditModal(null);
    setStravaToast({ type: "success", message: `Leg ${r.legId} updated` });
  };

  const handleAdjustCurrentLegStart = () => {
    if (manualLegResults.length === 0) {
      setLegEditModal({ resultIndex: -1, legId: 1, legName: calculatedLegs[0]?.name ?? "Leg 1", distance: calculatedLegs[0]?.distance ?? 0, startMs: manualRaceStartedAt, endMs: null, startOnly: true });
    } else {
      const lastRes = manualLegResults[manualLegResults.length - 1];
      const currentCalcLeg = calculatedLegs.find((l) => l.id === manualCurrentLeg);
      setLegEditModal({ resultIndex: -2, legId: manualCurrentLeg, legName: currentCalcLeg?.name ?? `Leg ${manualCurrentLeg}`, distance: currentCalcLeg?.distance ?? 0, startMs: lastRes.endTime, endMs: null, startOnly: true });
    }
  };

  return (
    <div style={S.page}>
      <style>{GLOBAL_CSS}</style>
      <div style={S.container}>

        {/* Page header */}
        <div style={S.pageHeader}>
          <div>
            <h1 style={S.pageTitle}>Run Forrest Run</h1>
            <p style={S.pageTitleSub}>KT82 Predictor · Race pace planner</p>
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
                    padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    fontFamily: "'Archivo', system-ui, sans-serif",
                    letterSpacing: active ? "-0.01em" : "0",
                    background: active ? (key === "race" ? "#dc2626" : "#ffffff") : "transparent",
                    color: active ? (key === "race" ? "#ffffff" : "#0f172a") : "#64748b",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    transition: "all 0.15s ease", whiteSpace: "nowrap",
                  }}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats bar — planner only */}
        {mode === "predictor" && <div
          className="kt82-stats-bar"
          style={{ ...S.statsBar, gridTemplateColumns: "repeat(3,1fr)" }}
        >
          {/* Race start input */}
          <div style={S.statCard} className="kt82-stat-card">
            <span style={S.statLabel}>Race start</span>
            <input type="time" className="kt82-input" style={S.startTimeInput} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>

          {/* Est. finish */}
          <div style={S.statCard} className="kt82-stat-card">
            <span style={S.statLabel}>Est. finish</span>
            <span style={S.statValueMd}>{formatTime12Hour(startSeconds + teamTime)}</span>
          </div>

          {/* Total time */}
          <div style={S.statCard} className="kt82-stat-card">
            <span style={S.statLabel}>Total time</span>
            <span style={S.statValue}>{formatTime(teamTime)}</span>
          </div>
        </div>}

        {/* Manual Race Mode UI */}
        {mode === "race" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16 }}>
          <ManualRacePanel
            status={manualRaceStatus}
            exchangeScreen={manualExchangeScreen}
            currentLeg={manualCurrentLeg}
            legResults={manualLegResults}
            calculatedLegs={calculatedLegs}
            runnerMap={runnerMap}
            runners={runners}
            currentRunner={manualCurrentRunner}
            currentCalcLeg={manualCurrentCalcLeg}
            isLastLeg={manualIsLastLeg}
            countdownMs={manualCountdownMs}
            legETAMap={manualLegETAMap}
            elapsedDisplay={manualElapsedDisplay}
            fastestLeg={manualFastestLeg}
            slowestLeg={manualSlowestLeg}
            longestLeg={manualLongestLeg}
            mountainGoatLeg={manualMountainGoatLeg}
            totalElapsedSec={manualTotalElapsedSec}
            totalDist={manualTotalDist}
            teamTime={teamTime}
            startTime={startTime}
            resetConfirm={manualResetConfirm}
            onStartRace={handleStartRace}
            onNextRunner={handleNextRunner}
            onResetRace={handleResetRace}
            onSetLegEditModal={setLegEditModal}
            onAdjustCurrentLegStart={handleAdjustCurrentLegStart}
            onSetResetConfirm={setManualResetConfirm}
            onClearExchange={handleClearExchange}
            onUpdateLegPace={(legId, pace) => setLegs(prev => prev.map(l => l.id === legId ? { ...l, pace } : l))}
            onEditLegTime={handleSaveLegEdit}
            stravaConnections={stravaConnections}
            onSetMode={setMode}
          />
          </div>
        )}

        {/* Runners — planner only */}
        {mode === "predictor" && <>
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
                  <button style={{ fontSize: 11, background: "#ef4444", color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }} onClick={() => doReset("runners")}>Yes</button>
                  <button style={{ fontSize: 11, background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }} onClick={() => setResetConfirm(null)}>Cancel</button>
                </span>
              ) : (
                <button className="kt82-reset-btn" onClick={(e) => { e.stopPropagation(); setResetConfirm("runners"); }}>↺ Reset</button>
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
                    <div className="kt82-runner-row" style={isLast ? S.runnerRowLast : S.runnerRow}>
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
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#166534", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 999, padding: "2px 4px 2px 5px" }}>
                              {stravaConnections[r.id].strava_profile_pic_url
                                ? <img src={stravaConnections[r.id].strava_profile_pic_url} alt="" style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 9, color: "#22c55e" }}>●</span>
                              }
                              <span>{stravaConnections[r.id].runner_name}</span>
                              <button
                                type="button"
                                className="kt82-strava-disconnect"
                                onClick={() => handleStravaDisconnect(r.id, stravaConnections[r.id].runner_name)}
                                disabled={stravaDisconnecting.has(r.id)}
                                title="Disconnect"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#16a34a", fontSize: 13, lineHeight: 1, padding: "0 3px", borderRadius: 3 }}
                              >
                                {stravaDisconnecting.has(r.id) ? "…" : "×"}
                              </button>
                            </span>
                          ) : (
                            <a
                              href={`/api/strava/auth?runnerId=${r.id}`}
                              className="kt82-strava-connect"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#c2410c", background: "rgba(252,76,2,0.07)", border: "1px solid rgba(252,76,2,0.2)", borderRadius: 999, padding: "2px 8px", textDecoration: "none" }}
                            >
                              Connect
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
                        <button style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 11, padding: 0 }} onClick={() => setDeleteBlocked(null)}>Dismiss</button>
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

        {/* Legs */}
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
                  <button style={{ fontSize: 11, background: "#ef4444", color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }} onClick={() => doReset("legs")}>Yes</button>
                  <button style={{ fontSize: 11, background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }} onClick={() => setResetConfirm(null)}>Cancel</button>
                </span>
              ) : (
                <button className="kt82-reset-btn" onClick={(e) => { e.stopPropagation(); setResetConfirm("legs"); }}>↺ Reset</button>
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
                const completedResult = manualLegResults.find((r) => r.legId === leg.id);
                const completedResultIndex = manualLegResults.findIndex((r) => r.legId === leg.id);
                const isActiveLeg = manualRaceStatus === "in_progress" && leg.id === manualCurrentLeg;
                const diff = completedResult ? leg.time - completedResult.elapsedSeconds : null;
                return (
                  <div
                    key={leg.id}
                    ref={(el) => { legRefs.current[leg.id] = el; }}
                    className="kt82-leg-card"
                    style={{
                      ...S.legCard,
                      borderLeft: completedResult ? "3px solid #16a34a"
                        : isActiveLeg ? "3px solid #f59e0b"
                        : isDifficult ? "3px solid #ef4444"
                        : isTrail ? "3px solid #10b981"
                        : undefined,
                    }}
                  >
                    <div style={S.legHeaderRow}>
                      <span style={S.legNumber}>Leg {leg.id}</span>
                      <span style={S.legDot}>·</span>
                      <span style={S.legDist}>{leg.distance} mi</span>
                      <RatingBadge rating={leg.rating} />
                      {completedResult && (
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#16a34a", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 999, padding: "2px 7px", letterSpacing: "0.08em" }}>
                          ✓ Completed
                        </span>
                      )}
                      {isActiveLeg && (
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#b45309", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 999, padding: "2px 7px", letterSpacing: "0.08em" }}>
                          🏃 Running
                        </span>
                      )}
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
                      {completedResult ? (
                        <>
                          <span style={{ ...S.metricChip, color: "#166534", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                            {formatLocalTime(completedResult.startTime)} → {formatLocalTime(completedResult.endTime)}
                          </span>
                          <span style={{ ...S.metricChip, color: "#166534", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                            ⏱ {formatTime(Math.round(completedResult.elapsedSeconds))}
                          </span>
                          <span style={{ ...S.metricChip, color: "#166534", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                            {paceToDisplay(completedResult.elapsedSeconds, completedResult.distance)}/mi
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={S.metricChip}>⏱ {formatTime(leg.time)}</span>
                          <span style={S.metricChip}>Starts {formatTime12Hour(leg.startSeconds)}</span>
                          <span style={S.metricChip}>Ends {formatTime12Hour(leg.endSeconds)}</span>
                        </>
                      )}
                    </div>

                    {completedResult && (
                      <div style={{ marginTop: 10, borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                        <div style={{ padding: "10px 12px", background: "rgba(34,197,94,0.05)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                          {[
                            { label: "Start", val: formatLocalTime(completedResult.startTime) },
                            { label: "End", val: formatLocalTime(completedResult.endTime) },
                            { label: "Duration", val: formatTime(Math.round(completedResult.elapsedSeconds)) },
                            { label: "Pace", val: `${paceToDisplay(completedResult.elapsedSeconds, completedResult.distance)}/mi` },
                          ].map(({ label, val }) => (
                            <div key={label}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#166534" }}>{label}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: "7px 12px", background: "#f9fafb", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.55, flex: 1 }}>
                            <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Predicted</span>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{formatTime12Hour(leg.startSeconds)} → {formatTime12Hour(leg.endSeconds)}</span>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>⏱ {formatTime(Math.round(leg.time))}</span>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{paceToDisplay(leg.time, leg.distance)}/mi</span>
                          </div>
                          {diff !== null && (
                            <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", color: diff >= 0 ? "#16a34a" : "#dc2626" }}>
                              {diff >= 0 ? "▲" : "▼"} {formatTime(Math.round(Math.abs(diff)))} {diff >= 0 ? "ahead" : "behind"}
                            </span>
                          )}
                          <button
                            onClick={() => setLegEditModal({ resultIndex: completedResultIndex, legId: leg.id, legName: leg.name, distance: leg.distance, startMs: completedResult.startTime, endMs: completedResult.endTime })}
                            style={{ fontSize: 11, background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "#374151", fontFamily: "inherit" }}
                          >Edit ✏️</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Runner Totals */}
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
              <RunnerTotals
                runnerTotals={runnerTotals}
                calculatedLegs={calculatedLegs}
                fastestRunnerId={fastestRunnerId}
              />
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
        </>}

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

      {legEditModal && (
        <LegEditModal
          legId={legEditModal.legId}
          legName={legEditModal.legName}
          distance={legEditModal.distance}
          startMs={legEditModal.startMs}
          endMs={legEditModal.endMs}
          startOnly={legEditModal.startOnly ?? false}
          onSave={(newStart, newEnd) => handleSaveLegEdit(legEditModal.resultIndex, newStart, newEnd)}
          onClose={() => setLegEditModal(null)}
        />
      )}
    </div>
  );
}
