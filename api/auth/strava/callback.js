// Route: GET /api/auth/strava/callback?code=...&state=...
//
// State is a base64-encoded JSON blob set by the frontend:
//   btoa(JSON.stringify({ runnerId, timestamp }))
//
// Security checks performed here:
//   1. State is present, decodeable, and not expired (10-min window).
//   2. The returning Strava athlete is not already linked to a different runner.
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// ─── Helpers ─────────────────────────────────────────────────────

function redirectWithStatus(res, status, extra = {}) {
  const params = new URLSearchParams({ strava: status, ...extra });
  return res.redirect(`/?${params}`);
}

function decodeState(raw) {
  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state: rawState, error: stravaError } = req.query;

  // User clicked "Cancel" on Strava's auth page.
  if (stravaError) {
    console.warn("[strava/callback] User denied OAuth access:", stravaError);
    return redirectWithStatus(res, "denied");
  }

  if (!code) {
    console.warn("[strava/callback] Request missing authorization code");
    return res.status(400).json({ error: "Missing authorization code" });
  }

  // ── 1. Decode and validate state ─────────────────────────────

  if (!rawState) {
    console.warn("[strava/callback] Request missing state param");
    return res.status(400).json({ error: "Missing state parameter" });
  }

  const state = decodeState(rawState);

  if (!state || typeof state.runnerId !== "string" || typeof state.timestamp !== "number") {
    console.warn("[strava/callback] Malformed state param:", rawState);
    return res.status(400).json({ error: "Invalid state parameter" });
  }

  const ageMs = Date.now() - state.timestamp;
  if (ageMs > STATE_MAX_AGE_MS || ageMs < 0) {
    console.warn(
      `[strava/callback] State expired or future-dated for runner ${state.runnerId}. Age: ${Math.round(ageMs / 1000)}s`
    );
    return res.status(400).json({ error: "Authorization link expired — please try connecting again" });
  }

  const { runnerId } = state;

  // ── 2. Exchange code for tokens ───────────────────────────────

  let tokenData;
  try {
    const { data } = await axios.post(
      "https://www.strava.com/oauth/token",
      {
        client_id: process.env.VITE_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        redirect_uri: process.env.VITE_STRAVA_REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      },
      { timeout: 8000 }
    );
    tokenData = data;
  } catch (err) {
    const detail = err.response?.data ?? err.message;
    console.error("[strava/callback] Token exchange failed:", detail);
    return redirectWithStatus(res, "error", { reason: "token_exchange", runner: runnerId });
  }

  // ── 3. Extract athlete details ────────────────────────────────

  const athlete = tokenData.athlete ?? {};
  const stravaId = athlete.id;

  if (!stravaId) {
    console.error("[strava/callback] Strava response missing athlete.id:", tokenData);
    return redirectWithStatus(res, "error", { reason: "missing_athlete", runner: runnerId });
  }

  const name = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || "Unknown";
  const profilePic = athlete.profile ?? athlete.profile_medium ?? null;

  // ── 4. Security check: strava_id → runner_id collision ───────
  //
  // Detect if this Strava athlete is already linked to a DIFFERENT runner.
  // One real person should not be able to occupy two runner slots.

  const { data: existing, error: lookupError } = await supabase
    .from("strava_tokens")
    .select("runner_id")
    .eq("strava_id", stravaId)
    .maybeSingle();

  if (lookupError) {
    console.error("[strava/callback] DB lookup error:", lookupError);
    return redirectWithStatus(res, "error", { reason: "db", runner: runnerId });
  }

  if (existing && existing.runner_id !== runnerId) {
    console.warn(
      `[strava/callback] SUSPICIOUS: Strava athlete ${stravaId} (${name}) ` +
      `is already linked to runner ${existing.runner_id}, ` +
      `but state claims runner ${runnerId}. Request rejected.`
    );
    return res.status(403).json({
      error: "This Strava account is already connected to a different runner",
    });
  }

  // ── 5. Persist — keyed on runner_id (one slot per runner) ────

  const { error: dbError } = await supabase.from("strava_tokens").upsert(
    {
      runner_id: runnerId,
      strava_id: stravaId,
      name,
      profile_pic: profilePic,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "runner_id" }
  );

  if (dbError) {
    console.error("[strava/callback] Supabase upsert error:", dbError);
    return redirectWithStatus(res, "error", { reason: "db", runner: runnerId });
  }

  console.info(
    `[strava/callback] Runner ${runnerId} connected — Strava athlete ${stravaId} (${name})`
  );

  return redirectWithStatus(res, "connected", { runner: runnerId });
}
