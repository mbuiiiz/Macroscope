import { useState, useEffect, useCallback, useMemo } from "react";
import GlobeMap         from "../components/globe/GlobeMap";
import DetailSidePanel  from "../components/panels/DetailSidePanel";
import { applyFilters, AGE_FILTERS, CATEGORIES, REGIONS } from "../lib/filters";
import { CAT_COLOR, DIR_COLOR, DIR_ARROW, timeAgo } from "../lib/events";
import { slugify }      from "../lib/slug";

// HomePage — the main landing view.
// Composition:
//   • Top banner (logo + ad slot + status badge + UTC clock)
//   • Toolbar  (stats + category/region/age filters + search + bookmarks + mode toggle)
//   • Body
//       ▸ Left ad column
//       ▸ Center: GlobeMap + LiveFeed strip
//       ▸ Right: either DetailSidePanel (event selected) or event list
//
// All data + cross-page state (events, bookmarks) is owned by App.jsx and
// passed in as props. This page is responsible only for *home-view* UI
// state (selection, filters, search, etc.).
export default function HomePage({
  events: ALL_EVENTS,
  loading: eventsLoading,
  backendStatus,
  lastFetch,
  refetch,
  bookmarks,
  toggleBookmark,
  navigate,
}) {
  // ─── Selection / filter / UI state (page-local only) ──────────────
  const [expandedId,    setExpandedId]    = useState(null);
  const [selectedId,    setSelectedId]    = useState(null);
  const [filters,       setFilters]       = useState({ category: "all", region: "all", ageDays: Infinity });
  const [search,        setSearch]        = useState("");
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [feedVisible,   setFeedVisible]   = useState(true);
  const [panelMode,     setPanelMode]     = useState(true);
  const [time,          setTime]          = useState("");

  // Live UTC clock in the header.
  useEffect(() => {
    const fmt = () => new Date().toUTCString().split(" ")[4];
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);

  // Default home-page SEO. EventDetailPage overrides these on mount and
  // restores them on unmount.
  useEffect(() => {
    document.title = "MacroScope — Geopolitical Market Intelligence Map";

    const setMeta = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    const setLink = (sel, rel, href) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
      el.setAttribute("href", href);
    };

    setMeta('meta[name="description"]',         "content", "Real-time geopolitical events mapped to forex, stocks and commodity market impacts. Track conflicts, sanctions, central bank decisions and their asset predictions.");
    setMeta('meta[name="keywords"]',            "content", "geopolitical risk, market impact, forex, commodities, sanctions, war risk, central bank, MacroScope");
    setMeta('meta[name="robots"]',              "content", "index, follow");
    setMeta('meta[property="og:type"]',         "content", "website");
    setMeta('meta[property="og:title"]',        "content", "MacroScope — Geopolitical Market Intelligence");
    setMeta('meta[property="og:description"]',  "content", "Real-time geopolitical events mapped to forex, stocks and commodity market impacts.");
    setMeta('meta[property="og:url"]',          "content", "https://macroscope.io");
    setMeta('meta[property="og:site_name"]',    "content", "MacroScope");
    setMeta('meta[name="twitter:card"]',        "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]',       "content", "MacroScope — Geopolitical Market Intelligence");
    setMeta('meta[name="twitter:description"]', "content", "Real-time geopolitical events mapped to forex, stocks and commodity market impacts.");
    setMeta('meta[name="twitter:site"]',        "content", "@MacroScope_io");
    setLink('link[rel="canonical"]', "canonical", "https://macroscope.io");
  }, []);

  // ─── Selection handlers ───────────────────────────────────────────

  // Click event in any list → open card overlay AND panel.
  const handleToggleCard = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setSelectedId(id);
  }, []);

  // Click pin on globe → toggle which one is selected (no auto-expand).
  const handleSelectOnly = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setExpandedId(null);
  }, []);

  const handleDismiss    = useCallback(() => { setSelectedId(null); setExpandedId(null); }, []);
  const handleClose      = useCallback(() => { setSelectedId(null); setExpandedId(null); }, []);
  const handleOpenDetail = useCallback((id) => {
    const ev = ALL_EVENTS.find((e) => e.id === id);
    if (ev) navigate(`#/event/${slugify(ev.title)}`);
  }, [navigate, ALL_EVENTS]);

  const filtered = useMemo(
    () => applyFilters(ALL_EVENTS, { filters, search, bookmarks, showBookmarks }),
    [ALL_EVENTS, filters, search, bookmarks, showBookmarks],
  );

  const selectedEvent = ALL_EVENTS.find((e) => e.id === selectedId) || null;

  // ─── Backend status badge config (memoized) ───────────────────────
  const statusConfig = {
    live:       { dot: "#30D158", label: "LIVE DATA",   bg: "rgba(48,209,88,0.08)",  border: "rgba(48,209,88,0.25)" },
    mock:       { dot: "#FFD60A", label: "DEMO DATA",   bg: "rgba(255,214,10,0.08)", border: "rgba(255,214,10,0.25)" },
    connecting: { dot: "#0A84FF", label: "CONNECTING…", bg: "rgba(10,132,255,0.08)", border: "rgba(10,132,255,0.2)", spin: true },
    error:      { dot: "#FF3B30", label: "API ERROR",   bg: "rgba(255,59,48,0.08)",  border: "rgba(255,59,48,0.25)" },
  }[backendStatus] || {};

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#030912", color: "#e2e8f0", fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* LOADING OVERLAY */}
      {eventsLoading && (
        <div style={{ position: "fixed", inset: 0, background: "#030912", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, border: "2px solid rgba(10,132,255,0.2)", borderTopColor: "#0A84FF", borderRadius: "50%", animation: "msSpin 0.9s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontFamily: "'Space Mono',monospace", color: "#f1f5f9", marginBottom: 6 }}>MACRO<span style={{ color: "#0A84FF" }}>SCOPE</span></div>
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: 2 }}>LOADING EVENTS…</div>
          </div>
        </div>
      )}

      {/* TOP BANNER */}
      <div style={{ height: 90, background: "rgba(3,9,18,0.99)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 50 }}>
        <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,rgba(10,132,255,0.14),rgba(10,132,255,0.05))", border: "1px solid rgba(10,132,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌐</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5 }}>MACRO<span style={{ color: "#0A84FF" }}>SCOPE</span></h1>
            <div style={{ fontSize: 7, color: "#1e293b", fontFamily: "monospace", letterSpacing: 2, marginTop: 1 }}>GEOPOLITICAL MARKET INTELLIGENCE</div>
          </div>
        </div>
        <div style={{ width: "min(728px,55%)", height: 70, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
          <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
          <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>728 × 70 — TOP BANNER AD SLOT</div>
        </div>
        <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={refetch} title="Click to refresh"
            style={{ display: "flex", alignItems: "center", gap: 6, background: statusConfig.bg, border: `1px solid ${statusConfig.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusConfig.dot, animation: statusConfig.spin ? "msSpin 1.2s linear infinite" : "msPulse 2s infinite" }} />
            <span style={{ fontSize: 8, fontFamily: "'Space Mono',monospace", color: statusConfig.dot, letterSpacing: 1.5 }}>{statusConfig.label}</span>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>↻</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontFamily: "'Space Mono',monospace", color: "#1e293b" }}>{time}</div>
            <div style={{ fontSize: 7, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>UTC LIVE</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ padding: "8px 16px", background: "rgba(3,9,18,0.98)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { l: "EVENTS",    v: filtered.length,                                       c: "#e2e8f0" },
            { l: "CONFLICT",  v: filtered.filter((e) => e.category === "war").length,       c: "#FF3B30" },
            { l: "ECONOMIC",  v: filtered.filter((e) => e.category === "economy").length,   c: "#FFD60A" },
            { l: "POLITICAL", v: filtered.filter((e) => e.category === "politics").length,  c: "#0A84FF" },
          ].map((s) => (
            <div key={s.l} style={{ background: "rgba(3,9,18,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: "7px 12px", textAlign: "center", minWidth: 60 }}>
              <div style={{ fontSize: 18, fontFamily: "'Space Mono',monospace", color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 7, color: "#334155", fontFamily: "monospace", letterSpacing: 1, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />

        {/* Category filters */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {CATEGORIES.map((c) => {
            const act = filters.category === c;
            const col = CAT_COLOR[c];
            return (
              <button key={c} onClick={() => setFilters((f) => ({ ...f, category: c }))}
                style={{ background: act ? (col ? col + "1a" : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.02)", border: `1px solid ${act ? (col || "rgba(255,255,255,0.2)") + "55" : "rgba(255,255,255,0.06)"}`, color: act ? (col || "#94a3b8") : "#334155", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 9, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s" }}>
                {c}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />

        {/* Region */}
        <select value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}
          style={{ background: "rgba(3,9,18,0.9)", border: "1px solid rgba(255,255,255,0.06)", color: "#475569", borderRadius: 5, padding: "5px 9px", fontSize: 9, fontFamily: "monospace", cursor: "pointer", outline: "none" }}>
          {REGIONS.map((r) => <option key={r} value={r}>{r === "all" ? "ALL REGIONS" : r.toUpperCase()}</option>)}
        </select>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />

        {/* Age */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#1e293b", fontFamily: "monospace", letterSpacing: 1, whiteSpace: "nowrap" }}>AGE:</span>
          {AGE_FILTERS.map((f) => {
            const act = filters.ageDays === f.days;
            return (
              <button key={f.label} onClick={() => setFilters((prev) => ({ ...prev, ageDays: f.days }))}
                style={{ background: act ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${act ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"}`, color: act ? "#e2e8f0" : "#334155", borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontSize: 9, fontFamily: "monospace", letterSpacing: 0.5, whiteSpace: "nowrap", transition: "all 0.2s" }}>
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {Object.entries(CAT_COLOR).map(([cat, col]) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: col, boxShadow: `0 0 4px ${col}` }} />
              <span style={{ fontSize: 8, color: "#334155", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" }}>{cat}</span>
            </div>
          ))}
        </div>

        {/* Search + bookmarks + mode toggle (right-aligned) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(3,9,18,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px" }}>
            <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: !panelMode ? "#e2e8f0" : "#334155", letterSpacing: 1, transition: "color 0.2s" }}>DOTS</span>
            <div onClick={() => setPanelMode((m) => !m)} style={{ width: 36, height: 18, borderRadius: 9, cursor: "pointer", background: panelMode ? "#0A84FF" : "rgba(255,255,255,0.08)", border: `1px solid ${panelMode ? "#0A84FF" : "rgba(255,255,255,0.1)"}`, position: "relative", transition: "background 0.25s,border-color 0.25s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: panelMode ? 18 : 2, width: 12, height: 12, borderRadius: "50%", background: panelMode ? "#fff" : "rgba(255,255,255,0.4)", transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1),background 0.2s", boxShadow: panelMode ? "0 1px 4px rgba(0,0,0,0.4)" : "none" }} />
            </div>
            <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: panelMode ? "#0A84FF" : "#334155", letterSpacing: 1, transition: "color 0.2s" }}>PANELS</span>
          </div>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#334155", fontSize: 13, pointerEvents: "none" }}>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              style={{ background: "rgba(3,9,18,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "7px 12px 7px 30px", color: "#94a3b8", fontSize: 11, fontFamily: "'Space Mono',monospace", outline: "none", width: 160, transition: "border-color 0.2s" }}
              onFocus={(e) => e.target.style.borderColor = "rgba(10,132,255,0.4)"}
              onBlur={ (e) => e.target.style.borderColor = "rgba(255,255,255,0.07)"} />
          </div>
          <button onClick={() => setShowBookmarks((b) => !b)}
            style={{ background: showBookmarks ? "rgba(255,214,10,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${showBookmarks ? "rgba(255,214,10,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 7, padding: "7px 11px", color: showBookmarks ? "#FFD60A" : "#334155", cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}>★</button>

          {/* Compact backend-status pill (right of toolbar) */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(3,9,18,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: "5px 10px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: backendStatus === "live" ? "#30D158" : backendStatus === "error" ? "#FF3B30" : "#FFD60A", boxShadow: `0 0 4px ${backendStatus === "live" ? "#30D158" : backendStatus === "error" ? "#FF3B30" : "#FFD60A"}` }} />
            <span style={{ fontSize: 8, color: "#334155", fontFamily: "monospace", letterSpacing: 1 }}>
              {backendStatus === "live" ? "LIVE" : backendStatus === "error" ? "ERROR" : "DEMO"}
            </span>
            {lastFetch && (
              <span style={{ fontSize: 8, color: "#1e293b", fontFamily: "monospace" }}>
                {lastFetch.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            )}
            <button onClick={refetch} title="Refresh events"
              style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1, transition: "color 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#0A84FF"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#334155"}>↺</button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Left ad column */}
        <div style={{ width: 180, flexShrink: 0, background: "rgba(3,9,18,0.95)", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 10px", gap: 12 }}>
          <div style={{ width: 160, flex: 1, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: "rgba(255,255,255,0.006)" }}>
            <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
            <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>160 × 600</div>
            <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1, textAlign: "center", lineHeight: 1.6 }}>ADSENSE<br/>SKYSCRAPER</div>
          </div>
          <div style={{ width: 160, height: 150, border: "1px dashed rgba(255,255,255,0.05)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "rgba(255,255,255,0.004)" }}>
            <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>AD</div>
            <div style={{ fontSize: 9, color: "#0f172a", fontFamily: "monospace" }}>160 × 150</div>
          </div>
        </div>

        {/* Center: globe + live feed */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
            <GlobeMap
              events={filtered}
              expandedId={expandedId}
              selectedId={selectedId}
              onToggle={handleToggleCard}
              onSelectOnly={handleSelectOnly}
              onDismiss={handleDismiss}
              filters={filters}
              panelMode={panelMode}
            />
          </div>
          <div style={{ background: "rgba(3,9,18,0.97)", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 16px", borderBottom: feedVisible ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF3B30", animation: "msPulse 1.5s infinite" }} />
                <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#FF3B30", letterSpacing: 2 }}>LIVE FEED</span>
                <span style={{ fontSize: 9, color: "#1e293b", fontFamily: "monospace" }}>· AUTO-REFRESH 5MIN</span>
              </div>
              <button onClick={() => setFeedVisible((v) => !v)}
                style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 9, fontFamily: "monospace", letterSpacing: 1 }}>
                {feedVisible ? "▼ HIDE" : "▲ SHOW"}
              </button>
            </div>
            {feedVisible && (
              <div style={{ display: "flex", overflowX: "auto", padding: "8px 12px", scrollbarWidth: "none" }}>
                {filtered.slice(0, 8).map((ev) => (
                  <button key={ev.id} onClick={() => handleToggleCard(ev.id)}
                    style={{ background: "none", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", textAlign: "left", flexShrink: 0, maxWidth: 190, marginRight: 6, color: "inherit", transition: "border-color 0.15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = CAT_COLOR[ev.category] + "55"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: CAT_COLOR[ev.category], display: "inline-block" }} />
                      <span style={{ fontSize: 8, color: "#334155", fontFamily: "monospace" }}>{ev.country}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>{ev.title.slice(0, 45)}…</div>
                    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                      {ev.assets.slice(0, 2).map((a) => (
                        <span key={a.symbol} style={{ fontSize: 8, color: DIR_COLOR[a.direction], fontFamily: "monospace" }}>
                          {DIR_ARROW[a.direction]}{a.symbol}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: detail OR list */}
        <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(3,9,18,0.98)" }}>
          {selectedEvent ? (
            <DetailSidePanel
              event={selectedEvent}
              onClose={handleClose}
              onOpenDetail={handleOpenDetail}
              bookmarks={bookmarks}
              toggleBookmark={toggleBookmark}
            />
          ) : (
            <>
              <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: "#334155", letterSpacing: 2 }}>
                  {showBookmarks ? "BOOKMARKS" : "GLOBAL EVENTS"} ({filtered.length})
                </span>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#30D158", animation: "msPulse 2s infinite" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#0f172a transparent" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#1e293b", fontSize: 11, fontFamily: "monospace" }}>No events match filters</div>
                ) : (
                  filtered.map((ev) => {
                    const col = CAT_COLOR[ev.category];
                    return (
                      <div key={ev.id} onClick={() => handleToggleCard(ev.id)}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.03)", borderLeft: selectedId === ev.id ? `2px solid ${col}` : "2px solid transparent", background: selectedId === ev.id ? "rgba(10,132,255,0.04)" : "transparent", transition: "all 0.15s", animation: "msFadeUp 0.3s ease" }}
                        onMouseEnter={(e) => { if (selectedId !== ev.id) e.currentTarget.style.background = "rgba(255,255,255,0.018)"; }}
                        onMouseLeave={(e) => { if (selectedId !== ev.id) e.currentTarget.style.background = "transparent"; }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: col, display: "inline-block", flexShrink: 0, boxShadow: `0 0 4px ${col}` }} />
                              <span style={{ fontSize: 8, color: "#1e293b", fontFamily: "monospace" }}>{ev.country} · {ev.region}</span>
                              <span style={{ fontSize: 7, color: "#1e293b", fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(ev.timestamp)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, marginBottom: 5 }}>
                              {ev.title.slice(0, 52)}{ev.title.length > 52 ? "..." : ""}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {ev.assets.slice(0, 3).map((a) => (
                                <div key={a.symbol} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 8, fontFamily: "monospace", color: DIR_COLOR[a.direction] }}>
                                  <span>{DIR_ARROW[a.direction]}</span>
                                  <span style={{ color: "#334155" }}>{a.symbol}</span>
                                  {a.direction !== "flat" && <span>{a.pct}%</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); toggleBookmark(ev.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: bookmarks.has(ev.id) ? "#FFD60A" : "#1e293b", fontSize: 12, paddingLeft: 6, flexShrink: 0 }}>★</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ height: 260, borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: "rgba(255,255,255,0.004)" }}>
                <div style={{ fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
                <div style={{ fontSize: 10, color: "#0f172a", fontFamily: "monospace" }}>300 × 250</div>
                <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1.5 }}>ADSENSE SIDEBAR SLOT</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

