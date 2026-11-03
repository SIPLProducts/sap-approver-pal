import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Kept for compatibility; no longer displayed. */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-[24px] animate-slide-up", className)}>
      <div className="flex items-start justify-between gap-[16px]">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[36px] font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && (
            <p
              className="mt-[4px] truncate text-[16px] leading-[24px] font-normal text-muted-foreground"
              title={typeof subtitle === "string" ? subtitle : undefined}
            >
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;
