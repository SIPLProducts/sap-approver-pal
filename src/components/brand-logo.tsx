import logo from "@/assets/resl-logo.png.asset.json";
import logoTransparent from "@/assets/resl-logo-transparent.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Render only the mark area (square crop) — useful for tight spots */
  compact?: boolean;
  /** Optional override alt text */
  alt?: string;
  /** "transparent" removes the white plate — use on dark/glass surfaces */
  variant?: "default" | "transparent";
};

/**
 * Resustainability brand logo.
 * Uses the CDN-hosted official mark + wordmark.
 */
export function BrandLogo({
  className,
  compact = false,
  alt = "Resustainability",
  variant = "default",
}: Props) {
  return (
    <img
      src={variant === "transparent" ? logoTransparent.url : logo.url}
      alt={alt}
      draggable={false}
      className={cn(
        "select-none object-contain",
        compact ? "h-8 w-8" : "h-9 w-auto",
        className,
      )}
    />
  );
}


export default BrandLogo;
