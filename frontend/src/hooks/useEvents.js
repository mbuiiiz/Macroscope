import { useState, useEffect, useCallback } from "react";
import { MOCK_EVENTS } from "../lib/mockData";

// Backend base URL is injected at build time from VITE_API_URL.
// In local dev with `vite dev`, set it in .env.local; in production it's
// configured in Vercel env vars and bakes into the bundle.
const API_BASE = import.meta.env?.VITE_API_URL;

// useEvents — fetches events from the backend, polls every 5 minutes,
// falls back to MOCK_EVENTS when the backend is unreachable.
//
// Returns:
//   events         — current event array (live or mock)
//   loading        — true until the first fetch attempt resolves
//   backendStatus  — "live" | "mock" | "connecting" | "error"
//   lastFetch      — Date of the most recent fetch attempt
//   refetch        — manual trigger
export function useEvents() {
  const [events, setEvents]            = useState(MOCK_EVENTS);
  const [loading, setLoading]          = useState(true);
  const [backendStatus, setStatus]     = useState("connecting");
  const [lastFetch, setLastFetch]      = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/events?limit=200`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);
        setStatus("live");
      } else if (Array.isArray(data.events) && data.events.length === 0) {
        // Backend up but pipeline hasn't populated yet — keep showing mock
        // data so the page isn't empty.
        setStatus("mock");
      } else {
        throw new Error("unexpected response shape");
      }
    } catch (err) {
      // Network errors / aborts → mock; HTTP errors → error.
      const isMock = err.name === "AbortError" || err.message.includes("fetch") || err.message.includes("NetworkError");
      setStatus(isMock ? "mock" : "error");
      setEvents(MOCK_EVENTS);
      console.info("[MacroScope] Using mock data:", err.message);
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const t = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  return { events, loading, backendStatus, lastFetch, refetch: fetchEvents };
}
