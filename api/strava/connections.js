// Route: GET /api/strava/connections
// Returns only the public identity fields for all connected runners.
// Never returns token data.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data, error } = await supabase
    .from("strava_tokens")
    .select("runner_id, name, profile_pic");

  if (error) {
    console.error("[connections] DB error:", error.message);
    return res.status(500).json({ error: "Failed to load connections" });
  }

  return res.status(200).json({ connections: data ?? [] });
}
