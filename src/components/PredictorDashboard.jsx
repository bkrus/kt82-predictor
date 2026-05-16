import { RatingBadge } from "./RatingBadge";
import { formatTime, formatTime12Hour, exchangeLocation } from "../utils";
import { S } from "../styles";

export function PredictorDashboard({ currentLeg, calculatedLegs, runnerMap, nextExchangeLocation, exchangeETA, timeToExchange, upcomingLegs, countdownUrgency }) {
  return (
    <div className="kt82-race-active" style={S.raceDashboard}>
      <div style={S.raceDashboardHeader}>
        <span style={S.raceDashboardHeaderLabel}>🏃 Race in progress</span>
        <span style={S.raceDashboardHeaderMeta}>Leg {currentLeg.id} of {calculatedLegs.length}</span>
      </div>
      <div style={S.raceHeroBody}>
        <div className="kt82-hero-top" style={S.raceHeroTop}>
          <div style={S.raceHeroRunnerBlock}>
            <span style={S.heroMicroLabelLight}>Currently running</span>
            <span style={S.heroRunnerName}>{runnerMap[currentLeg.runnerId]?.name ?? "Unknown"}</span>
            <div style={S.heroLegLine}>
              <span style={S.heroLegText}>Leg {currentLeg.id} · {currentLeg.distance} mi</span>
              <RatingBadge rating={currentLeg.rating} />
            </div>
          </div>
          <div className="kt82-countdown-block" style={S.countdownBlock}>
            <span style={S.countdownLabel}>Time to exchange</span>
            <span style={S.countdownValue}>{formatTime(timeToExchange)}</span>
          </div>
        </div>
        <div style={{ ...S.exchangeRow, background: countdownUrgency.bg, borderColor: countdownUrgency.border }}>
          <div style={S.exchangeLocationBlock}>
            <span style={S.heroMicroLabelLight}>Next exchange</span>
            <span style={S.exchangeLocationName}>{nextExchangeLocation}</span>
          </div>
          <div style={S.exchangeETABlock}>
            <span style={S.heroMicroLabelLight}>ETA</span>
            <span style={S.exchangeETAValue}>{exchangeETA}</span>
          </div>
        </div>
      </div>
      {upcomingLegs.length > 0 && (
        <div style={S.upcomingSection}>
          <span style={S.upcomingSectionLabel}>Upcoming exchanges</span>
          {upcomingLegs.map((leg) => (
            <div key={leg.id} className="kt82-upcoming-row" style={S.upcomingRow}>
              <span style={S.upcomingLegNum}>Leg {leg.id}</span>
              <span style={S.upcomingRunner}>{runnerMap[leg.runnerId]?.name ?? "—"}</span>
              <span style={S.upcomingArrow}>→</span>
              <span style={S.upcomingExchangeName}>{exchangeLocation(leg.name)}</span>
              <span style={S.upcomingETA}>{formatTime12Hour(leg.endSeconds)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
