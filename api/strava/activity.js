// Fetches and normalizes a single Strava activity for a connected runner.
// Route: POST /api/strava/activity
//
// Also exports fetchStravaActivity() as a named export so the webhook
// processor (/api/cron/process-activities.js) can call it directly
// without going through HTTP.
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Token management ─────────────────────────────────────────────
//
// Looks up the token row for a Strava athlete, refreshes if within 60s
// of expiry, and persists the new tokens. Returns a valid access_token.

async function getValidTokenForRunner(runnerStravaId) {
  const { data: row, error } = await supabase
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("strava_id", runnerStravaId)
    .maybeSingle();

  if (error) throw new Error(`DB error looking up runner token: ${error.message}`);
  if (!row)  throw new Error("Runner not connected to Strava");
  if (!row.refresh_token) throw new Error("Token expired, reconnect needed");

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (row.expires_at > nowSeconds + 60) {
    return row.access_token;
  }

  // Token is expired (or expiring soon) — refresh it.
  let refreshed;
  try {
    const { data } = await axios.post(
      "https://www.strava.com/oauth/token",
      {
        client_id: process.env.VITE_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
      },
      { timeout: 8000 }
    );
    refreshed = data;
  } catch (err) {
    const status = err.response?.status;
    if (status === 400 || status === 401) {
      throw new Error("Invalid tokens, reconnect needed");
    }
    throw new Error(`Token refresh failed: ${err.response?.data?.message ?? err.message}`);
  }

  // Persist the new tokens. If this write fails we still have the token
  // in memory for this request — log and continue rather than aborting.
  const { error: updateError } = await supabase
    .from("strava_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("strava_id", runnerStravaId);

  if (updateError) {
    console.warn(`[activity] Token refresh DB write failed for ${runnerStravaId}:`, updateError.message);
  }

  return refreshed.access_token;
}

// ─── Strava API call with 429 handling ────────────────────────────
//
// Retries once if Strava rate-limits us and the Retry-After window is
// short enough to wait within a serverless function's time budget (≤15s).
// For longer windows, throws a tagged error so the caller can re-queue
// the job instead of blocking.

async function fetchFromStrava(activityId, accessToken, attempt = 0) {
  try {
    const { data } = await axios.get(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      }
    );
    return data;
  } catch (err) {
    const status = err.response?.status;

    if (status === 401) throw new Error("Invalid tokens, reconnect needed");
    if (status === 404) throw new Error("Activity not found on Strava");

    if (status === 429) {
      const retryAfter = parseInt(err.response.headers?.["retry-after"] ?? "900", 10);
      console.warn(`[activity] Rate limited by Strava. Retry-After: ${retryAfter}s (attempt ${attempt + 1})`);

      if (attempt === 0 && retryAfter <= 15) {
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return fetchFromStrava(activityId, accessToken, 1);
      }

      const rateLimitErr = new Error(`Rate limited by Strava — retry after ${retryAfter}s`);
      rateLimitErr.code = "STRAVA_RATE_LIMITED";
      rateLimitErr.retryAfter = retryAfter;
      throw rateLimitErr;
    }

    throw new Error(
      `Strava API error (${status ?? "network"}): ${err.response?.data?.message ?? err.message}`
    );
  }
}

// ─── Core logic (named export) ────────────────────────────────────
//
// Importable by other server-side modules (e.g. the webhook processor)
// without going through HTTP.

export async function fetchStravaActivity(runnerStravaId, stravaActivityId) {
  const accessToken = await getValidTokenForRunner(runnerStravaId);
  const activity    = await fetchFromStrava(stravaActivityId, accessToken);

  const distance_m    = activity.distance    ?? 0;
  const elapsed_time_s = activity.elapsed_time ?? 0;
  const distanceMi    = distance_m / 1609.34;

  return {
    strava_activity_id: activity.id,
    activity_name:      activity.name ?? "Untitled",
    distance_m,
    elapsed_time_s,
    moving_time_s:      activity.moving_time ?? elapsed_time_s,
    pace_min_per_mi:    distanceMi > 0 ? (elapsed_time_s / 60) / distanceMi : null,
    start_date:         activity.start_date_local ?? activity.start_date ?? null,
    start_lat:          activity.start_latlng?.[0]  ?? null,
    start_lng:          activity.start_latlng?.[1]  ?? null,
    end_lat:            activity.end_latlng?.[0]    ?? null,
    end_lng:            activity.end_latlng?.[1]    ?? null,
    polyline:           activity.map?.polyline ?? activity.map?.summary_polyline ?? null,
    elevation_gain_m:   activity.total_elevation_gain ?? null,
  };
}

// ─── Vercel handler (default export) ─────────────────────────────
//
// POST /api/strava/activity
// Body: { teamPlanId, runnerStravaId, stravaActivityId }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { teamPlanId, runnerStravaId, stravaActivityId } = req.body ?? {};

  if (!runnerStravaId || !stravaActivityId) {
    return res.status(400).json({ error: "Missing required fields: runnerStravaId, stravaActivityId" });
  }

  const stravaId   = Number(runnerStravaId);
  const activityId = Number(stravaActivityId);

  if (!Number.isFinite(stravaId) || !Number.isFinite(activityId)) {
    return res.status(400).json({ error: "runnerStravaId and stravaActivityId must be numeric" });
  }

  try {
    const activity = await fetchStravaActivity(stravaId, activityId);
    console.info(`[activity] Fetched activity ${activityId} for Strava athlete ${stravaId}`);
    return res.status(200).json({ teamPlanId, activity });
  } catch (err) {
    console.error(`[activity] Failed — athlete ${stravaId}, activity ${activityId}:`, err.message);

    if (err.code === "STRAVA_RATE_LIMITED") {
      return res.status(429).json({ error: err.message, retryAfter: err.retryAfter });
    }

    const status =
      err.message.includes("not found")    ? 404 :
      err.message.includes("reconnect")    ? 401 :
      err.message.includes("not connected") ? 404 : 500;

    return res.status(status).json({ error: err.message });
  }
}
