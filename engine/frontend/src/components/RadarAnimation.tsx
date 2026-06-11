interface RadarAnimationProps {
  /** Diameter of the radar in pixels. */
  size?: number;
}

/** Decorative SVG/CSS radar sweep used on the match-searching screen. */
export function RadarAnimation({ size = 240 }: RadarAnimationProps) {
  // TODO: implement (animated radar sweep)
  return (
    <div
      className="relative rounded-full border"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Searching for a match"
    >
      {/* TODO: implement radar sweep + ping rings */}
    </div>
  );
}

export default RadarAnimation;
