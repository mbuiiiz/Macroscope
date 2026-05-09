import AISummary from "../widgets/AISummary";
import { CAT_COLOR, DIR_COLOR, DIR_ARROW, timeAgo } from "../../lib/events";

// Side panel that slides in from the right when an event is selected on
// the globe. Shows the event headline, asset predictions, AI analysis,
// and a CTA to open the full detail page.
//
// Props:
//   event           — selected event object (null = nothing rendered)
//   onClose         — fired when the close button is clicked
//   onOpenDetail    — fired when the user clicks "VIEW FULL DETAIL PAGE"
//   bookmarks       — Set<eventId> of bookmarked events
//   toggleBookmark  — (id) => void
export default function DetailSidePanel({ event, onClose, onOpenDetail, bookmarks, toggleBookmark }) {
  if (!event) return null;
  const col = CAT_COLOR[event.category];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "msSlideIn 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, display: "inline-block", boxShadow: `0 0 8px ${col}` }} />
              <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: col, letterSpacing: 2, textTransform: "uppercase" }}>{event.category}</span>
              <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>· {timeAgo(event.timestamp)}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 14, fontFamily: "'DM Serif Display',Georgia,serif", color: "#f1f5f9", lineHeight: 1.4, fontWeight: 400 }}>{event.title}</h2>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={() => toggleBookmark(event.id)} style={{ background: "none", border: "none", cursor: "pointer", color: bookmarks.has(event.id) ? "#FFD60A" : "#334155", fontSize: 15, padding: 2 }}>★</button>
            <button onClick={onClose}                       style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 16, padding: 2, lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <span style={{ fontSize: 12, color: "#475569", fontFamily: "'Space Mono',monospace" }}>{event.country}</span>
          <span style={{ fontSize: 9, color: "#1e293b", marginLeft: "auto", fontFamily: "monospace" }}>{event.region}</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#0f172a transparent" }}>
        <div style={{ padding: "0 18px 24px" }}>
          {/* Summary */}
          <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.75 }}>{event.summary}</p>
          </div>

          {/* Asset predictions */}
          <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", color: "#334155", letterSpacing: 2, marginBottom: 12 }}>ASSET PREDICTIONS</div>
            {event.assets.map((a) => {
              const c = DIR_COLOR[a.direction];
              const arr = DIR_ARROW[a.direction];
              return (
                <div key={a.symbol} style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 7, padding: "8px 10px", background: "rgba(255,255,255,0.025)", borderRadius: 7, border: `1px solid ${c}22` }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: c + "16", border: `1px solid ${c}33`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: c, fontWeight: 700 }}>{arr}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace", fontWeight: 600 }}>{a.symbol}</span>
                      {a.direction !== "flat" && (
                        <span style={{ fontSize: 10, color: c, fontFamily: "monospace", fontWeight: 700, background: c + "14", padding: "1px 6px", borderRadius: 4, border: `1px solid ${c}33` }}>
                          {a.direction === "up" ? "+" : "-"}{a.pct}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.4 }}>{a.reason}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI analysis */}
          <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <AISummary event={event} />
          </div>

          {/* Detail page CTA */}
          <div style={{ paddingTop: 16 }}>
            <button
              onClick={() => onOpenDetail(event.id)}
              style={{
                width: "100%", padding: "11px 16px",
                background: `linear-gradient(135deg, ${col}18, ${col}0c)`,
                border: `1px solid ${col}55`, borderRadius: 8,
                color: col, fontSize: 11, fontFamily: "'Space Mono',monospace",
                letterSpacing: 1.5, cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `linear-gradient(135deg, ${col}28, ${col}18)`; e.currentTarget.style.borderColor = col + "88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `linear-gradient(135deg, ${col}18, ${col}0c)`; e.currentTarget.style.borderColor = col + "55"; }}
            >
              <span>VIEW FULL DETAIL PAGE</span>
              <span style={{ fontSize: 14 }}>→</span>
            </button>
          </div>

          {/* Ad slot */}
          <div style={{ marginTop: 12, border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.006)", position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: 10, fontSize: 8, color: "#0f172a", fontFamily: "monospace", letterSpacing: 2 }}>ADVERTISEMENT</div>
            <div style={{ fontSize: 11, color: "#0f172a", fontFamily: "monospace" }}>300 × 250</div>
            <div style={{ fontSize: 8, color: "#0a1020", fontFamily: "monospace", letterSpacing: 1.5, textAlign: "center" }}>ADSENSE IN-PANEL</div>
          </div>
        </div>
      </div>
    </div>
  );
}
