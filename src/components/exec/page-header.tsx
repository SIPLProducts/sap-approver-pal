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
    <header className={cn("mb-6 animate-slide-up", className)}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground mb-3">
        <Link to="/" aria-label="Home" className="hover:text-foreground transition-colors">
          <Home className="w-4 h-4" />
        </Link>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <ChevronRight className="w-4 h-4" />
            <span>{c}</span>
          </Fragment>
        ))}
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{title}</span>
      </nav>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;
