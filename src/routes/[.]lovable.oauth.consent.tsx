import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};
type OAuthResp = { data: OAuthDetails | null; error: { message: string } | null };
const oauth = () =>
  (supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<OAuthResp>;
      approveAuthorization: (id: string) => Promise<OAuthResp>;
      denyAuthorization: (id: string) => Promise<OAuthResp>;
    };
  }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: session lives in localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-8">
      <Card className="p-6 max-w-md">
        <h1 className="text-lg font-semibold mb-2">Authorization error</h1>
        <p className="text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </Card>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="p-8 max-w-md w-full space-y-5">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-10" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Connect {clientName} to Resustainability Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {clientName} will be able to call this app's enabled tools while you are signed in.
            This does not bypass this app's permissions or backend policies.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Cancel connection
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
