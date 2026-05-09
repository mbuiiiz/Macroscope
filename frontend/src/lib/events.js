// Event-related constants and helpers shared between App and the GlobeMap view.
// Kept in one file so the source of truth for category colors, asset directions,
// and time formatting lives in a single place.

export const CAT_COLOR = {
  war:      "#FF3B30",
  economy:  "#FFD60A",
  politics: "#0A84FF",
};

export const CAT_BG = {
  war:      "rgba(255,59,48,0.13)",
  economy:  "rgba(255,214,10,0.10)",
  politics: "rgba(10,132,255,0.13)",
};

export const DIR_COLOR = {
  up:   "#30D158",
  down: "#FF3B30",
  flat: "#64748b",
};

export const DIR_ARROW = {
  up:   "▲",
  down: "▼",
  flat: "─",
};

export function timeAgo(ts) {
  const h = Math.floor((Date.now() - new Date(ts)) / 3600000);
  if (h < 1)        return `${Math.floor((Date.now() - new Date(ts)) / 60000)}m ago`;
  if (h < 24)       return `${h}h ago`;
  if (h < 24 * 30)  return `${Math.floor(h / 24)}d ago`;
  if (h < 24 * 365) return `${Math.floor(h / (24 * 30))}mo ago`;
  return `${Math.floor(h / (24 * 365))}y ago`;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    year:         "numeric",
    month:        "long",
    day:          "numeric",
    hour:         "2-digit",
    minute:       "2-digit",
    timeZoneName: "short",
  });
}
