import type { CSSProperties } from "react";

export function Spinner({ size = 16 }: { size?: number }) {
  const trackWidth = Math.max(2, Math.round(size / 7));

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    verticalAlign: "middle",
    flexShrink: 0,
  };

  const svgStyle: CSSProperties = {
    animation: "spinnerRotate 0.9s linear infinite",
  };

  const trackStyle: CSSProperties = {
    fill: "none",
    stroke: "rgba(255,255,255,0.25)",
    strokeWidth: trackWidth,
  };

  const arcStyle: CSSProperties = {
    fill: "none",
    stroke: "#ffffff",
    strokeWidth: trackWidth,
    strokeLinecap: "round",
    strokeDasharray: `${size * 1.8} ${size * 4}`,
    strokeDashoffset: 0,
  };

  const r = (size - trackWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <span style={containerStyle}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={svgStyle}>
        <circle cx={cx} cy={cy} r={r} style={trackStyle} />
        <circle cx={cx} cy={cy} r={r} style={arcStyle} />
      </svg>
    </span>
  );
}

export default Spinner;