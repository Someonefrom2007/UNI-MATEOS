// Deep-link highlighting for list pages.
//
// Search results point at `?highlight=<id>` on pages that show a flat list. The
// page scrolls the row into view and rings it briefly, then clears the
// parameter so a refresh or back-navigation does not re-trigger the animation.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

// How long the ring stays visible once the row is found, and how long we keep
// looking before giving up on an id that never renders.
const RING_MS = 2200;
const DEADLINE_MS = 4000;

export const useHighlightRow = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [active, setActive] = useState(highlightId);
  const refs = useRef({});
  const target = useRef(highlightId);
  const revealed = useRef(false);
  const ringTimer = useRef(null);

  const clear = useCallback(() => {
    target.current = null;
    setActive(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("highlight");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const reveal = useCallback((id) => {
    const el = refs.current[id];
    if (!el || revealed.current) return;
    revealed.current = true;
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    ringTimer.current = setTimeout(clear, RING_MS);
  }, [clear]);

  // Rows register themselves, so the reveal is driven by the row appearing
  // rather than by the URL alone. On a cold load the list is still behind its
  // loading branch when the effect runs and the target only mounts a tick
  // later; subscribing here is what makes the scroll actually happen.
  const register = useCallback((id) => (el) => {
    if (!el) {
      delete refs.current[id];
      return;
    }
    refs.current[id] = el;
    if (target.current === id) reveal(id);
  }, [reveal]);

  useEffect(() => {
    if (!highlightId) return;
    target.current = highlightId;
    revealed.current = false;
    setActive(highlightId);
    reveal(highlightId);

    // A row can fail to appear (deleted, filtered out of the current tab, or an
    // id from a stale link). Clearing anyway stops the parameter from sticking.
    const deadline = setTimeout(() => {
      if (target.current) clear();
    }, DEADLINE_MS);

    return () => {
      clearTimeout(deadline);
      if (ringTimer.current) {
        clearTimeout(ringTimer.current);
        ringTimer.current = null;
      }
    };
  }, [highlightId, reveal, clear]);

  return { highlightId: active, register };
};

export const highlightRing = (isActive) =>
  isActive ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : "";