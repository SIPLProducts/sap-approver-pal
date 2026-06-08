import logo from "@/assets/resl-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Render only the mark area (square crop) — useful for tight spots */
  compact?: boolean;
  /** Optional override alt text */
  alt?: string;
};

/**
 * Resustainability brand logo.
 * Uses the CDN-hosted official mark + wordmark.
 */
export function BrandLogo({ className, compact = false, alt = "Resustainability" }: Props) {
  return (
    <img
      src={logo.url}
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
