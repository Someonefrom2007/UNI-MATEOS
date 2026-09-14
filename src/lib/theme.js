// Theme + accent persistence — applied before the app renders (see main.jsx).

export const ACCENT_PRESETS = {
  indigo: { label: "Indigo", swatch: "bg-indigo-400", dark: "239 84% 67%", light: "243 75% 59%" },
  cyan: { label: "Cyan", swatch: "bg-cyan-400", dark: "187 75% 55%", light: "190 80% 42%" },
  violet: { label: "Violet", swatch: "bg-violet-400", dark: "262 83% 66%", light: "262 83% 55%" },
  emerald: { label: "Emerald", swatch: "bg-emerald-400", dark: "152 65% 52%", light: "152 65% 40%" },
  rose: { label: "Rose", swatch: "bg-rose-400", dark: "350 84% 62%", light: "350 84% 50%" },
  blue: { label: "Blue", swatch: "bg-blue-400", dark: "217 91% 62%", light: "217 91% 50%" },
};

const isLight = () => document.documentElement.classList.contains("light");

export const applyAccent = (key) => {
  const a = ACCENT_PRESETS[key] || ACCENT_PRESETS.indigo;
  const hsl = isLight() ? a.light : a.dark;
  const root = document.documentElement.style;
  root.setProperty("--primary", hsl);
  root.setProperty("--ring", hsl);
  root.setProperty("--sidebar-primary", hsl);
  root.setProperty("--sidebar-ring", hsl);
  localStorage.setItem("um-accent", key);
};

export const applyTheme = (mode) => {
  const light = mode === "light" || (mode === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("light", light);
  // One-time migration: the brand default moved from amber to indigo (2026 rebrand).
  if (localStorage.getItem("um-accent-v") !== "2") {
    localStorage.setItem("um-accent-v", "2");
    const stored = localStorage.getItem("um-accent");
    if (!stored || stored === "amber") localStorage.setItem("um-accent", "indigo");
  }
  applyAccent(localStorage.getItem("um-accent") || "indigo");
};

export const initTheme = () => {
  applyTheme(localStorage.getItem("um-theme") || "dark");
};