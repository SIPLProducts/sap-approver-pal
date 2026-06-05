import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inbox/")({
  beforeLoad: () => { throw redirect({ to: "/inbox/$module", params: { module: "mm" } }); },
});
