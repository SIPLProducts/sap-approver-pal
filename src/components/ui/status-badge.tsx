import { ReactNode } from "react";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Info, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "pending" | "error" | "warning" | "info" | "neutral";

const TONES: Record<StatusTone, { className: string; icon: ReactNode }> = {
  success: {
    className: "border-success/30 bg-success/10 text-success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  },
  pending: {
    className: "border-warning/40 bg-warning/10 text-warning-foreground",
    icon: <Clock className="h-3.5 w-3.5" aria-hidden />,
  },
  error: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: <XCircle className="h-3.5 w-3.5" aria-hidden />,
  },
  warning: {
    className: "border-warning/40 bg-warning/10 text-warning-foreground",
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  },
  info: {
    className: "border-info/30 bg-info/10 text-info",
    icon: <Info className="h-3.5 w-3.5" aria-hidden />,
  },
  neutral: {
    className: "border-border bg-muted text-muted-foreground",
    icon: <CornerUpLeft className="h-3.5 w-3.5" aria-hidden />,
  },
};

/** Map common SAP / app status strings onto a tone. */
export function statusTone(status?: string | null): StatusTone {
  const s = (status ?? "").toLowerCase();
  if (!s) return "neutral";
  if (/(approved|released|success|complete|posted|active|ok)/.test(s)) return "success";
  if (/(rejected|failed|error|cancel|blocked|inactive)/.test(s)) return "error";
  if (/(pending|awaiting|in progress|open)/.test(s)) return "pending";
  if (/(warning|hold|partial)/.test(s)) return "warning";
  if (/(sent.?back|returned)/.test(s)) return "neutral";
  return "info";
}

interface StatusBadgeProps {
  /** Raw status value; the tone is derived from it unless `tone` is given. */
  status?: string | null;
  tone?: StatusTone;
  label?: ReactNode;
  className?: string;
}

/**
 * Status indicator that always pairs colour with an icon and a text label,
 * so it stays readable without relying on colour alone.
 */
export function StatusBadge({ status, tone, label, className }: StatusBadgeProps) {
  const t = tone ?? statusTone(status);
  const { className: toneClass, icon } = TONES[t];
  const text = label ?? (status ? String(status) : "Unknown");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass,
        className,
      )}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}

export default StatusBadge;
