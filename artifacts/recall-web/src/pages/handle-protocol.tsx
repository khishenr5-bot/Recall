import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Handles web+recall://… deep links.
 * Format examples:
 *   web+recall://save?url=https://example.com   →  /share-target?url=…
 *   web+recall://voice                          →  /?action=voice
 *   web+recall://research?q=foo                 →  /?action=research&q=foo
 *   web+recall://library                        →  /saved
 */
export default function HandleProtocol() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("url") || "";
    let target = "/";

    try {
      const cleaned = raw.replace(/^web\+recall:\/?\/?/, "");
      const [pathPart, queryPart] = cleaned.split("?");
      const sub = new URLSearchParams(queryPart || "");
      const path = (pathPart || "").toLowerCase().trim();

      if (path === "save") {
        const url = sub.get("url") || "";
        target = url ? `/share-target?url=${encodeURIComponent(url)}` : "/?action=save";
      } else if (path === "voice") {
        target = "/?action=voice";
      } else if (path === "research") {
        const q = sub.get("q") || "";
        target = q ? `/?action=research&q=${encodeURIComponent(q)}` : "/?action=research";
      } else if (path === "library") {
        target = "/saved";
      } else if (raw.startsWith("http")) {
        target = `/share-target?url=${encodeURIComponent(raw)}`;
      }
    } catch {}

    navigate(target);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Opening Recall…
    </div>
  );
}
