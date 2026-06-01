import { createClient } from "@supabase/supabase-js";
import { enrichActivity } from "./enrich-activity.js";
import { matchActivityToLeg } from "./legMatcher.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function processWebhook(webhookEventId) {
  console.log(`[process-webhook] Starting processing for event ${webhookEventId}`);

  // ── Fetch webhook event ───────────────────────────────────────────────

  const { data: event, error: eventError } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("id", webhookEventId)
    .single();

  if (eventError || !event) {
    console.error(`[process-webhook] Failed to fetch event ${webhookEventId}:`, eventError?.message);
    return { matched: false };
  }

  if (event.status !== "pending") {
    console.log(`[process-webhook] Event ${webhookEventId} already processed (status: ${event.status})`);
    return { matched: false };
  }

  const stravaActivityId = event.object_id;

  // ── Fetch race state ──────────────────────────────────────────────────

  const { data: plan, error: planError } = await supabase
    .from("team_plan")
    .select("race_status, current_leg, race_started_at, legs, leg_results, runners")
    .eq("id", "default")
    .single();

  if (planError || !plan) {
    console.error(`[process-webhook] Failed to fetch team_plan:`, planError?.message);
    return { matched: false };
  }

  if (plan.race_status !== "in_progress") {
    console.log(`[process-webhook] Race not in progress (status: ${plan.race_status})`);
    await setStatus(webhookEventId, "no_match");
    return { matched: false };
  }

  // ── Get current leg runner ────────────────────────────────────────────

  const currentLegData = (plan.legs ?? []).find((l) => l.id === plan.current_leg);
  if (!currentLegData) {
    console.error(`[process-webhook] Current leg ${plan.current_leg} not found in plan`);
    return { matched: false };
  }
  const runnerId = currentLegData.runnerId;
  console.log(`[process-webhook] Current leg: ${plan.current_leg}, runner: ${runnerId}`);

  // ── Enrich activity ───────────────────────────────────────────────────

  console.log(`[process-webhook] Enriching activity ${stravaActivityId} for runner ${runnerId}`);
  const enrichResult = await enrichActivity(stravaActivityId, runnerId, currentLegData.id);

  if (enrichResult.error || !enrichResult.data) {
    console.error(`[process-webhook] Enrich failed:`, enrichResult.error);
    await setStatus(webhookEventId, "no_match");
    return { matched: false };
  }

  const activity = enrichResult.data;
  console.log(`[process-webhook] Enriched: ${activity.distance_m}m, ${activity.elapsed_time_s}s`);

  // ── Match to leg ──────────────────────────────────────────────────────

  const assignedLegs = [{ id: currentLegData.id, distance: currentLegData.distance }];
  const match = await matchActivityToLeg(activity, runnerId, assignedLegs, "default");

  console.log(`[process-webhook] Match result:`, match
    ? `legId=${match.legId}, confidence=${match.confidence.toFixed(3)}, method=${match.matchMethod}`
    : "null");

  // ── Route on confidence ───────────────────────────────────────────────

  if (!match || match.confidence < 0.5) {
    console.log(`[process-webhook] No match or low confidence`);
    await setStatus(webhookEventId, "no_match");
    return { matched: false };
  }

  if (match.confidence < 0.80) {
    console.log(`[process-webhook] Needs confirmation (confidence: ${match.confidence.toFixed(3)})`);
    await supabase
      .from("webhook_events")
      .update({
        status: "pending_confirmation",
        match_details: {
          legId:       match.legId,
          confidence:  match.confidence,
          matchMethod: match.matchMethod,
          details:     match.details,
        },
      })
      .eq("id", webhookEventId);
    return { matched: false, needsConfirmation: true, legId: match.legId, confidence: match.confidence };
  }

  // ── Auto-advance: confidence >= 0.85 ─────────────────────────────────

  console.log(`[process-webhook] Auto-advancing leg ${plan.current_leg} (confidence: ${match.confidence.toFixed(3)})`);

  const distanceMi = (activity.distance_m ?? 0) / 1609.344;
  const startTime  = activity.activity_start_date_local || activity.activity_start_date;
  const endTime    = activity.activity_end_date_local   || activity.activity_end_date;
  const now        = new Date().toISOString();

  const runnerConfig  = (plan.runners ?? []).find((r) => r.id === runnerId);
  const runnerName    = runnerConfig?.name ?? "Unknown";
  const runnerStravaId = event.owner_id ? String(event.owner_id) : null;

  const legResult = {
    legId:            currentLegData.id,
    runnerId:         currentLegData.runnerId,
    runnerName,
    runnerStravaId,
    startTime:        startTime ? new Date(startTime).getTime() : null,
    endTime:          endTime   ? new Date(endTime).getTime()   : null,
    elapsedSeconds:   activity.elapsed_time_s,
    actualPace:       activity.pace_min_per_mi,
    distance:         distanceMi,
    source:           "strava",
    stravaActivityId: String(stravaActivityId),
  };

  const updatedLegResults = [...(plan.leg_results ?? []), legResult];
  const newCurrentLeg     = plan.current_leg + 1;

  const { error: planUpdateError } = await supabase
    .from("team_plan")
    .update({
      current_leg:  newCurrentLeg,
      leg_results:  updatedLegResults,
    })
    .eq("id", "default");

  if (planUpdateError) {
    console.error(`[process-webhook] Failed to update team_plan:`, planUpdateError.message);
  }

  const { error: entryError } = await supabase
    .from("manual_entries")
    .upsert({
      team_plan_id:        "default",
      leg_id:              match.legId,
      runner_strava_id:    runnerStravaId,
      runner_name:         runnerName,
      source:              "strava",
      strava_activity_id:  String(stravaActivityId),
      elapsed_time_s:      activity.elapsed_time_s,
      distance_mi:         distanceMi,
      pace_min_per_mi:     activity.pace_min_per_mi,
      start_time:          startTime ?? null,
      end_time:            endTime   ?? null,
      completed_at:        now,
    }, { onConflict: "team_plan_id,leg_id" });

  if (entryError) {
    console.error(`[process-webhook] manual_entries upsert failed:`, entryError.message);
  }

  await setStatus(webhookEventId, "processed");

  console.log(`[process-webhook] ✓ Auto-advanced to leg ${newCurrentLeg}`);
  return { matched: true, legId: match.legId, confidence: match.confidence };
}

async function setStatus(webhookEventId, status) {
  const { error } = await supabase
    .from("webhook_events")
    .update({ status })
    .eq("id", webhookEventId);
  if (error) console.error(`[process-webhook] Failed to set status ${status}:`, error.message);
}
