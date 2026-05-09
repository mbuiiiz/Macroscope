import { useState, useEffect, useCallback, useMemo } from "react";

// Tiny hash-based router. We use `#/path` instead of pushState so the app
// works fine on static hosts (S3/CloudFront, Vercel) without any special
// rewrite configuration — the server only ever sees `/`.
//
// Routes:
//   #            → home
//   #/event/:id  → event detail page (id can be slug or numeric)
export function useHashRouter() {
  const [hash, setHash] = useState(window.location.hash || "");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((path) => { window.location.hash = path; }, []);
  const goBack   = useCallback(()      => { window.location.hash = "";   }, []);

  const route = useMemo(() => {
    const m = hash.match(/^#\/event\/(.+)$/);
    if (m) return { page: "event", slug: m[1] };
    return { page: "home" };
  }, [hash]);

  return { route, navigate, goBack };
}
