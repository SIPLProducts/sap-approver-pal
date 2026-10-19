import { Fragment, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, meta, actions, className }: PageHeaderProps) {
  const crumbs = eyebrow ? eyebrow.split(" · ").map((s) => s.trim()).filter(Boolean) : [];
  return (
    <header className={cn("mb-[24px] animate-slide-up", className)}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-[4px] text-[14px] leading-[20px] text-muted-foreground mb-[12px]">
        <Link to="/" aria-label="Home" className="hover:text-foreground transition-colors">
          <Home className="size-[16px]" />
        </Link>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <ChevronRight className="size-[16px]" />
            <span>{c}</span>
          </Fragment>
        ))}
        <ChevronRight className="size-[16px]" />
        <span className="text-foreground">{title}</span>
      </nav>
      <div className="flex items-start justify-between gap-[16px]">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[32px] font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-[16px] leading-[24px] text-muted-foreground mt-[4px]">{subtitle}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;
