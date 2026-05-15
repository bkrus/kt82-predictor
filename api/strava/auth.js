// Redirects the user to Strava's OAuth authorization page.
// Route: GET /api/strava/auth?runnerId=r1
//
// runnerId must be passed by the frontend so the callback knows which runner
// slot to populate. It is encoded into the state param (base64 JSON) and
// validated server-side in /api/auth/strava/callback.js.
export default function handler(req, res) {
  const { runnerId } = req.query;

  if (!runnerId || typeof runnerId !== "string") {
    return res.status(400).json({ error: "Missing required query param: runnerId" });
  }

  const state = Buffer.from(
    JSON.stringify({ runnerId, timestamp: Date.now() })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id:       process.env.VITE_STRAVA_CLIENT_ID,
    redirect_uri:    process.env.VITE_STRAVA_REDIRECT_URI,
    response_type:   "code",
    approval_prompt: "auto",
    scope:           "read,activity:read_all",
    state,
  });

  return res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}
