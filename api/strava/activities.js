// Returns recent Strava activities for a connected runner.
// Route: GET /api/strava/activities?runnerId=r1&per_page=30&page=1
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getValidToken(runnerId) {
  const { data, error } = await supabase
    .from("strava_tokens")
    .select("strava_id, access_token, refresh_token, expires_at")
    .eq("runner_id", runnerId)
    .maybeSingle();

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data)  throw new Error(`Runner ${runnerId} not connected to Strava`);

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (data.expires_at > nowSeconds + 60) {
    return data.access_token;
  }

  // Token expired — refresh it.
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
      access_token:  refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at:    refreshed.expires_at,
      updated_at:    new Date().toISOString(),
    })
    .eq("runner_id", runnerId);

  if (updateError) {
    console.warn(`[activities] Token refresh DB write failed for ${runnerId}:`, updateError.message);
  }

  return refreshed.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { runnerId, per_page = 30, page = 1 } = req.query;

  if (!runnerId) {
    return res.status(400).json({ error: "Missing required query param: runnerId" });
  }

  let token;
  try {
    token = await getValidToken(runnerId);
  } catch (err) {
    const status = err.message.includes("not connected") ? 404
                 : err.message.includes("reconnect")    ? 401
                 : 500;
    return res.status(status).json({ error: err.message });
  }

  try {
    const { data } = await axios.get("https://www.strava.com/api/v3/athlete/activities", {
      headers: { Authorization: `Bearer ${token}` },
      params:  { per_page, page },
      timeout: 10000,
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error(`[activities] Strava API error for runner ${runnerId}:`, err.response?.data ?? err.message);
    return res.status(502).json({ error: "Failed to fetch activities from Strava" });
  }
}
