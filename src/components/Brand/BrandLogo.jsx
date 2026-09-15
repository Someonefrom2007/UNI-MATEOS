import { useId } from "react";
import { BRAND_NAME, BRAND_SUBTITLE, BRAND_COLORS, SYMBOL_VIEWBOX, SYMBOL_LAYERS, brandAriaLabel } from "@/components/Brand/brand";

const GRADIENT_STOPS = [
  { offset: "0%", color: BRAND_COLORS.cyan },
  { offset: "50%", color: BRAND_COLORS.blue },
  { offset: "100%", color: BRAND_COLORS.indigo },
];

const variantLayers = (variant) => {
  switch (variant) {
    case "white":
      return SYMBOL_LAYERS.map((l, i) => ({ ...l, fill: "#FFFFFF", opacity: [0.95, 0.85, 1][i] }));
    case "black":
      return SYMBOL_LAYERS.map((l, i) => ({ ...l, fill: "#0B0D14", opacity: [0.9, 0.94, 1][i] }));
    default:
      return SYMBOL_LAYERS;
  }
};

const textColorClass = (variant) => {
  if (variant === "white") return "text-white";
  if (variant === "black") return "text-[#0B0D14]";
  return "";
};

// UNI·MATE brand mark — the approved three-layer diamond symbol with wordmark.
// Variants: primary (default), compact, symbol, gradient, white, black.
export default function BrandLogo({
  variant = "primary",
  size = 34,
  showText = true,
  subtext = true,
  className = "",
  ariaLabel = brandAriaLabel(),
} = {}) {
  const gradientId = useId();
  const layers = variantLayers(variant);
  const textOnly = variant === "symbol" || !showText;
  const useGradient = variant === "gradient";
  const compact = variant === "compact";

  return (
    <span
      className={`inline-flex items-center ${compact ? "gap-2" : "gap-2.5"} ${className}`}
      role={textOnly ? "img" : undefined}
      aria-label={textOnly ? ariaLabel : undefined}
    >
      <svg
        width={size}
        height={size * 1.25}
        viewBox={SYMBOL_VIEWBOX}
        fill="none"
        className="shrink-0"
        aria-hidden={textOnly ? undefined : true}
      >
        {useGradient && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {GRADIENT_STOPS.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
        )}
        {layers.map((layer, i) => (
          <polygon key={i} points={layer.points} fill={useGradient ? `url(#${gradientId})` : layer.fill} fillOpacity={layer.opacity} />
        ))}
      </svg>
      {!textOnly && (
        <span className={`leading-none ${textColorClass(variant)}`}>
          <span
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: Math.max(14, Math.round(size * 0.45)) }}
          >
            {BRAND_NAME}
          </span>
          {subtext && !compact && (
            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {BRAND_SUBTITLE}
            </span>
          )}
        </span>
      )}
    </span>
  );
}