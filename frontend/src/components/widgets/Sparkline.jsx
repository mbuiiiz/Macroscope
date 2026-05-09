import { useRef } from "react";

// Tiny inline SVG line chart with a soft fill gradient under the line.
// Used in the event detail page next to each asset prediction to give a
// rough sense of recent direction. Data is generated synthetically by
// lib/chart.genSpark — replace with real historical prices when wired up.
export default function Sparkline({ data, color = "#0A84FF", w = 100, h = 32 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  // Each Sparkline gets a unique gradient ID so multiple instances on the
  // same page don't share a fill.
  const uid = useRef(`sg${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon  points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${uid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}
