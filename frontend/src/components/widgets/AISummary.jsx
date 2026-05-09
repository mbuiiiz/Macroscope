import { DIR_COLOR, DIR_ARROW } from "../../lib/events";

// Renders the AI-generated analysis block for an event.
// Reads pre-computed `event.ai_analysis` populated by the backend pipeline,
// so there is no client-side LLM call (zero per-view API cost).
//
// Expected shape on event.ai_analysis:
//   {
//     risk_level:   "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
//     summary:      string,
//     market_impact: string,
//     key_takeaway: string?,
//     asset_outlook: [{ symbol, direction, confidence, reason }]
//   }
export default function AISummary({ event }) {
  const d = event?.ai_analysis;
  const RC = { LOW: "#30D158", MEDIUM: "#FFD60A", HIGH: "#FF9F0A", CRITICAL: "#FF3B30" };
  const CC = { HIGH: "#30D158", MEDIUM: "#FFD60A", LOW: "#FF9F0A" };

  if (!d) return (
    <p style={{ fontSize: 11, color: "#334155", fontFamily: "monospace", padding: "10px 0" }}>
      AI analysis not yet available for this event.
    </p>
  );

  const rc = RC[d.risk_level] || "#FFD60A";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", color: "#0A84FF", letterSpacing: 2 }}>AI ANALYSIS</span>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: rc + "22", color: rc, border: `1px solid ${rc}44`, fontFamily: "monospace", letterSpacing: 1 }}>{d.risk_level}</span>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.75, margin: "0 0 10px" }}>{d.summary}</p>
      <div style={{ background: "rgba(10,132,255,0.07)", borderLeft: "2px solid rgba(10,132,255,0.22)", padding: "10px 12px", borderRadius: "0 6px 6px 0", marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: "#0A84FF", fontFamily: "monospace", letterSpacing: 1.5, marginBottom: 5 }}>MACRO IMPACT</div>
        <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.75, margin: 0 }}>{d.market_impact}</p>
      </div>
      {d.key_takeaway && (
        <div style={{ background: "rgba(255,214,10,0.06)", border: "1px solid rgba(255,214,10,0.15)", padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 9, color: "#FFD60A", fontFamily: "monospace", letterSpacing: 1.5 }}>KEY TAKEAWAY  </span>
          <span style={{ fontSize: 11, color: "#e2e8f0" }}>{d.key_takeaway}</span>
        </div>
      )}
      {d.asset_outlook?.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "#334155", letterSpacing: 1.5, marginBottom: 8 }}>AI ASSET OUTLOOK</div>
          {d.asset_outlook.map((a) => {
            const dc   = DIR_COLOR[a.direction] || "#64748b";
            const arr  = DIR_ARROW[a.direction] || "─";
            const conf = CC[a.confidence] || "#64748b";
            return (
              <div key={a.symbol} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "6px 8px", background: "rgba(255,255,255,0.025)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, color: dc, fontWeight: 700, width: 14 }}>{arr}</span>
                <span style={{ fontSize: 10, color: "#cbd5e1", fontFamily: "monospace", flex: 1 }}>{a.symbol}</span>
                <span style={{ fontSize: 8, color: conf, fontFamily: "monospace", background: conf + "14", padding: "1px 5px", borderRadius: 3, border: `1px solid ${conf}33` }}>{a.confidence}</span>
                <span style={{ fontSize: 9, color: "#475569", maxWidth: 80, textAlign: "right", lineHeight: 1.3 }}>{a.reason}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
