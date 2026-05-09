// SEO slug helper.
// Converts an event title like "Fed Holds Rates — No Cut Through Q2"
// into a URL-friendly form: "fed-holds-rates-no-cut-through-q2".
//
// We use these instead of numeric IDs in the URL so that:
//   - Search engines can index human-readable URLs.
//   - Social previews show meaningful slugs.
//   - Sharing a URL implies what the article is about even before loading.
export function slugify(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")  // strip punctuation
    .trim()
    .replace(/\s+/g, "-")           // spaces → hyphens
    .replace(/-+/g, "-")            // collapse runs of hyphens
    .slice(0, 100);                 // hard cap so URLs don't get absurd
}
