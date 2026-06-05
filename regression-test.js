#!/usr/bin/env node
/**
 * Regression smoke test — run after any change to verify the app is not broken.
 *
 * WHAT THIS PROVES
 *   1. npm run build compiles cleanly (catches JSX/import errors in all source files)
 *   2. Supabase is reachable and team_plan has the expected JSONB shape
 *   3. Report calculations are correct with three leg_result entry shapes:
 *      (a) elevationGainFt present (Strava-sourced leg)
 *      (b) elevationGainFt key missing entirely (pre-elevation manual entry)
 *      (c) elevationGainFt = 0 (manual button-tap entry)
 *   4. Mountain Goat is suppressed when all elevation values are 0 or missing
 *   5. Mountain Goat is shown when at least one entry has elevationGainFt > 0
 *   6. totalElevationFt sums correctly with the ?? 0 fallback
 *   7. Fastest/slowest/longest leg reduce handles single-entry and empty arrays
 *   8. Best prediction handles a legId absent from calculatedLegs
 *   9. handleSaveLegEdit cascade correctly recomputes downstream leg times
 *  10. paceToDisplay returns "—" (not NaN) when distance = 0
 *
 * WHAT THIS DOES NOT PROVE
 *   - React rendering or visual correctness (no DOM, no browser)
 *   - That PostRaceReport opens without crashing in a real browser
 *     → verify with: npm run dev, then open the app and complete a race
 *   - That manual_entries writes persist to Supabase
 *     → verify by editing a leg time in the app and checking the row in Supabase
 *   - Strava webhook pipeline (webhook-test.js covers that)
 *
 * SUPABASE
 *   Reads team_plan once (read-only). No writes. No race state is mutated.
 *
 * REQUIRED ENV VARS
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * USAGE
 *   node regression-test.js
 */

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'child_process';
import { config } from 'dotenv';
import { paceToDisplay, formatTime } from './src/utils.js';
import {
  calcFastestLeg, calcSlowestLeg, calcLongestLeg, calcMountainGoatLeg,
  calcTotalElapsedSec, calcTotalDist,
  calcTotalElevationFt, calcBestPrediction, shouldShowMountainGoat,
  applyLegEditCascade,
} from './src/reportCalcs.js';

config({ path: '.env.local' });

// ── Env validation ────────────────────────────────────────────────────────────

const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Minimal test framework ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

function assertEq(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}  (got: ${JSON.stringify(actual)}, want: ${JSON.stringify(expected)})`);
    failed++;
  }
}

const section = msg => console.log(`\n── ${msg}`);

// Aliases for brevity in assertions — all point to the actual production functions.
const calcFastest    = calcFastestLeg;
const calcSlowest    = calcSlowestLeg;
const calcLongest    = calcLongestLeg;
const calcGoat       = calcMountainGoatLeg;
const calcTotalSec   = calcTotalElapsedSec;
const calcTotalMi    = calcTotalDist;
const calcTotalElevFt = calcTotalElevationFt;
const calcBestPred   = calcBestPrediction;
const showGoat       = shouldShowMountainGoat;
const applyCascade   = applyLegEditCascade;

// ── Step 1: Build ─────────────────────────────────────────────────────────────

section('1. npm run build');

const buildResult = spawnSync('npm', ['run', 'build'], { encoding: 'utf8', cwd: process.cwd() });
if (buildResult.status === 0) {
  assert(true, 'Build succeeded');
} else {
  assert(false, 'Build failed');
  console.log(buildResult.stderr?.slice(-1000) ?? buildResult.stdout?.slice(-1000));
  console.log('\nFix the build error before continuing — remaining tests may not reflect the broken state.');
  failed++;
}

// ── Step 2: Supabase read-only check ─────────────────────────────────────────

section('2. Supabase — read team_plan (read-only, no writes)');

const { data: plan, error: planErr } = await supabase
  .from('team_plan')
  .select('race_status, current_leg, legs, runners, leg_results')
  .eq('id', 'default')
  .single();

if (planErr || !plan) {
  assert(false, `team_plan query failed: ${planErr?.message ?? 'no row'}`);
  console.log('\n  Cannot continue Supabase checks — verify VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
} else {
  assert(true, 'Connected to Supabase and read team_plan');
  assert(Array.isArray(plan.legs),        'team_plan.legs is an array');
  assert(Array.isArray(plan.runners),     'team_plan.runners is an array');
  assert(Array.isArray(plan.leg_results), 'team_plan.leg_results is an array');
  assert(['idle','in_progress','completed'].includes(plan.race_status), `race_status is a known value ("${plan.race_status}")`);
  assert(typeof plan.current_leg === 'number', `current_leg is a number (${plan.current_leg})`);

  // Verify no leg_result crashes the calculations when run against live data
  if (plan.leg_results.length > 0) {
    try {
      const liveElev = calcTotalElevFt(plan.leg_results);
      const liveGoat = calcGoat(plan.leg_results);
      assert(typeof liveElev === 'number' && !isNaN(liveElev),
        `Live leg_results: totalElevationFt is a number (${liveElev} ft)`);
      assert(true, `Live leg_results: mountain goat calc did not throw (legId: ${liveGoat?.legId ?? 'none'})`);
    } catch (e) {
      assert(false, `Live leg_results crashed a calculation: ${e.message}`);
    }
  } else {
    console.log('    (No leg_results in live data — skipping live-data calc check)');
  }
}

// ── Step 3: Calculation unit tests ────────────────────────────────────────────

const T = 1749600000000; // fixed timestamp — arbitrary race start

// Shared calculatedLegs for prediction tests
const CALC_LEGS = [
  { id: 1, time: 1800,  distance: 5.2 },
  { id: 2, time: 2400,  distance: 6.1 },
  { id: 3, time: 1440,  distance: 3.0 },
  { id: 4, time: 3240,  distance: 8.0 },
];

// ── Scenario A: Mixed elevation ───────────────────────────────────────────────

section('3a. Mixed elevation (some present, some missing, some = 0)');

const mixedResults = [
  { legId: 1, runnerId: 'r1', elapsedSeconds: 1800, distance: 5.2, actualPace: 1800/60/5.2, elevationGainFt: 450, startTime: T,           endTime: T+1800000 },
  { legId: 2, runnerId: 'r2', elapsedSeconds: 2400, distance: 6.1, actualPace: 2400/60/6.1,                         startTime: T+1800000, endTime: T+4200000 },  // key absent
  { legId: 3, runnerId: 'r1', elapsedSeconds: 1200, distance: 3.0, actualPace: 1200/60/3.0, elevationGainFt: 0,    startTime: T+4200000, endTime: T+5400000 },  // explicit 0
  { legId: 4, runnerId: 'r3', elapsedSeconds: 3600, distance: 8.0, actualPace: 3600/60/8.0, elevationGainFt: 200,  startTime: T+5400000, endTime: T+9000000 },
];

assertEq(calcTotalElevFt(mixedResults), 650,  'totalElevationFt = 450 + 0(missing) + 0 + 200 = 650');
assertEq(calcGoat(mixedResults)?.legId, 1,    'mountainGoatLeg is leg 1 (450 ft)');
assert(showGoat(calcGoat(mixedResults)),       'Mountain Goat is shown (elevationGainFt > 0)');
assertEq(calcFastest(mixedResults)?.legId, 1, 'Fastest leg is leg 1 (lowest actualPace)');
assertEq(calcSlowest(mixedResults)?.legId, 4, 'Slowest leg is leg 4 (highest actualPace)');
assertEq(calcLongest(mixedResults)?.legId, 4, 'Longest leg is leg 4 (8.0 mi)');
assertEq(calcTotalSec(mixedResults), 9000,    'totalElapsedSec = 1800+2400+1200+3600 = 9000');
assert(Math.abs(calcTotalMi(mixedResults) - 22.3) < 0.001, 'totalDist ≈ 22.3 mi');

// ── Scenario B: All elevation = 0 or missing — Mountain Goat hidden ───────────

section('3b. All elevation zero/missing — Mountain Goat must be hidden');

const noElevResults = [
  { legId: 1, runnerId: 'r1', elapsedSeconds: 1800, distance: 5.0, actualPace: 6.0, elevationGainFt: 0 },
  { legId: 2, runnerId: 'r2', elapsedSeconds: 2400, distance: 6.0, actualPace: 6.67 },                    // key absent
  { legId: 3, runnerId: 'r1', elapsedSeconds: 1200, distance: 3.0, actualPace: 6.67, elevationGainFt: 0 },
];

assertEq(calcTotalElevFt(noElevResults), 0,   'totalElevationFt = 0 when all missing/zero');
assert(!showGoat(calcGoat(noElevResults)),     'Mountain Goat is NOT shown when all elevation = 0');
assert(calcGoat(noElevResults) !== undefined,  'mountainGoatLeg calc does not throw with all-zero elevation');

// ── Scenario C: Single leg ────────────────────────────────────────────────────

section('3c. Single leg — no reduce crash');

const singleResult = [
  { legId: 1, runnerId: 'r1', elapsedSeconds: 1800, distance: 5.0, actualPace: 6.0, elevationGainFt: 300 },
];

assert(calcFastest(singleResult) !== null,  'Fastest leg: no crash with single entry');
assert(calcSlowest(singleResult) !== null,  'Slowest leg: no crash with single entry');
assert(calcLongest(singleResult) !== null,  'Longest leg: no crash with single entry');
assert(calcGoat(singleResult) !== null,     'Mountain Goat: no crash with single entry');
assert(showGoat(calcGoat(singleResult)),    'Mountain Goat shown for single entry with elevation > 0');
assertEq(calcTotalSec(singleResult), 1800,  'totalElapsedSec correct for single entry');
assertEq(calcTotalMi(singleResult), 5.0,    'totalDist correct for single entry');

// ── Scenario D: Empty leg_results ─────────────────────────────────────────────

section('3d. Empty leg_results — no crash');

const empty = [];

assert(calcFastest(empty) === null,        'Fastest leg: null for empty array');
assert(calcSlowest(empty) === null,        'Slowest leg: null for empty array');
assert(calcLongest(empty) === null,        'Longest leg: null for empty array');
assert(calcGoat(empty) === null,           'Mountain Goat: null for empty array');
assert(!showGoat(null),                    'Mountain Goat not shown when null');
assertEq(calcTotalSec(empty), 0,           'totalElapsedSec = 0 for empty array');
assertEq(calcTotalMi(empty), 0,            'totalDist = 0 for empty array');
assertEq(calcTotalElevFt(empty), 0,        'totalElevationFt = 0 for empty array');

// ── Scenario E: Best prediction ───────────────────────────────────────────────

section('3e. Best prediction calculation');

const predResults = [
  { legId: 1, elapsedSeconds: 1850 },  // off by 50 sec vs predicted 1800
  { legId: 2, elapsedSeconds: 2430 },  // off by 30 sec vs predicted 2400
];
const bestNormal = calcBestPred(predResults, CALC_LEGS);
assertEq(bestNormal?.legId, 2,   'Best prediction is leg 2 (30 sec off vs 50 sec)');
assert(typeof bestNormal?.accuracy === 'number', 'Best prediction accuracy is a number');

// Missing legId in calculatedLegs — should not throw
const missingLegResult = [{ legId: 99, elapsedSeconds: 1800 }];
let missingLegBest;
let missingThrew = false;
try {
  missingLegBest = calcBestPred(missingLegResult, CALC_LEGS);
} catch {
  missingThrew = true;
}
assert(!missingThrew, 'Best prediction: no throw when legId not in calculatedLegs');
assertEq(missingLegBest?.accuracy, 1800, 'Best prediction: accuracy = |0 - 1800| when leg not found (cl?.time ?? 0)');

// Empty results
assert(calcBestPred([], CALC_LEGS) === null, 'Best prediction: null for empty results');

// ── Scenario F: handleSaveLegEdit cascade ─────────────────────────────────────

section('3f. Leg edit cascade — forward propagation');

const legsBefore = [
  { legId: 1, runnerId: 'r1', startTime: T,           endTime: T+1800000, elapsedSeconds: 1800, actualPace: 1800/60/5.0, distance: 5.0, runnerName: 'Alice', runnerStravaId: null },
  { legId: 2, runnerId: 'r2', startTime: T+1800000,   endTime: T+4200000, elapsedSeconds: 2400, actualPace: 2400/60/6.0, distance: 6.0, runnerName: 'Bob',   runnerStravaId: null },
  { legId: 3, runnerId: 'r1', startTime: T+4200000,   endTime: T+5700000, elapsedSeconds: 1500, actualPace: 1500/60/4.0, distance: 4.0, runnerName: 'Alice', runnerStravaId: null },
];

// Edit leg 1: same start, end moved 100 sec later (runner was slower)
const newEnd = T + 1900000;
const cascaded = applyCascade(legsBefore, 0, T, newEnd);

assertEq(cascaded[0].elapsedSeconds, 1900,        'Leg 1: elapsedSeconds updated to 1900');
assertEq(cascaded[0].endTime, T + 1900000,         'Leg 1: endTime updated');
assertEq(cascaded[1].startTime, T + 1900000,       'Leg 2: startTime cascade-updated to leg 1 endTime');
assertEq(cascaded[1].endTime, T + 4200000,         'Leg 2: endTime unchanged (not touched by cascade)');
assertEq(cascaded[1].elapsedSeconds, 2300,         'Leg 2: elapsedSeconds = 2300 after cascade');
assertEq(cascaded[2].startTime, T + 4200000,       'Leg 3: startTime unchanged (leg 2 endTime unchanged)');
assertEq(cascaded[2].elapsedSeconds, 1500,         'Leg 3: elapsedSeconds unchanged');
assert(typeof cascaded[0].editedAt === 'string',   'editedAt is set as ISO string');

section('3f-2. Leg edit cascade — backward propagation (edit leg 2 start)');

// Edit leg 2: push start time 100 sec later → leg 1 end time should shorten
const cascaded2 = applyCascade(legsBefore, 1, T + 1900000, T + 4200000);
assertEq(cascaded2[0].endTime, T + 1900000,        'Leg 1: endTime updated via backward cascade');
assertEq(cascaded2[0].elapsedSeconds, 1900,        'Leg 1: elapsedSeconds recomputed via backward cascade');
assertEq(cascaded2[1].startTime, T + 1900000,      'Leg 2: startTime = edited value');
assertEq(cascaded2[1].elapsedSeconds, 2300,        'Leg 2: elapsedSeconds recomputed');

// ── Scenario G: paceToDisplay edge cases ──────────────────────────────────────

section('3g. paceToDisplay edge cases');

assertEq(paceToDisplay(3600, 6),     '10:00',  'paceToDisplay(3600, 6) = "10:00"');
assertEq(paceToDisplay(1800, 5),     '6:00',   'paceToDisplay(1800, 5) = "6:00"');
assertEq(paceToDisplay(0, 0),        '—',      'paceToDisplay(0, 0) = "—" (no divide-by-zero)');
assertEq(paceToDisplay(1800, null),  '—',      'paceToDisplay with null distance = "—"');
assertEq(paceToDisplay(1800, 0),     '—',      'paceToDisplay with 0 distance = "—"');

// formatTime edge cases used in report
assertEq(formatTime(0),    '0:00',      'formatTime(0) = "0:00"');
assertEq(formatTime(3600), '1:00:00',   'formatTime(3600) = "1:00:00"');
assertEq(formatTime(5432), '1:30:32',   'formatTime(5432) = "1:30:32"');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed > 0) {
  console.log('\nSome checks failed — review the ✗ lines above before shipping.');
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
}
