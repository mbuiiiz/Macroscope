import { useEffect, useMemo } from "react";
import AISummary from "../components/widgets/AISummary";
import Sparkline  from "../components/widgets/Sparkline";
import { CAT_COLOR, DIR_COLOR, DIR_ARROW, timeAgo, formatDate } from "../lib/events";
import { genSpark } from "../lib/chart";
import { slugify }  from "../lib/slug";

// Full-page article view for a single event. Used for SEO — recruiters,
// search engines, and social-share previews land here. Heavy lifting:
//   1) Inject a complete set of meta tags (description, Open Graph,
//      Twitter Card, canonical, JSON-LD).
//   2) Restore previous meta values on unmount so navigating back to the
//      home page doesn't leave article-specific tags behind.
//
// Props:
//   event           — the event to render (already resolved by the router)
//   onBack          — handler for the back button
//   bookmarks       — Set<eventId>
//   toggleBookmark  — (id) => void
export default function EventDetailPage({ event, onBack, bookmarks, toggleBookmark }) {
  const col = CAT_COLOR[event.category];
  const slug = slugify(event.title);
  const canonicalUrl = `https://macroscope.io/event/${slug}`;

  // Pre-compute a sparkline for each asset prediction. Tied to event.id so
  // the random walk is stable across re-renders within the same event.
  const spark = useMemo(
    () => event.assets.map((a) => genSpark(a.direction === "up" ? 1 : a.direction === "down" ? -1 : 0)),
    [event.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── SEO meta tag injection ───────────────────────────────────────
  useEffect(() => {
    const prev = {
      title:     document.title,
      desc:      document.querySelector('meta[name="description"]')?.content,
      ogTitle:   document.querySelector('meta[property="og:title"]')?.content,
      ogDesc:    document.querySelector('meta[property="og:description"]')?.content,
      ogUrl:     document.querySelector('meta[property="og:url"]')?.content,
      twTitle:   document.querySelector('meta[name="twitter:title"]')?.content,
      twDesc:    document.querySelector('meta[name="twitter:description"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
    };

    const description = `${event.summary} Market impact: ${event.impact_summary || ""} — MacroScope geopolitical intelligence.`.slice(0, 160);
    const keywords = [event.country, event.region, event.category, ...(event.tags || []), "geopolitical", "market impact", "forex", "commodities"].join(", ");

    document.title = `${event.title} | ${event.country} ${event.category} | MacroScope`;

    const setMeta = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    const setLink = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("link"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };

    setMeta('meta[name="description"]',                "content", description);
    setMeta('meta[name="keywords"]',                   "content", keywords);
    setMeta('meta[name="robots"]',                     "content", "index, follow");
    setMeta('meta[property="og:type"]',                "content", "article");
    setMeta('meta[property="og:title"]',               "content", event.title);
    setMeta('meta[property="og:description"]',         "content", description);
    setMeta('meta[property="og:url"]',                 "content", canonicalUrl);
    setMeta('meta[property="og:site_name"]',           "content", "MacroScope");
    setMeta('meta[property="article:section"]',        "content", event.category);
    setMeta('meta[property="article:tag"]',            "content", (event.tags || []).join(", "));
    setMeta('meta[property="article:published_time"]', "content", event.timestamp);
    setMeta('meta[name="twitter:card"]',               "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]',              "content", event.title);
    setMeta('meta[name="twitter:description"]',        "content", description);
    setMeta('meta[name="twitter:site"]',               "content", "@MacroScope_io");
    setLink('link[rel="canonical"]',                   "href",    canonicalUrl);

    // JSON-LD structured data — schema.org NewsArticle. Helps Google
    // index the page as news rather than a generic web page.
    const ldScript = document.createElement("script");
    ldScript.type        = "application/ld+json";
    ldScript.id          = "macroscope-ld";
    ldScript.textContent = JSON.stringify({
      "@context":         "https://schema.org",
      "@type":            "NewsArticle",
      "headline":         event.title,
      "description":      description,
      "datePublished":    event.timestamp,
      "dateModified":     event.timestamp,
      "author":           { "@type": "Organization", "name": event.source_name || "MacroScope" },
      "publisher":        { "@type": "Organization", "name": "MacroScope", "url": "https://macroscope.io" },
      "mainEntityOfPage": { "@type": "WebPage",      "@id":  canonicalUrl },
      "about":            { "@type": "Place",        "name": event.country },
      "keywords":         keywords,
      "articleSection":   event.category,
      "url":              canonicalUrl,
    });
    document.head.appendChild(ldScript);

    return () => {
      // Restore the previous meta on unmount so other pages render correctly.
      document.title = prev.title;
      if (prev.desc)      document.querySelector('meta[name="description"]')      ?.setAttribute("content", prev.desc);
      if (prev.ogTitle)   document.querySelector('meta[property="og:title"]')      ?.setAttribute("content", prev.ogTitle);
      if (prev.ogDesc)    document.querySelector('meta[property="og:description"]')?.setAttribute("content", prev.ogDesc);
      if (prev.ogUrl)     document.querySelector('meta[property="og:url"]')        ?.setAttribute("content", prev.ogUrl);
      if (prev.canonical) document.querySelector('link[rel="canonical"]')          ?.setAttribute("href",    prev.canonical);
      document.getElementById("macroscope-ld")?.remove();
    };
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: "100vh", background: "#030912", color: "#e2e8f0", fontFamily: "'DM Sans',sans-serif" }}>
      {/* ── Top nav ──────────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(3,9,18,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "6px 14px", color: "#64748b", cursor: "pointer", fontSize: 11, fontFamily: "'Space Mono',monospace", letterSpacing: 1, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
            <span style={{ fontSize: 14 }}>←</span> BACK TO MAP
          </button>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,rgba(10,132,255,0.14),rgba(10,132,255,0.05))", border: "1px solid rgba(10,132,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🌐</div>
            <span style={{ fontSize: 13, fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#f1f5f9" }}>MACRO<span style={{ color: "#0A84FF" }}>SCOPE</span></span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: col, boxShadow: `0 0 5px ${col}` }} />
            <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: 1 }}>macroscope.io/event/{slug}</span>
          </div>
          <button onClick={() => toggleBookmark(event.id)} style={{ background: "none", border: "none", cursor: "pointer", color: bookmarks.has(event.id) ? "#FFD60A" : "#334155", fontSize: 18, padding: 4, transition: "color 0.15s" }}>★</button>
        </div>
      </div>

      {/* ── Top leaderboard ad ───────────────────────────────────────── */}
      <div style={{ background: "rgba(4,9,20,0.8)", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "center", padding: "10px 0" }}>
        <div style={{ width: "min(970px,94%)", height: 90, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "rgba(255,255,255,0.007)" }}>
          <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
          <div style={{ fontSize: 11, color: "#0f172a", fontFamily: "monospace", fontWeight: 500 }}>970 × 90 — LEADERBOARD AD</div>
          <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1 }}>ADSENSE / DFP SLOT — DETAIL PAGE TOP</div>
        </div>
      </div>

      {/* ── Page body ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px", animation: "msPageIn 0.32s cubic-bezier(0.16,1,0.3,1)" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 10, fontFamily: "monospace", color: "#334155" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 10, fontFamily: "monospace", padding: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#94a3b8"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#334155"}>HOME</button>
          <span>/</span>
          <span style={{ color: "#475569", textTransform: "uppercase", letterSpacing: 1 }}>{event.region}</span>
          <span>/</span>
          <span style={{ color: col, textTransform: "uppercase", letterSpacing: 1 }}>{event.category}</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block", boxShadow: `0 0 10px ${col}` }} />
            <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", color: col, letterSpacing: 3, textTransform: "uppercase" }}>{event.category}</span>
            <span style={{ fontSize: 9, color: "#1e293b" }}>·</span>
            <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", color: "#475569", letterSpacing: 1 }}>{event.region}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155", fontFamily: "monospace" }}>{formatDate(event.timestamp)}</span>
          </div>
          <h1 style={{ margin: "0 0 14px", fontSize: 32, fontFamily: "'DM Serif Display',Georgia,serif", color: "#f1f5f9", lineHeight: 1.25, fontWeight: 400 }}>{event.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>📍</span>
            <span style={{ fontSize: 13, color: "#475569", fontFamily: "'Space Mono',monospace" }}>{event.country}</span>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "2px 9px", color: "#334155", fontFamily: "monospace" }}>{timeAgo(event.timestamp)}</span>
          </div>
        </div>

        {/* 3-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 24, alignItems: "start" }}>
          {/* COL 1 — summary + AI */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "22px" }}>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#334155", letterSpacing: 2, marginBottom: 14 }}>EVENT SUMMARY</div>
              <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.85 }}>{event.summary}</p>
            </div>
            <div style={{ height: 250, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "rgba(255,255,255,0.006)" }}>
              <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
              <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>300 × 250</div>
              <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1, textAlign: "center" }}>ADSENSE<br/>MID-CONTENT</div>
            </div>
            <div style={{ background: "linear-gradient(135deg,rgba(10,132,255,0.05),rgba(10,132,255,0.02))", border: "1px solid rgba(10,132,255,0.18)", borderRadius: 12, padding: "22px" }}>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#0A84FF", letterSpacing: 2, marginBottom: 14 }}>AI DEEP ANALYSIS</div>
              <AISummary event={event} />
            </div>
            <div style={{ height: 90, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "rgba(255,255,255,0.005)" }}>
              <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
              <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>728 × 90 — BOTTOM BANNER</div>
            </div>
          </div>

          {/* COL 2 — asset prediction cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#334155", letterSpacing: 2, marginBottom: 2 }}>ASSET PREDICTIONS</div>
            {event.assets.map((a, i) => {
              const c = DIR_COLOR[a.direction];
              const sparkData = spark[i] || genSpark();
              return (
                <div key={a.symbol} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${c}25`, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: c + "14", border: `1px solid ${c}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 16, color: c, fontWeight: 700 }}>{DIR_ARROW[a.direction]}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, color: "#e2e8f0", fontFamily: "monospace", fontWeight: 700 }}>{a.symbol}</div>
                        {a.direction !== "flat" && <div style={{ fontSize: 12, color: c, fontFamily: "monospace", fontWeight: 700 }}>{a.direction === "up" ? "+" : "-"}{a.pct}%</div>}
                        {a.direction === "flat" && <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>NO CHANGE</div>}
                      </div>
                    </div>
                    <Sparkline data={sparkData} color={c} w={90} h={40} />
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10, marginBottom: 10 }}>{a.reason}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg,${c}88,${c})`, width: `${Math.min(100, parseFloat(a.pct || 0) * 12 + 15)}%`, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
                    </div>
                    <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {parseFloat(a.pct || 0) < 1 ? "LOW IMPACT" : parseFloat(a.pct || 0) < 3 ? "MED IMPACT" : "HIGH IMPACT"}
                    </span>
                  </div>
                </div>
              );
            })}
            <div style={{ height: 250, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "rgba(255,255,255,0.005)", marginTop: 4 }}>
              <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
              <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>300 × 250</div>
              <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1, textAlign: "center" }}>ADSENSE<br/>IN-CONTENT</div>
            </div>
          </div>

          {/* COL 3 — sticky sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 70 }}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px" }}>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#334155", letterSpacing: 2, marginBottom: 14 }}>EVENT INFO</div>
              {[["COUNTRY", event.country], ["REGION", event.region], ["TYPE", event.category.toUpperCase()], ["PUBLISHED", formatDate(event.timestamp)], ["AGE", timeAgo(event.timestamp)]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 9, color: "#1e293b", fontFamily: "monospace", letterSpacing: 1, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", textAlign: "right", maxWidth: 150, lineHeight: 1.4 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px" }}>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#334155", letterSpacing: 2, marginBottom: 14 }}>AFFECTED ASSETS</div>
              {event.assets.map((a) => {
                const c = DIR_COLOR[a.direction];
                return (
                  <div key={a.symbol} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 7, border: `1px solid ${c}18` }}>
                    <span style={{ fontSize: 13, color: c, fontWeight: 700, width: 16, flexShrink: 0 }}>{DIR_ARROW[a.direction]}</span>
                    <span style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "monospace", flex: 1 }}>{a.symbol}</span>
                    {a.direction !== "flat" && (
                      <span style={{ fontSize: 10, color: c, fontFamily: "monospace", fontWeight: 700, background: c + "14", padding: "2px 7px", borderRadius: 4, border: `1px solid ${c}33` }}>
                        {a.direction === "up" ? "+" : "-"}{a.pct}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ height: 600, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "rgba(255,255,255,0.005)" }}>
              <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
              <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>160 × 600</div>
              <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1, textAlign: "center" }}>ADSENSE<br/>SKYSCRAPER</div>
            </div>
            <div style={{ height: 250, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "rgba(255,255,255,0.005)" }}>
              <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>AD</div>
              <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>300 × 250</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(3,9,18,0.8)", display: "flex", justifyContent: "center", padding: "16px 0 24px" }}>
        <div style={{ width: "min(970px,94%)", height: 90, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "rgba(255,255,255,0.005)" }}>
          <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
          <div style={{ fontSize: 11, color: "#0f172a", fontFamily: "monospace" }}>970 × 90 — FOOTER LEADERBOARD</div>
        </div>
      </div>
    </div>
  );
}
