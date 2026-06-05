import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getValidToken(runnerId) {
  const { data, error } = await supabase
    .from("strava_tokens")
    .select("runner_strava_id, access_token, refresh_token, token_expires_at")
    .eq("runner_id", runnerId)
    .maybeSingle();

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data) throw new Error(`Runner ${runnerId} not connected to Strava`);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = Math.floor(new Date(data.token_expires_at).getTime() / 1000);
  if (expiresAtSeconds > nowSeconds + 60) {
    return { access_token: data.access_token, runner_strava_id: data.runner_strava_id };
  }

  let refreshed;
  try {
    const { data: r } = await axios.post(
      "https://www.strava.com/oauth/token",
      {
        client_id:     process.env.VITE_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type:    "refresh_token",
        refresh_token: data.refresh_token,
      },
      { timeout: 8000 }
    );
    refreshed = r;
  } catch (err) {
    const status = err.response?.status;
    if (status === 400 || status === 401) throw new Error("Invalid tokens, reconnect needed");
    throw new Error(`Token refresh failed: ${err.response?.data?.message ?? err.message}`);
  }

  const { error: updateError } = await supabase
    .from("strava_tokens")
    .update({
      access_token:     refreshed.access_token,
      refresh_token:    refreshed.refresh_token,
      token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    })
    .eq("runner_id", runnerId);

  if (updateError) {
    console.warn(`[enrich-activity] Token refresh DB write failed for ${runnerId}:`, updateError.message);
  }

  return { access_token: refreshed.access_token, runner_strava_id: data.runner_strava_id };
}

export async function enrichActivity(strava_activity_id, runner_id, currentLeg) {
  let tokenData;
  try {
    tokenData = await getValidToken(runner_id);
  } catch (err) {
    console.error(`[enrich-activity] Token error for runner ${runner_id}:`, err.message);
    return { error: err.message };
  }

  let activity;
  try {
    const { data } = await axios.get(
      `https://www.strava.com/api/v3/activities/${strava_activity_id}`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        timeout: 10000,
      }
    );
    activity = data;
  } catch (err) {
    console.error(`[enrich-activity] Strava API error for activity ${strava_activity_id}:`, err.response?.data ?? err.message);
    return { error: "Failed to fetch activity from Strava" };
  }

  const distanceM = activity.distance ?? 0;
  const elapsedSec = activity.elapsed_time ?? 0;
  const movingSec = activity.moving_time ?? 0;
  const elevationGainFt = Math.round((activity.total_elevation_gain ?? 0) * 3.28084);
  const paceMinPerMi = distanceM > 0 && movingSec > 0
    ? (movingSec / 60) / (distanceM / 1609.344)
    : null;

  const startLat = activity.start_latlng?.[0] ?? null;
  const startLng = activity.start_latlng?.[1] ?? null;
  const endLat   = activity.end_latlng?.[0] ?? null;
  const endLng   = activity.end_latlng?.[1] ?? null;

  const activityStartDate = activity.start_date ?? null;

  const record = {
    strava_activity_id: String(strava_activity_id),
    runner_strava_id:   String(activity.athlete?.id ?? tokenData.runner_strava_id),
    distance_m:         distanceM,
    elapsed_time_s:     elapsedSec,
    moving_time_s:      movingSec,
    pace_min_per_mi:    paceMinPerMi,
    start_lat:          startLat,
    start_lng:          startLng,
    end_lat:            endLat,
    end_lng:            endLng,
    activity_name:      activity.name ?? null,
    activity_type:      activity.type ?? activity.sport_type ?? null,
    strava_url:         `https://www.strava.com/activities/${strava_activity_id}`,
    polyline:           activity.map?.summary_polyline ?? null,
    activity_start_date: activityStartDate,
    synced_at:          new Date().toISOString(),
    leg_id:             currentLeg,
  };

  const { data: stored, error: upsertError } = await supabase
    .from("strava_syncs")
    .upsert(record, { onConflict: "strava_activity_id" })
    .select()
    .single();

  if (upsertError) {
    console.error(`[enrich-activity] DB upsert error for activity ${strava_activity_id}:`, upsertError.message);
    return { error: upsertError.message };
  }

  console.log(`[enrich-activity] ✓ Stored activity ${strava_activity_id} for runner ${runner_id} (${distanceM}m, ${elapsedSec}s, ${elevationGainFt}ft gain)`);
  return { data: stored, elevationGainFt };
}
