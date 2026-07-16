import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mm/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/inbox/$module", params: { module: "mm" } });
  },
});
