import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Globe from "react-globe.gl";
import MapCard from "./MapCard";
import { CAT_COLOR } from "../../lib/events";

// ─── Static region labels ─────────────────────────────────────────────
// Hardcoded centroids for the super-regions our backend uses. These give
// the viewer a sense of orientation independent of which events happen
// to be active. Coordinates picked to sit over a representative landmass
// rather than a mathematical centroid (e.g. "Asia" sits over Mongolia,
// not in the middle of Kazakhstan where it'd be visually awkward).
const REGION_LABELS = [
  { text: "EUROPE",      lat:  52, lng:  15 },
  { text: "ASIA",        lat:  45, lng: 100 },
  { text: "MIDDLE EAST", lat:  29, lng:  47 },
  { text: "AFRICA",      lat:   2, lng:  20 },
  { text: "AMERICAS",    lat:  10, lng: -80 },
  { text: "OCEANIA",     lat: -25, lng: 140 },
];

// ─── Visibility helper ────────────────────────────────────────────────
// Used by the selected-card overlay to hide the card when the underlying
// event is on the back of the globe. Two points on a sphere are mutually
// visible when their angular separation is < 90°.
function angularDistance(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const c = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

// ─── Pin element factory ──────────────────────────────────────────────
// react-globe.gl's `htmlElement` expects a vanilla DOM element. We build
// the pin imperatively (no React) so the library can position it via CSS
// transforms outside of React's render cycle — that's what makes rotation
// smooth even with hundreds of pins.
function buildPin(ev, onClick) {
  const col = CAT_COLOR[ev.category] ?? "#0A84FF";

  // Outer hit target — larger than the visible dot so the pin is easy to click
  // on a rotating globe. Transparent, no visual presence.
  const wrapper = document.createElement("div");
  wrapper.title = `${ev.country} — ${ev.title}`;
  wrapper.style.cssText = `
    position: relative;
    width: 28px; height: 28px;
    cursor: pointer;
    pointer-events: auto;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  // pointerdown fires earlier than click and is harder for OrbitControls to
  // swallow during a drag-vs-click ambiguity. We use it for selection.
  wrapper.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    onClick(ev);
  });

  const inner = document.createElement("div");
  inner.style.cssText = `
    position: relative;
    width: 14px; height: 14px;
    transition: transform 0.18s;
    pointer-events: none;
  `;

  const ring = document.createElement("div");
  ring.style.cssText = `
    position: absolute; inset: -6px;
    border-radius: 50%;
    border: 1.5px solid ${col};
    animation: msDotPulse 2.2s ease-out ${(ev.id % 6) * 0.35}s infinite;
    pointer-events: none;
  `;

  const dot = document.createElement("div");
  dot.style.cssText = `
    width: 100%; height: 100%;
    border-radius: 50%;
    background: ${col};
    box-shadow: 0 0 8px ${col}, 0 0 16px ${col}55;
    pointer-events: none;
  `;

  wrapper.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.5)"; });
  wrapper.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; });

  inner.appendChild(ring);
  inner.appendChild(dot);
  wrapper.appendChild(inner);
  return wrapper;
}

// ─── GlobeMap ─────────────────────────────────────────────────────────
// 3D globe view (react-globe.gl + Three.js).
//
// Performance architecture:
//   - Pins are rendered via the library's `htmlElementsData`. The library
//     positions each element using CSS transforms directly, *without*
//     going through React's render cycle. Rotation stays smooth even
//     with hundreds of pins because we don't `setState` per frame.
//   - The selected card is a single React-rendered overlay. Its position
//     is updated imperatively via a ref + direct style mutation on the
//     globe's controls "change" event — also bypassing React state.
//   - Only one element re-positions per frame (the selected card),
//     instead of one-per-event as in the previous implementation.
export default function GlobeMap({
  events,
  expandedId,
  selectedId,
  onToggle,
  onSelectOnly,
  onDismiss,
  filters,
  panelMode,
}) {
  const containerRef    = useRef(null);
  const globeRef        = useRef(null);
  const cardRef         = useRef(null);
  // Tracks whether the most recent click landed on a pin. react-globe.gl's
  // onGlobeClick fires via Three.js raycaster, not DOM event bubbling, so
  // stopPropagation on a pin click can't stop it from reaching the globe.
  // We use this flag to suppress the dismiss-on-globe-click that would
  // otherwise immediately clear the selection we just made.
  const pinClickedAtRef = useRef(0);

  const [size, setSize]   = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Filter events by category and region — same logic as before.
  const filtered = useMemo(
    () => events.filter((e) => {
      if (filters.category !== "all" && e.category !== filters.category) return false;
      if (filters.region   !== "all" && e.region   !== filters.region)   return false;
      return true;
    }),
    [events, filters],
  );

  // Track the selected event so the card overlay can render the right content.
  const selectedEvent = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // ─── Country labels: one per event, deduplicated ──────────────────
  // We dedupe by country so we don't stack two "United States" labels
  // when there are multiple US events. The label sits next to the pin,
  // colored by the most-prominent category from events in that country.
  const countryLabels = useMemo(() => {
    const seen = new Map();
    for (const ev of filtered) {
      if (seen.has(ev.country)) continue;
      seen.set(ev.country, {
        text: ev.country.toUpperCase(),
        lat:  ev.lat,
        lng:  ev.lng,
        color: CAT_COLOR[ev.category] ?? "#94a3b8",
      });
    }
    return [...seen.values()];
  }, [filtered]);

  // Combined labels = static region labels + dynamic country labels.
  // Region labels are tagged so we can style them larger / dimmer.
  const labels = useMemo(
    () => [
      ...REGION_LABELS.map((r) => ({ ...r, kind: "region" })),
      ...countryLabels.map((c) => ({ ...c, kind: "country" })),
    ],
    [countryLabels],
  );

  // ─── Arcs: connect all events of the same category ────────────────
  // Generates one arc per unordered pair of same-category events.
  // Visual: an animated dashed line in the category's color, gives a sense
  // of "these events are part of the same global thread."
  const arcs = useMemo(() => {
    const byCategory = new Map();
    for (const ev of filtered) {
      if (!byCategory.has(ev.category)) byCategory.set(ev.category, []);
      byCategory.get(ev.category).push(ev);
    }
    const out = [];
    for (const [cat, group] of byCategory) {
      const color = CAT_COLOR[cat] ?? "#0A84FF";
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          out.push({
            startLat: group[i].lat,
            startLng: group[i].lng,
            endLat:   group[j].lat,
            endLng:   group[j].lng,
            color,
          });
        }
      }
    }
    return out;
  }, [filtered]);

  // ─── Container sizing ─────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Pin click handler ────────────────────────────────────────────
  // Stable across renders. Records the click time so onGlobeClick (which
  // also fires for clicks anywhere on the globe surface) can ignore it.
  const handlePinClick = useCallback((ev) => {
    pinClickedAtRef.current = Date.now();
    onSelectOnly(ev.id);
  }, [onSelectOnly]);

  // Only dismiss when the click wasn't part of a pin selection.
  // pointerdown on the pin happens up to ~250ms before click on slow devices,
  // so we use a generous window. Anything below ~300ms feels instantaneous.
  const handleGlobeClick = useCallback(() => {
    if (Date.now() - pinClickedAtRef.current < 300) return;
    onDismiss();
  }, [onDismiss]);

  // Stable factory for the pin DOM. Without this, the inline arrow would
  // be a new reference every render and react-globe.gl would rebuild every
  // pin's DOM node on each parent state change — visible as rotation lag.
  const renderPin = useCallback(
    (d) => buildPin(d, handlePinClick),
    [handlePinClick],
  );

  // ─── Imperative card position update ──────────────────────────────
  // Fires on every globe controls "change" event during a drag/zoom.
  // Mutates style.transform directly — no React render involved.
  const updateCardPosition = useCallback(() => {
    const card = cardRef.current;
    const globe = globeRef.current;
    if (!card || !globe || !selectedEvent) return;

    const pov = globe.pointOfView();
    const onFront = angularDistance(pov.lat, pov.lng, selectedEvent.lat, selectedEvent.lng) < Math.PI / 2;
    if (!onFront) {
      card.style.opacity = "0";
      card.style.pointerEvents = "none";
      return;
    }
    const c = globe.getScreenCoords(selectedEvent.lat, selectedEvent.lng, 0);
    if (!c) {
      card.style.opacity = "0";
      return;
    }
    card.style.opacity = "1";
    card.style.pointerEvents = "auto";
    // Translate so the card's bottom-center sits ~14px above the pin.
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    card.style.transform = `translate(${c.x - w / 2}px, ${c.y - h - 14}px)`;
  }, [selectedEvent]);

  // Re-position whenever selection changes, then subscribe to globe changes.
  useEffect(() => {
    if (!ready || !globeRef.current) return;
    // Run on next frame so the React-rendered card has its final dimensions.
    const id = requestAnimationFrame(updateCardPosition);
    const controls = globeRef.current.controls();
    controls.addEventListener("change", updateCardPosition);
    return () => {
      cancelAnimationFrame(id);
      controls.removeEventListener("change", updateCardPosition);
    };
  }, [ready, updateCardPosition]);

  // ─── Globe initial setup ──────────────────────────────────────────
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 15, lng: 20, altitude: 2.0 }, 0);
    const controls = globe.controls();
    controls.minDistance = 130;
    controls.maxDistance = 600;
    controls.enablePan = false;
    setReady(true);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#030f1e" }}>
      {size.w > 0 && size.h > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere={true}
          atmosphereColor="#0A84FF"
          atmosphereAltitude={0.18}
          onGlobeReady={handleGlobeReady}
          onGlobeClick={handleGlobeClick}
          // ── Pin layer — positioned natively by the library ───────────
          htmlElementsData={filtered}
          htmlLat={(d) => d.lat}
          htmlLng={(d) => d.lng}
          htmlAltitude={0.005}
          htmlElement={renderPin}
          // ── Arc layer — same-category event connections ──────────────
          // Faint dashed lines that animate around the globe, reinforcing
          // visually which events belong to the same theme (war, economy,
          // politics). Stroke and opacity are tuned to be subtle so they
          // never compete with the pins.
          arcsData={arcs}
          arcColor={(a) => `${a.color}66`}
          arcStroke={0.3}
          arcAltitudeAutoScale={0.4}
          arcDashLength={0.4}
          arcDashGap={0.6}
          arcDashAnimateTime={4000}
          // ── Label layer — region orienteers + per-country event tags ─
          // Two visual tiers: REGION labels are large and dim (background
          // wayfinding), country labels are small and accented (point to
          // the actual events). The library auto-hides labels on the back
          // hemisphere so we don't have to manage visibility ourselves.
          labelsData={labels}
          labelLat={(d) => d.lat}
          labelLng={(d) => d.lng}
          labelText={(d) => d.text}
          labelSize={(d) => (d.kind === "region" ? 1.2 : 0.45)}
          labelDotRadius={0}
          labelColor={(d) => (d.kind === "region" ? "rgba(255,255,255,0.18)" : (d.color ?? "#94a3b8"))}
          labelResolution={2}
          labelAltitude={(d) => (d.kind === "region" ? 0.012 : 0.008)}
        />
      )}

      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#1e293b", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, pointerEvents: "none" }}>
          <div style={{ width: 14, height: 14, border: "1.5px solid #0f172a", borderTopColor: "#0A84FF", borderRadius: "50%", animation: "msSpin 0.8s linear infinite" }} />
          LOADING GLOBE…
        </div>
      )}

      {/* ─── Selected card overlay ───────────────────────────────────
          Single React-rendered card. Position is mutated imperatively
          via cardRef in updateCardPosition() — no React state per frame.
          NOTE: panelMode (always-show-all-cards) was simplified out for
          this perf pass. If we bring it back, render the multi-card layer
          here using the same imperative-update pattern, one ref per card. */}
      {ready && selectedEvent && (
        <div
          ref={cardRef}
          style={{ position: "absolute", left: 0, top: 0, willChange: "transform", zIndex: 30, transition: "opacity 0.15s" }}
        >
          <MapCard
            event={selectedEvent}
            expanded={expandedId === selectedEvent.id}
            scale={1}
            onToggle={() => onToggle(selectedEvent.id)}
            style={{ position: "static", left: 0, top: 0 }}
          />
        </div>
      )}

      {ready && (
        <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 5 }}>
          <div style={{ background: "rgba(3,9,18,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "5px 14px" }}>
            <span style={{ fontSize: 8, color: "#1e293b", fontFamily: "monospace", letterSpacing: 2 }}>
              DRAG TO ROTATE · SCROLL TO ZOOM · CLICK PIN TO VIEW NEWS
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
