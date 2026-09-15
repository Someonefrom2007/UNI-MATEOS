// UNI·MATE brand constants — single source of truth for name, tagline, symbol
// geometry and color treatments. Shared by the BrandLogo component, exported
// public assets, index.html meta and manifest. Never redesign the symbol: the
// three translucent diamond layers are the approved mark.
export const BRAND_NAME = "UNI·MATE";
export const BRAND_TAGLINE = "Your university, organized around you.";
export const BRAND_SUBTITLE = "Academic OS";
export const BRAND_DESCRIPTION =
  "Your university, organized around you. The personal academic operating system — installable, offline-first, dark by design.";

export const BRAND_COLORS = {
  cyan: "#22D3EE",
  blue: "#3B82F6",
  indigo: "#6366F1",
  ink: "#050812",
  space: "#07080D",
};

// Approved three-layer geometric symbol (viewBox 0 0 32 40, as in the wordmark).
export const SYMBOL_VIEWBOX = "0 0 32 40";
export const SYMBOL_LAYERS = [
  { points: "16,1 30.5,9.8 16,18.6 1.5,9.8", fill: BRAND_COLORS.cyan, opacity: 0.9 },
  { points: "16,11.5 30.5,20.3 16,29.1 1.5,20.3", fill: BRAND_COLORS.blue, opacity: 0.85 },
  { points: "16,22 30.5,30.8 16,39.6 1.5,30.8", fill: BRAND_COLORS.indigo, opacity: 1 },
];

// Conceptual variants required by the brand directive.
export const BRAND_VARIANTS = ["primary", "compact", "symbol", "gradient", "white", "black"];

export const brandAriaLabel = () => BRAND_NAME;