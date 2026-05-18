import { createClient } from "@supabase/supabase-js";
import { processWebhook } from "./process-webhook.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];

    if (mode === "subscribe" && token === process.env.STRAVA_VERIFY_TOKEN) {
      return res.status(200).json({ "hub.challenge": challenge });
    }
    return res.status(403).json({ error: "Forbidden: verify token mismatch" });
  }

  if (req.method === "POST") {
    const { object_type, object_id, aspect_type, athlete, updates, event_time } = req.body ?? {};
    console.log("Webhook received", { object_type, object_id, aspect_type, athlete_id: athlete?.id, updates });

    if (object_type !== "activity") {
      console.log("Not an activity event");
      return res.status(200).json({ ok: true });
    }

    const { data: plan, error: planError } = await supabase
      .from("team_plan")
      .select("race_status, current_leg, race_started_at, legs")
      .eq("id", "default")
      .single();

    if (planError) {
      console.error("Supabase query error:", planError);
      return res.status(200).json({ ok: true });
    }

    if (plan.race_status !== "in_progress") {
      console.log("Race not in progress");
      return res.status(200).json({ ok: true });
    }

    const currentLegData = (plan.legs ?? []).find((l) => l.id === plan.current_leg);
    if (!currentLegData) {
      console.log(`Current leg ${plan.current_leg} not found in legs`);
      return res.status(200).json({ ok: true });
    }
    const runnerId = currentLegData.runnerId;
    console.log(`Current leg is ${plan.current_leg}, assigned to runner ${runnerId}`);

    const { data: connection, error: connError } = await supabase
      .from("strava_tokens")
      .select("runner_strava_id")
      .eq("runner_id", runnerId)
      .single();

    if (connError || !connection) {
      console.log("Runner not connected to Strava");
      return res.status(200).json({ ok: true });
    }

    if (String(athlete?.id) !== String(connection.runner_strava_id)) {
      console.log(`Athlete mismatch: webhook athlete ${athlete?.id} !== connected athlete ${connection.runner_strava_id}`);
      return res.status(200).json({ ok: true });
    }

    console.log(`✓ Webhook validated: activity_id=${object_id}, runner=${runnerId}, leg=${plan.current_leg}`);

    const { data: inserted, error: insertError } = await supabase
      .from("webhook_events")
      .insert({
        strava_event_id: String(object_id),
        object_type: "activity",
        aspect_type,
        object_id: String(object_id),
        owner_id: String(athlete?.id),
        event_time: event_time ? new Date(event_time * 1000).toISOString() : new Date().toISOString(),
        status: "pending",
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to store webhook event:", insertError);
    } else {
      console.log(`✓ Webhook stored with ID: ${inserted.id}`);
      processWebhook(inserted.id)
        .then(result => console.log("✓ Webhook processed:", result))
        .catch(err => console.error("✗ Webhook processing failed:", err));
    }

    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
