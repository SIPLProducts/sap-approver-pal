import { cn } from "@/lib/utils";

const logoUrl = "/re-sustainability-logo.jpg";

type Props = {
  className?: string;
  /** Render only the mark area (square crop) — useful for tight spots */
  compact?: boolean;
  /** Optional override alt text */
  alt?: string;
};

/**
 * Resustainability brand logo.
 * Uses a packaged public asset so the mark also works on private self-hosts.
 */
export function BrandLogo({ className, compact = false, alt = "Resustainability" }: Props) {
  return (
    <img
      src={logoUrl}
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
