import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "gold" | "primary" | "info" | "success" | "warning" | "destructive";
  lead?: boolean;
  className?: string;
}

const accentBar: Record<NonNullable<KpiTileProps["accent"]>, string> = {
  gold: "bg-gradient-gold",
  primary: "bg-gradient-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function KpiTile({ label, value, delta, sub, icon, accent = "primary", lead = false, className }: KpiTileProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 sm:p-5 shadow-card transition-shadow hover:shadow-elegant",
        lead && "ring-1 ring-gold/40",
        className,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", accentBar[accent])} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-display text-3xl sm:text-[34px] font-semibold tracking-tight tabular-nums leading-none">{value}</div>
        {delta && (
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              delta.trend === "up" && "text-success",
              delta.trend === "down" && "text-destructive",
              delta.trend === "flat" && "text-muted-foreground",
            )}
          >
            {delta.trend === "up" ? "▲" : delta.trend === "down" ? "▼" : "—"} {delta.value}
          </span>
        )}
      </div>
      {sub && <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default KpiTile;
