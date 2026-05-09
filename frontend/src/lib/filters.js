// Filter presets and the single source of truth for "is this event visible?".
// Both the home page (for stats and lists) and the GlobeMap (for what to plot)
// must use the same predicate so the UI stays consistent.

export const AGE_FILTERS = [
  { label: "ALL TIME", days: Infinity },
  { label: "TODAY",    days: 1 },
  { label: "7 DAYS",   days: 7 },
  { label: "30 DAYS",  days: 30 },
  { label: "3 MONTHS", days: 90 },
  { label: "1 YEAR",   days: 365 },
];

export const CATEGORIES = ["all", "war", "economy", "politics"];
export const REGIONS    = ["all", "Europe", "Asia", "Americas", "Middle East", "Africa", "Global"];

export function applyFilters(events, { filters, search, bookmarks, showBookmarks }) {
  const cutoff = Date.now() - filters.ageDays * 24 * 60 * 60 * 1000;
  let out = events;
  if (filters.category !== "all") out = out.filter((e) => e.category === filters.category);
  if (filters.region   !== "all") out = out.filter((e) => e.region   === filters.region);
  if (isFinite(filters.ageDays))  out = out.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  if (search) {
    const s = search.toLowerCase();
    out = out.filter((e) => e.country.toLowerCase().includes(s) || e.title.toLowerCase().includes(s));
  }
  if (showBookmarks) out = out.filter((e) => bookmarks.has(e.id));
  return out;
}
