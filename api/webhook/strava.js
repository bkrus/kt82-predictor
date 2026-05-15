// Strava Webhook Endpoint
// Route: GET|POST /api/webhook/strava
//
// GET  — Strava calls this once during subscription setup to verify ownership.
// POST — Strava calls this in real-time for every activity event on connected accounts.
//
// Local testing with ngrok:
//   1. npx ngrok http 5173
//   2. Register the subscription (run once):
//      curl -X POST https://www.strava.com/api/v3/push_subscriptions \
//        -F client_id=$VITE_STRAVA_CLIENT_ID \
//        -F client_secret=$STRAVA_CLIENT_SECRET \
//        -F callback_url=https://<ngrok-id>.ngrok.io/api/webhook/strava \
//        -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
//   3. View existing subscriptions:
//      curl "https://www.strava.com/api/v3/push_subscriptions?client_id=...&client_secret=..."
//
// Supabase tables required:
//   - strava_tokens  (runner_id, strava_id, ...)  — created in .env.example
//   - webhook_events — see schema comment above insertPendingEvent()
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Logging ─────────────────────────────────────────────────────
//
// Writes to console always, and optionally to a Supabase `webhook_logs` table
// so you can inspect events in the Supabase dashboard during testing.
// The DB write is fire-and-forget — a failure here never affects the response.

async function log(level, message, meta = {}) {
  const entry = { level, message, meta, ts: new Date().toISOString() };

  if (level === "error") console.error(`[webhook/strava]`, message, meta);
  else if (level === "warn")  console.warn(`[webhook/strava]`, message, meta);
  else                        console.log(`[webhook/strava]`, message, meta);

  // Optional: persist to Supabase for dashboard visibility.
  supabase.from("webhook_logs").insert(entry).then(({ error }) => {
    if (error) console.error("[webhook/strava] Failed to write log to DB:", error.message);
  });
}

// ─── Queue ───────────────────────────────────────────────────────
//
// Serverless functions terminate as soon as the response is sent, so
// setTimeout is unreliable for background work. Instead, we write a row to
// `webhook_events` and return 200 immediately. A Supabase trigger or
// separate cron job (e.g. /api/cron/process-activities) can pick up
// rows with status='pending'.
//
// Required schema:
//   create table webhook_events (
//     id          bigint generated always as identity primary key,
//     runner_id   text   not null references strava_tokens(runner_id),
//     strava_id   bigint not null,
//     activity_id bigint not null,
//     event_time  bigint not null,   -- Unix seconds from Strava payload
//     status      text   not null default 'pending',  -- pending | done | error
//     created_at  timestamptz default now()
//   );

async function insertPendingEvent({ runnerId, stravaId, activityId, eventTime }) {
  const { error } = await supabase.from("webhook_events").insert({
    runner_id: runnerId,
    strava_id: stravaId,
    activity_id: activityId,
    event_time: eventTime,
    status: "pending",
  });
  if (error) throw error;
}

// ─── GET — subscription verification ─────────────────────────────

function handleVerification(req, res) {
  const challenge   = req.query["hub.challenge"];
  const verifyToken = req.query["hub.verify_token"];
  const mode        = req.query["hub.mode"];

  if (mode !== "subscribe") {
    console.warn("[webhook/strava] GET with unexpected hub.mode:", mode);
    return res.status(400).json({ error: "Unexpected hub.mode" });
  }

  if (verifyToken !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    console.warn("[webhook/strava] Verify token mismatch — possible misconfiguration or probe");
    return res.status(403).json({ error: "Invalid verify token" });
  }

  // Strava requires the key to literally be "hub.challenge" (dot included).
  return res.status(200).json({ "hub.challenge": challenge });
}

// ─── POST — activity event ────────────────────────────────────────
//
// Strava retries on 5xx. We always return 200 and log errors internally
// so a transient DB hiccup doesn't flood us with duplicate events.

async function handleEvent(req, res) {
  // Respond 200 to Strava immediately — before any async work.
  // (Some Vercel runtimes allow in-flight work after res.end(); this
  //  response-first pattern also works in Node http servers.)
  res.status(200).json({ status: "received" });

  const { object_type, aspect_type, object_id, owner_id, event_time } = req.body ?? {};

  await log("info", "Event received", { object_type, aspect_type, object_id, owner_id });

  // ── Filter: only care about new activities ────────────────────

  if (object_type !== "activity") {
    await log("info", `Ignoring non-activity event: ${object_type}`);
    return;
  }

  if (aspect_type !== "create") {
    await log("info", `Ignoring ${object_type}:${aspect_type} (only processing creates)`);
    return;
  }

  // ── Look up which runner this athlete belongs to ───────────────

  const { data: tokenRow, error: lookupError } = await supabase
    .from("strava_tokens")
    .select("runner_id")
    .eq("strava_id", owner_id)
    .maybeSingle();

  if (lookupError) {
    await log("error", "DB lookup failed for owner_id", { owner_id, error: lookupError.message });
    return;
  }

  if (!tokenRow) {
    // Activity from a Strava athlete not connected to any runner slot — safe to ignore.
    await log("warn", "No runner found for strava_id — event ignored", { owner_id });
    return;
  }

  // ── Queue the event for downstream processing ─────────────────

  try {
    await insertPendingEvent({
      runnerId: tokenRow.runner_id,
      stravaId: owner_id,
      activityId: object_id,
      eventTime: event_time,
    });
    await log("info", "Activity queued", { runner_id: tokenRow.runner_id, activity_id: object_id });
  } catch (err) {
    await log("error", "Failed to queue activity event", {
      runner_id: tokenRow.runner_id,
      activity_id: object_id,
      error: err.message,
    });
  }
}

// ─── Main handler ─────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "GET")  return handleVerification(req, res);
  if (req.method === "POST") return handleEvent(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}
