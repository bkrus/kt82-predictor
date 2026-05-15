// Pure utility module — no Vercel handler.
// Import from API routes or cron jobs:
//   import { matchActivityToLeg } from "./legMatcher.js";
//   import { haversineDistance, decodePolyline } from "./legMatcher.js";

// ─── Constants ────────────────────────────────────────────────────────

const EARTH_RADIUS_MI       = 3958.8;
const METERS_PER_MILE       = 1609.34;
const DISTANCE_TOLERANCE_MI = 0.5;  // max diff between GPS miles and expected trail miles
const GPS_MAX_MI            = 0.75; // beyond this, the GPS endpoint is not considered a match
const MIN_CONFIDENCE        = 0.7;  // below this → null, requires manual confirmation in UI

// GPS score is computed as a continuous function of distance, scaled to [0, 0.6].
// This is more accurate than the stepped 0.2/0.4/0.6 tiers: a watch started
// 0.19 mi away shouldn't score the same as one started 1 ft away.
//
// Formula: score = max(0, 1 - dist / GPS_MAX_MI) * 0.6
// Both start and end are scored independently. Overall GPS confidence = min(s, e).
// We use min rather than average so one badly-matched endpoint can't hide the other.

function gpsEndpointScore(distMi) {
  return Math.max(0, 1 - distMi / GPS_MAX_MI) * 0.6;
}

// Exchange-point coordinates for all 18 legs, keyed by leg id.
// These are fixed race-day locations — Haversine between start/end of each entry
// gives the straight-line distance, not the winding trail distance.
// ⚠ Do NOT use Haversine(start, end) as the expected leg distance; use leg.distance
//   from the race plan data, which reflects the actual trail mileage.
const LEG_COORDINATES = {
   1: { start: { lat: 38.7252510, lng: -90.4464020 }, end: { lat: 38.7000480, lng: -90.4969530 } },
   2: { start: { lat: 38.7005930, lng: -90.4967690 }, end: { lat: 38.7403840, lng: -90.5239810 } },
   3: { start: { lat: 38.7403240, lng: -90.5240280 }, end: { lat: 38.7156940, lng: -90.5670280 } },
   4: { start: { lat: 38.7156280, lng: -90.5668720 }, end: { lat: 38.6946110, lng: -90.6843340 } },
   5: { start: { lat: 38.6946110, lng: -90.6843340 }, end: { lat: 38.6910800, lng: -90.7242400 } },
   6: { start: { lat: 38.6911130, lng: -90.7243100 }, end: { lat: 38.6601760, lng: -90.7441420 } },
   7: { start: { lat: 38.6599840, lng: -90.7438620 }, end: { lat: 38.6615200, lng: -90.7577500 } },
   8: { start: { lat: 38.6613540, lng: -90.7576320 }, end: { lat: 38.6086740, lng: -90.7947080 } },
   9: { start: { lat: 38.6086740, lng: -90.7947080 }, end: { lat: 38.5778869, lng: -90.8410911 } },
  10: { start: { lat: 38.5778869, lng: -90.8410911 }, end: { lat: 38.5697667, lng: -90.8814778 } },
  11: { start: { lat: 38.5697970, lng: -90.8809790 }, end: { lat: 38.6024810, lng: -90.9990530 } },
  12: { start: { lat: 38.6026390, lng: -90.9991990 }, end: { lat: 38.6270650, lng: -91.0607470 } },
  13: { start: { lat: 38.6086740, lng: -90.7947080 }, end: { lat: 38.6434000, lng: -91.1882730 } },
  14: { start: { lat: 38.6433300, lng: -91.1881580 }, end: { lat: 38.6676130, lng: -91.2544780 } },
  15: { start: { lat: 38.6676130, lng: -91.2544780 }, end: { lat: 38.7251400, lng: -91.3401870 } },
  16: { start: { lat: 38.7251400, lng: -91.3401870 }, end: { lat: 38.7347140, lng: -91.3729420 } },
  17: { start: { lat: 38.7346500, lng: -91.3733570 }, end: { lat: 38.7339280, lng: -91.4442990 } },
  18: { start: { lat: 38.7339280, lng: -91.4442990 }, end: { lat: 38.7038755, lng: -91.4337577 } },
};

// ─── Haversine ────────────────────────────────────────────────────────

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

// ─── Google encoded polyline decoder ─────────────────────────────────
// Returns [[lat, lng], ...] pairs.

export function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 32);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 32);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ─── Route similarity ─────────────────────────────────────────────────
//
// Finds the closest point in the decoded activity polyline to the leg's start
// and end coordinates. Scores 0–1 based on that proximity and whether the path
// traverses in the correct direction. Contributes at most 0.2 * similarity to
// total confidence — supplemental signal, not primary.

export function polylineSimilarity(activityPolyline, legCoord) {
  if (!activityPolyline || !legCoord) return 0;
  let points;
  try { points = decodePolyline(activityPolyline); } catch { return 0; }
  if (points.length < 2) return 0;

  let minStartDist = Infinity, startIdx = 0;
  let minEndDist   = Infinity, endIdx   = 0;

  for (let i = 0; i < points.length; i++) {
    const [lat, lng] = points[i];
    const dS = haversineDistance(lat, lng, legCoord.start.lat, legCoord.start.lng);
    const dE = haversineDistance(lat, lng, legCoord.end.lat,   legCoord.end.lng);
    if (dS < minStartDist) { minStartDist = dS; startIdx = i; }
    if (dE < minEndDist)   { minEndDist   = dE; endIdx   = i; }
  }

  // Route must traverse start → end (not reversed — that would be wrong leg direction).
  const directionMultiplier = startIdx < endIdx ? 1.0 : 0.15;
  const startScore = Math.max(0, 1 - minStartDist / 0.5); // 1.0 at 0 mi, 0 at 0.5 mi
  const endScore   = Math.max(0, 1 - minEndDist   / 0.5);
  return ((startScore + endScore) / 2) * directionMultiplier;
}

// ─── Internal helpers ─────────────────────────────────────────────────

function isValidCoord(lat, lng) {
  return (
    typeof lat === "number" && isFinite(lat) && lat >= -90  && lat <= 90  &&
    typeof lng === "number" && isFinite(lng) && lng >= -180 && lng <= 180
  );
}

function buildResult(c) {
  return {
    legId:       c.legId,
    confidence:  Math.min(1.0, c.confidence),
    matchMethod: c.matchMethod,
    details: {
      distanceMi:         c.distanceMi,
      expectedDistanceMi: c.expectedDistanceMi,
      distanceDiff:       c.distanceDiff,
      gpsStartDist:       c.gpsStartDist  ?? null,
      gpsEndDist:         c.gpsEndDist    ?? null,
      routeSimilarity:    c.routeSimilarity ?? null,
    },
  };
}

// ─── Main export ──────────────────────────────────────────────────────
//
// matchActivityToLeg(activity, runnerId, assignedLegs, teamPlanId)
//
// Confidence is built additively from independent signals:
//   distance  → 0.0–0.3  (trail miles vs expected; uses leg.distance, not Haversine)
//   gps       → 0.0–0.6  (continuous, both endpoints must match)
//   polyline  → 0.0–0.2  (supplemental route path check)
//   ordering  → 0.05     (bonus if this is the "next expected" unsynced leg)
// Min to return: 0.7
//
// For GPS activities, GPS matching is the primary signal. Distance matching
// acts as a pre-filter and confidence addition — not a hard gate — so legs
// with winding trails (where Haversine << actual miles) are not incorrectly
// rejected.

export async function matchActivityToLeg(activity, runnerId, assignedLegs, teamPlanId) {

  // ── Classify the incoming activity ───────────────────────────────────

  const distanceMi     = (activity.distance_m ?? 0) / METERS_PER_MILE;
  const isZeroDistance = (activity.distance_m ?? 0) < 10; // < 10 m → accidental / treadmill

  const hasGPS = isValidCoord(activity.start_lat, activity.start_lng) &&
                 isValidCoord(activity.end_lat,   activity.end_lng);
  const hasPolyline = Boolean(activity.polyline);

  // Sort by race order; prefer unsynced legs.
  const sorted      = [...assignedLegs].sort((a, b) => a.id - b.id);
  const unsynced    = sorted.filter((l) => !l.stravaActivityId);
  const pool        = unsynced.length > 0 ? unsynced : sorted;
  const nextExpectedId = unsynced[0]?.id ?? null;

  if (sorted.length === 0) return null;

  // ── Step 1: Name parsing ──────────────────────────────────────────────
  //
  // "KT82 Leg 7", "leg7", "Leg #07", "LEG 13" → immediate high-confidence match.

  const nameMatch = activity.activity_name?.match(/\bleg\s*#?\s*0*(\d+)\b/i);
  if (nameMatch) {
    const legNum     = parseInt(nameMatch[1], 10);
    const matchedLeg = sorted.find((l) => l.id === legNum);
    if (matchedLeg) {
      return {
        legId:       legNum,
        confidence:  0.95,
        matchMethod: "name_parsing",
        details: {
          distanceMi,
          expectedDistanceMi: matchedLeg.distance ?? null,
          distanceDiff: (matchedLeg.distance != null && !isZeroDistance)
            ? Math.abs(distanceMi - matchedLeg.distance)
            : null,
          gpsStartDist:    null,
          gpsEndDist:      null,
          routeSimilarity: null,
        },
      };
    }
  }

  if (isZeroDistance) return null;

  // ── Step 2: Distance pre-filter ────────────────────────────────────────
  //
  // Compare recorded GPS miles against leg.distance (actual trail miles from
  // the race plan). DO NOT use Haversine(leg.start, leg.end) here — on a winding
  // trail, Haversine gives the crow-flies distance, which is far shorter than
  // what a runner's watch records. This would filter out nearly every real match.
  //
  // distanceScore: 0.3 at exact match, 0.0 at tolerance edge.

  const distanceCandidates = new Map(); // legId → candidate

  for (const leg of pool) {
    const expectedMi = leg.distance;
    if (expectedMi == null) continue;
    const diff = Math.abs(distanceMi - expectedMi);
    if (diff > DISTANCE_TOLERANCE_MI) continue;

    const distanceScore = (1 - diff / DISTANCE_TOLERANCE_MI) * 0.3;
    distanceCandidates.set(leg.id, {
      legId: leg.id, leg,
      distanceMi,
      expectedDistanceMi: expectedMi,
      distanceDiff:       diff,
      distanceScore,
      confidence:         distanceScore,
      matchMethod:        "distance",
      gpsStartDist:       null,
      gpsEndDist:         null,
      routeSimilarity:    0,
    });
  }

  // ── Step 3: GPS refinement ────────────────────────────────────────────
  //
  // GPS matching uses the exchange-point coordinates to validate where the
  // runner started and stopped. This is the strongest signal for this course.
  //
  // Strategy: start with distance candidates; if none (winding trail, watch
  // recorded much more than the crow-flies distance), fall back to GPS-only
  // matching against all pool legs. GPS alone can produce a confident match
  // (max GPS score 0.6 plus polyline boost 0.2 + ordering 0.05 = 0.85).

  if (hasGPS) {
    const gpsPool = distanceCandidates.size > 0
      ? [...distanceCandidates.values()]
      : pool.map((leg) => ({
          legId: leg.id, leg,
          distanceMi,
          expectedDistanceMi: leg.distance ?? null,
          distanceDiff: leg.distance != null ? Math.abs(distanceMi - leg.distance) : null,
          distanceScore: 0,
          confidence:    0,
          matchMethod:   "gps",
          gpsStartDist:  null,
          gpsEndDist:    null,
          routeSimilarity: 0,
        }));

    const gpsCandidates = [];

    for (const candidate of gpsPool) {
      const coord = LEG_COORDINATES[candidate.legId];
      if (!coord) continue;

      const startDist = haversineDistance(
        activity.start_lat, activity.start_lng,
        coord.start.lat,    coord.start.lng
      );
      const endDist = haversineDistance(
        activity.end_lat, activity.end_lng,
        coord.end.lat,    coord.end.lng
      );

      // Both endpoints must be within the hard GPS ceiling.
      if (startDist > GPS_MAX_MI || endDist > GPS_MAX_MI) continue;

      // Continuous GPS score: better proximity → higher score.
      // min() penalizes one-sided mismatches — a great end can't mask a bad start.
      const gpsScore = Math.min(
        gpsEndpointScore(startDist),
        gpsEndpointScore(endDist)
      );

      let routeSimilarity = 0;
      if (hasPolyline) {
        try { routeSimilarity = polylineSimilarity(activity.polyline, coord); } catch {}
      }

      const orderBoost = candidate.legId === nextExpectedId ? 0.05 : 0;

      gpsCandidates.push({
        ...candidate,
        confidence:   candidate.distanceScore + gpsScore + 0.2 * routeSimilarity + orderBoost,
        matchMethod:  "gps",
        gpsStartDist: startDist,
        gpsEndDist:   endDist,
        routeSimilarity,
      });
    }

    if (gpsCandidates.length === 0) return null;

    gpsCandidates.sort((a, b) => b.confidence - a.confidence);
    const top = gpsCandidates[0];
    return top.confidence >= MIN_CONFIDENCE ? buildResult(top) : null;
  }

  // ── Indoor / no GPS: distance-only ───────────────────────────────────
  //
  // Max confidence without GPS: 0.3 (distance) + 0.05 (ordering) = 0.35 —
  // well below 0.7. Indoor activities without a leg name are ambiguous by
  // nature; requiring manual confirmation is the right call.
  //
  // Exception: add the order boost so the UI can present the "most likely"
  // leg as the suggestion, even if we return null (caller can use the
  // details for a confirmation prompt).

  if (distanceCandidates.size === 0) return null;

  const distanceRanked = [...distanceCandidates.values()]
    .map((c) => ({
      ...c,
      confidence: c.distanceScore + (c.legId === nextExpectedId ? 0.05 : 0),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const top = distanceRanked[0];
  return top.confidence >= MIN_CONFIDENCE ? buildResult(top) : null;
}
