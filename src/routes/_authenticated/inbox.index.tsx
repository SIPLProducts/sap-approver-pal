import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { resolveLandingTarget } from "@/lib/landing-target";

export const Route = createFileRoute("/_authenticated/inbox/")({
  component: InboxEntry,
});

function InboxEntry() {
  const perms = usePermissions();
  const nav = useNavigate();

  useEffect(() => {
    if (perms.loading) return;
    const target = resolveLandingTarget(perms.can);
    nav({ to: target.to, params: target.params as never, replace: true });
  }, [perms.loading, perms.allowedScreens, perms.can, nav]);

  return <div className="min-h-[40vh] grid place-items-center text-muted-foreground">Loading…</div>;
}
