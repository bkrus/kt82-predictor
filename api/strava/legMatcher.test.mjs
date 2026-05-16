// Run: node api/strava/legMatcher.test.mjs
import { haversineDistance, decodePolyline, polylineSimilarity, matchActivityToLeg } from './legMatcher.js';

const legs = [
  { id: 1,  runnerId: 'r1', distance: 5.10 },
  { id: 7,  runnerId: 'r1', distance: 5.73 },
  { id: 13, runnerId: 'r1', distance: 6.96 },
];

let pass = 0, fail = 0;
const ok  = (msg) => { console.log('  PASS', msg); pass++; };
const err = (msg) => { console.error('  FAIL', msg); fail++; };

// ── Haversine ────────────────────────────────────────────────────────
const d = haversineDistance(38.7252510, -90.4464020, 38.7000480, -90.4969530);
(d > 3 && d < 5) ? ok(`Haversine leg-1: ${d.toFixed(2)} mi`) : err(`Haversine: ${d}`);
(haversineDistance(0,0,0,0) === 0) ? ok('Same point -> 0') : err('Same point nonzero');

// ── Polyline decoder ─────────────────────────────────────────────────
// Google canonical example: encode([38.5,-120.2]) = "}bdiF~ps|N"
const pts = decodePolyline('}bdiF~ps|N');
(pts.length === 1) ? ok(`Decoded 1 point`) : err(`Expected 1 point, got ${pts.length}`);
(Math.abs(pts[0][0]-38.5)<1e-4)   ? ok(`Lat: ${pts[0][0]}`) : err(`Lat wrong: ${pts[0][0]}`);
(Math.abs(pts[0][1]+120.2)<1e-4)  ? ok(`Lng: ${pts[0][1]}`) : err(`Lng wrong: ${pts[0][1]}`);
(decodePolyline('').length === 0) ? ok('Empty -> []') : err('Empty not []');

// ── polylineSimilarity edge cases ────────────────────────────────────
(polylineSimilarity(null, null) === 0) ? ok('null polyline -> 0') : err('null polyline nonzero');
(polylineSimilarity('', {}) === 0)     ? ok('empty string -> 0')  : err('empty string nonzero');

// ── Name parsing ─────────────────────────────────────────────────────
const nameCases = [
  ['KT82 Leg 7', 7], ['leg7', 7], ['Leg #07', 7], ['LEG 13', 13], ['trail leg 1', 1],
];
for (const [name, id] of nameCases) {
  const m = await matchActivityToLeg(
    { activity_name: name, distance_m: 5000, start_lat: null, start_lng: null, end_lat: null, end_lng: null, polyline: null },
    'r1', legs, 'p1'
  );
  (m?.legId === id && m?.matchMethod === 'name_parsing')
    ? ok(`"${name}" -> leg ${id} (conf=${m.confidence})`)
    : err(`"${name}": expected leg ${id}, got ${JSON.stringify(m)}`);
}

// Leg not assigned to runner -> name falls through, doesn't crash
const mUnassigned = await matchActivityToLeg(
  { activity_name: 'Leg 4', distance_m: 9220, start_lat: null, start_lng: null, end_lat: null, end_lng: null, polyline: null },
  'r1', legs, 'p1'
);
(mUnassigned?.matchMethod !== 'name_parsing') ? ok('"Leg 4" not assigned to r1 -> falls through') : err('"Leg 4" wrongly name-matched to r1');

// ── GPS exact match ──────────────────────────────────────────────────
const gpsPerfect = await matchActivityToLeg(
  { activity_name: 'Run', distance_m: 9220, start_lat: 38.659984, start_lng: -90.743862, end_lat: 38.661520, end_lng: -90.757750, polyline: null },
  'r1', legs, 'p1'
);
(gpsPerfect?.legId === 7 && gpsPerfect?.matchMethod === 'gps') ? ok(`GPS exact -> leg 7 conf=${gpsPerfect.confidence.toFixed(3)}`) : err(`GPS exact: ${JSON.stringify(gpsPerfect)}`);
(gpsPerfect?.confidence >= 0.7) ? ok(`GPS conf ${gpsPerfect?.confidence?.toFixed(3)} >= 0.7`) : err(`GPS conf too low: ${gpsPerfect?.confidence}`);
console.log(`    start dist: ${gpsPerfect?.details?.gpsStartDist?.toFixed(4)} mi, end dist: ${gpsPerfect?.details?.gpsEndDist?.toFixed(4)} mi`);

// GPS with ~0.1mi slop at each endpoint (watch started a block from exchange)
const gpsSlop = await matchActivityToLeg(
  { activity_name: 'Run', distance_m: 9220, start_lat: 38.6605, start_lng: -90.7448, end_lat: 38.6612, end_lng: -90.7581, polyline: null },
  'r1', legs, 'p1'
);
(gpsSlop?.legId === 7) ? ok(`GPS slop -> leg 7 conf=${gpsSlop.confidence.toFixed(3)}`) : err(`GPS slop: ${JSON.stringify(gpsSlop)}`);

// ── Indoor / no GPS → always null without name ───────────────────────
// Max possible confidence = distanceScore(0.3) + orderBoost(0.05) = 0.35 < 0.7
const indoor = await matchActivityToLeg(
  { activity_name: 'Treadmill', distance_m: 9220, start_lat: null, start_lng: null, end_lat: null, end_lng: null, polyline: null },
  'r1', legs, 'p1'
);
(indoor === null) ? ok('Indoor no-name -> null (max conf 0.35 < threshold 0.7)') : err(`Indoor: expected null, got ${JSON.stringify(indoor)}`);

// ── GPS way off → null ───────────────────────────────────────────────
const gpsFar = await matchActivityToLeg(
  { activity_name: 'Run', distance_m: 9220, start_lat: 39.9, start_lng: -91.5, end_lat: 39.8, end_lng: -91.6, polyline: null },
  'r1', legs, 'p1'
);
(gpsFar === null) ? ok('GPS >GPS_MAX_MI from any leg -> null') : err(`GPS far: ${JSON.stringify(gpsFar)}`);

// ── Zero distance, no name → null ───────────────────────────────────
const zero = await matchActivityToLeg(
  { activity_name: 'Oops', distance_m: 5, start_lat: null, start_lng: null, end_lat: null, end_lng: null, polyline: null },
  'r1', legs, 'p1'
);
(zero === null) ? ok('Zero distance -> null') : err(`Zero: ${JSON.stringify(zero)}`);

// ── Empty legs → null ────────────────────────────────────────────────
const noLegs = await matchActivityToLeg(
  { activity_name: 'Run', distance_m: 8000, start_lat: null, start_lng: null, end_lat: null, end_lng: null, polyline: null },
  'r2', [], 'p1'
);
(noLegs === null) ? ok('Empty legs -> null') : err('Empty legs: expected null');

// ── Synced leg avoided; unsynced preferred ───────────────────────────
const mixedLegs = [
  { id: 1,  runnerId: 'r1', distance: 5.10, stravaActivityId: 99 }, // already synced
  { id: 7,  runnerId: 'r1', distance: 5.73 },
  { id: 13, runnerId: 'r1', distance: 6.96 },
];
const syncedPref = await matchActivityToLeg(
  { activity_name: 'Run', distance_m: 9220, start_lat: 38.659984, start_lng: -90.743862, end_lat: 38.661520, end_lng: -90.757750, polyline: null },
  'r1', mixedLegs, 'p1'
);
(syncedPref?.legId === 7) ? ok(`Prefers unsynced leg 7 over synced leg 1`) : err(`Synced preference: ${JSON.stringify(syncedPref)}`);

console.log(`\n${pass} passed  ${fail} failed`);
process.exit(fail ? 1 : 0);
