// Route: POST /api/strava/disconnect
// Removes a runner's Strava connection by deleting their token row.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { runnerId } = req.body ?? {};

  if (!runnerId || typeof runnerId !== "string") {
    return res.status(400).json({ error: "Missing required field: runnerId" });
  }

  const { error } = await supabase
    .from("strava_tokens")
    .delete()
    .eq("runner_id", runnerId);

  if (error) {
    console.error(`[disconnect] DB error for runner ${runnerId}:`, error.message);
    return res.status(500).json({ error: "Failed to disconnect Strava account" });
  }

  console.info(`[disconnect] Runner ${runnerId} disconnected from Strava`);
  return res.status(200).json({ success: true });
}
