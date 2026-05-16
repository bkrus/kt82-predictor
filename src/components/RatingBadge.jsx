import { RATING_BADGE } from "../styles";

export function RatingBadge({ rating }) {
  const cfg = RATING_BADGE[rating];
  if (!cfg) return null;
  return (
    <span style={cfg.style}>
      {cfg.icons.map((ic, i) => <span key={i}>{ic}</span>)}
      <span>{cfg.label}</span>
    </span>
  );
}
