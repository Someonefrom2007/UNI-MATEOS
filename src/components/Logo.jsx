import BrandLogo from "@/components/Brand/BrandLogo";

// Backward-compatible wrapper for the centralized brand component.
// `variant` defaults to the classic multicolor wordmark; every existing
// <Logo size showText subtext className .../> usage keeps working unchanged.
export default function Logo(props) {
  return <BrandLogo {...props} />;
}