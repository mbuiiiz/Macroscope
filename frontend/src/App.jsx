import { useState, useCallback } from "react";
import HomePage         from "./pages/HomePage";
import EventDetailPage  from "./pages/EventDetailPage";
import { useEvents }    from "./hooks/useEvents";
import { useHashRouter } from "./hooks/useHashRouter";
import { slugify }       from "./lib/slug";
import "./styles/keyframes.css";

// App — top-level shell.
// Owns cross-page state so navigation between Home and EventDetail doesn't
// drop the user's bookmarks or re-trigger an event fetch.
//
// Responsibilities:
//   1. Route resolution (#/event/:slug → detail page, otherwise home)
//   2. Event data fetching (single useEvents instance shared by both pages)
//   3. Bookmarks state (persisted across page transitions)
export default function App() {
  const { route, navigate, goBack } = useHashRouter();
  const eventsApi                   = useEvents();
  const { events: ALL_EVENTS }      = eventsApi;

  // Bookmarks live here so they persist across page transitions.
  const [bookmarks, setBookmarks] = useState(new Set());
  const toggleBookmark = useCallback((id) => {
    setBookmarks((b) => {
      const n = new Set(b);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  // Detail page route — match by slugified title or numeric ID.
  if (route.page === "event") {
    const detailEvent = ALL_EVENTS.find(
      (e) => slugify(e.title) === route.slug || String(e.id) === route.slug,
    );
    if (detailEvent) {
      return (
        <EventDetailPage
          event={detailEvent}
          onBack={goBack}
          bookmarks={bookmarks}
          toggleBookmark={toggleBookmark}
        />
      );
    }
    // Slug didn't match (e.g. user landed on a stale URL). Fall through
    // to the home page so they don't see a blank screen.
  }

  return (
    <HomePage
      {...eventsApi}
      bookmarks={bookmarks}
      toggleBookmark={toggleBookmark}
      navigate={navigate}
    />
  );
}
