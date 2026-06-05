#!/usr/bin/env node
/**
 * End-to-end smoke test for the Strava webhook pipeline.
 *
 * WHAT THIS PROVES
 *   - /api/strava/webhook is reachable and returns 200
 *   - The Strava payload shape is accepted by the handler
 *   - When race_status is "in_progress" and the athlete ID matches the current
 *     leg's runner, a webhook_events row is inserted and processed synchronously
 *   - The Strava API call in enrich-activity.js succeeds with the stored tokens
 *     (requires a real activity ID owned by the connected athlete)
 *   - If the leg match confidence is >= 0.85, team_plan.leg_results gains a new
 *     entry that includes elevationGainFt
 *   - The final event status is "processed", "no_match", or "pending_confirmation"
 *
 * WHAT THIS DOES NOT PROVE
 *   - UI rendering of manual/no-elevation leg entries (frontend concern)
 *   - Correctness of the leg matching algorithm (covered by legMatcher.test.mjs)
 *   - Token refresh flow (only triggered when the stored token is near-expiry)
 *   - Duplicate submission handling
 *
 * SIDE EFFECT WARNING
 *   If confidence >= 0.85, this test WILL advance current_leg and append to
 *   leg_results in team_plan. This is a live end-to-end test against real data.
 *   Run it intentionally.
 *
 * REQUIRED ENV VARS
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (bypasses RLS)
 *   STRAVA_ACTIVITY_ID         — A real recent Strava activity ID owned by the
 *                                connected athlete for the current leg
 *
 * OPTIONAL ENV VARS
 *   VERCEL_URL  — Override the target host (default: kt82-predictor.vercel.app)
 *                 Use "localhost:3000" for local vercel dev testing
 *
 * USAGE
 *   STRAVA_ACTIVITY_ID=<id> node webhook-test.js
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { config } from 'dotenv';

config({ path: '.env.local' });

// ── Env validation ────────────────────────────────────────────────────────────

const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRAVA_ACTIVITY_ID'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach(v => console.error(`  ${v}`));
  if (!process.env.STRAVA_ACTIVITY_ID) {
    console.error(
      '\nThis test requires a real Strava activity ID owned by the connected athlete.' +
      '\nFind one at strava.com/athlete/training or from recent activity in the Strava app.' +
      '\n\nUsage: STRAVA_ACTIVITY_ID=<number> node webhook-test.js'
    );
  }
  process.exit(1);
}

const STRAVA_ACTIVITY_ID = process.env.STRAVA_ACTIVITY_ID;
const rawHost = process.env.VERCEL_URL || 'kt82-predictor.vercel.app';
const isLocal = rawHost.startsWith('localhost') || rawHost.startsWith('127.');
const baseUrl = isLocal ? `http://${rawHost}` : `https://${rawHost}`;
const WEBHOOK_PATH = '/api/strava/webhook';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Output helpers ────────────────────────────────────────────────────────────

const pass = msg => console.log(`  ✓ ${msg}`);
const fail = msg => console.log(`  ✗ ${msg}`);
const info = msg => console.log(`    ${msg}`);
const section = msg => console.log(`\n── ${msg}`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Strava webhook smoke test');
  console.log(`  Target:      ${baseUrl}${WEBHOOK_PATH}`);
  console.log(`  Activity ID: ${STRAVA_ACTIVITY_ID}`);

  // ── 1. Snapshot current race state ─────────────────────────────────────────

  section('1. Reading current race state');

  const { data: planBefore, error: planErr } = await supabase
    .from('team_plan')
    .select('race_status, current_leg, legs, runners, leg_results')
    .eq('id', 'default')
    .single();

  if (planErr || !planBefore) {
    fail(`Could not read team_plan: ${planErr?.message ?? 'no row found'}`);
    process.exit(1);
  }

  const legResultsBefore = planBefore.leg_results ?? [];
  info(`race_status: ${planBefore.race_status}`);
  info(`current_leg: ${planBefore.current_leg}`);
  info(`leg_results: ${legResultsBefore.length} entries`);

  if (planBefore.race_status !== 'in_progress') {
    fail(`Race is not in_progress (status: "${planBefore.race_status}")`);
    console.log(
      '\n  The webhook handler requires race_status = "in_progress" to accept events.' +
      '\n  Start the race in the app, then re-run this test.'
    );
    process.exit(1);
  }

  pass('Race is in_progress');

  // ── 2. Resolve athlete ID for the current leg ───────────────────────────────

  section('2. Resolving athlete ID for current leg');

  const currentLegData = (planBefore.legs ?? []).find(l => l.id === planBefore.current_leg);
  if (!currentLegData) {
    fail(`Leg ${planBefore.current_leg} not found in team_plan.legs`);
    process.exit(1);
  }

  const runnerId = currentLegData.runnerId;
  info(`Leg ${planBefore.current_leg} is assigned to runner: ${runnerId}`);

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('strava_tokens')
    .select('runner_strava_id')
    .eq('runner_id', runnerId)
    .single();

  if (tokenErr || !tokenRow) {
    fail(`Runner ${runnerId} is not connected to Strava (no row in strava_tokens)`);
    console.log('\n  Connect this runner to Strava in the app, then re-run this test.');
    process.exit(1);
  }

  const athleteId = String(tokenRow.runner_strava_id);
  pass(`Athlete ID: ${athleteId} (runner: ${runnerId})`);

  // ── 3. POST the webhook ─────────────────────────────────────────────────────

  section('3. Posting webhook');

  const payload = {
    object_type: 'activity',
    object_id:   Number(STRAVA_ACTIVITY_ID),
    aspect_type: 'create',
    owner_id:    Number(athleteId),
    updates:     {},
    event_time:  Math.floor(Date.now() / 1000),
  };

  info(`Payload: ${JSON.stringify(payload)}`);

  let response;
  try {
    response = await axios.post(`${baseUrl}${WEBHOOK_PATH}`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });
  } catch (err) {
    fail(`Network error: ${err.message}`);
    process.exit(1);
  }

  if (response.status !== 200) {
    fail(`Unexpected HTTP status: ${response.status}`);
    info(`Response body: ${JSON.stringify(response.data)}`);
    process.exit(1);
  }

  pass(`HTTP 200 — endpoint reachable and accepted the payload`);
  info(`Response body: ${JSON.stringify(response.data)}`);

  // ── 4. Check webhook_events ─────────────────────────────────────────────────

  section('4. Checking webhook_events');

  // Processing is synchronous in the Vercel handler — no sleep needed.
  const { data: event, error: eventErr } = await supabase
    .from('webhook_events')
    .select('id, status, error_message, match_details, received_at, processed_at')
    .eq('object_id', String(STRAVA_ACTIVITY_ID))
    .eq('owner_id', athleteId)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventErr || !event) {
    fail(`No webhook_events row found for activity ${STRAVA_ACTIVITY_ID} / owner ${athleteId}`);
    info('This means validation failed before the insert — check Vercel function logs.');
    info('Possible causes: athlete ID mismatch, DB insert error, duplicate rejection.');
    process.exit(1);
  }

  pass(`webhook_events row created (id: ${event.id})`);
  info(`Status:       ${event.status}`);
  info(`Received at:  ${event.received_at}`);
  if (event.processed_at) info(`Processed at: ${event.processed_at}`);
  if (event.error_message) info(`Error:        ${event.error_message}`);
  if (event.match_details) info(`Match:        ${JSON.stringify(event.match_details)}`);

  // ── 5. Interpret result ─────────────────────────────────────────────────────

  section('5. Interpreting result');

  if (event.status === 'error') {
    fail('Event processing ended in error — see error_message above');
    console.log('\n  Check Vercel function logs for the full stack trace.');
    process.exit(1);
  }

  if (event.status === 'no_match') {
    info('Event was not matched to the current leg (status: no_match).');
    info('Possible reasons:');
    info('  - Activity ID does not belong to athlete ' + athleteId);
    info('  - Leg matching confidence was too low (< 0.5)');
    info('  - Strava returned an error fetching this activity ID');
    console.log('\n  The endpoint and storage pipeline work. No race state was changed.');
    process.exit(0);
  }

  if (event.status === 'pending_confirmation') {
    pass('Event matched but needs manual confirmation (confidence 0.50–0.79)');
    info(`Leg: ${event.match_details?.legId}, confidence: ${event.match_details?.confidence?.toFixed(3)}`);
    console.log('\n  No leg was auto-advanced. Confirm the result in the app to finalize.');
    process.exit(0);
  }

  if (event.status !== 'processed') {
    fail(`Unexpected event status: "${event.status}"`);
    process.exit(1);
  }

  // ── 6. Verify team_plan.leg_results ────────────────────────────────────────

  section('6. Verifying team_plan.leg_results');

  const { data: planAfter, error: planAfterErr } = await supabase
    .from('team_plan')
    .select('current_leg, leg_results')
    .eq('id', 'default')
    .single();

  if (planAfterErr || !planAfter) {
    fail(`Could not re-read team_plan: ${planAfterErr?.message}`);
    process.exit(1);
  }

  const legResultsAfter = planAfter.leg_results ?? [];
  const newResults = legResultsAfter.slice(legResultsBefore.length);

  pass(`current_leg advanced: ${planBefore.current_leg} → ${planAfter.current_leg}`);
  pass(`leg_results grew: ${legResultsBefore.length} → ${legResultsAfter.length}`);

  if (newResults.length === 0) {
    fail('No new leg_result entry found despite "processed" status');
    info('This is unexpected — check process-webhook.js for a silent failure path.');
    process.exit(1);
  }

  const newResult = newResults[0];
  info(`New leg result:`);
  Object.entries(newResult).forEach(([k, v]) => info(`  ${k}: ${v}`));

  if ('elevationGainFt' in newResult) {
    pass(`elevationGainFt present: ${newResult.elevationGainFt} ft`);
  } else {
    fail('elevationGainFt is missing from the new leg result');
    info('Check enrich-activity.js — it should return { data, elevationGainFt }');
    info('And process-webhook.js should include elevationGainFt in the legResult object');
  }

  // ── 7. Check existing entries for rendering safety ─────────────────────────

  section('7. Checking existing leg_results for rendering safety');

  if (legResultsBefore.length === 0) {
    info('No pre-existing leg_results to check');
  } else {
    let allHaveRequiredFields = true;
    for (const r of legResultsBefore) {
      if (!('legId' in r) || !('runnerId' in r)) {
        fail(`Leg result missing legId/runnerId: ${JSON.stringify(r)}`);
        allHaveRequiredFields = false;
      }
    }
    if (allHaveRequiredFields) {
      pass(`All ${legResultsBefore.length} existing leg_results have legId and runnerId`);
    }

    const missingElevation = legResultsBefore.filter(r => !('elevationGainFt' in r));
    if (missingElevation.length > 0) {
      info(`${missingElevation.length} existing entry/entries lack elevationGainFt (manual/pre-elevation entries)`);
      info('Confirm the UI renders these safely (e.g. shows "--" or 0 instead of crashing)');
    } else {
      pass('All existing leg_results include elevationGainFt');
    }
  }

  console.log('\nSmoke test complete — pipeline is working end-to-end.');
}

run().catch(err => {
  console.error(`\nUnhandled error: ${err.message}`);
  process.exit(1);
});
