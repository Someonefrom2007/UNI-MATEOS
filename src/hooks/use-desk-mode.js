import { useState, useEffect } from "react";

const KEY = "um-desk-mode";
const EVT = "unimate:desk-mode";

// Global TIDY DESK / CHAOS MODE shared across views. Reading and writing
// localStorage keeps the preference across navigations; a window event lets
// one screen's toggle live-update every other mounted screen.
export const useDeskMode = () => {
  const [chaos, setChaos] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "chaos";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onExternal = (e) => setChaos(Boolean(e.detail));
    window.addEventListener(EVT, onExternal);
    return () => window.removeEventListener(EVT, onExternal);
  }, []);

  const toggle = () => {
    setChaos((c) => {
      const next = !c;
      try {
        localStorage.setItem(KEY, next ? "chaos" : "tidy");
      } catch {
        // storage unavailable — mode still applies for this session
      }
      window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
      return next;
    });
  };

  return { chaos, toggle };
};