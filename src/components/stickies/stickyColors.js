// Shared sticky-note palette — literal class strings so Tailwind keeps them.

export const COLOR_KEYS = ["amber", "cyan", "violet", "emerald", "rose", "blue"];

export const STICKY_BG = {
  amber: "bg-amber-200/95 text-amber-950",
  cyan: "bg-cyan-200/95 text-cyan-950",
  violet: "bg-violet-200/95 text-violet-950",
  emerald: "bg-emerald-200/95 text-emerald-950",
  rose: "bg-rose-200/95 text-rose-950",
  blue: "bg-blue-200/95 text-blue-950",
};

export const STICKY_DOT = {
  amber: "bg-amber-300",
  cyan: "bg-cyan-300",
  violet: "bg-violet-300",
  emerald: "bg-emerald-300",
  rose: "bg-rose-300",
  blue: "bg-blue-300",
};

export const randomRotation = () => Math.round((Math.random() * 4 - 2) * 10) / 10;