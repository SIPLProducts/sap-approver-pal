import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Copy, ExternalLink } from "lucide-react";
import {
  getIntegrationStatus,
  testSapConnection,
  sendTestPush,
} from "@/lib/admin/integrations.functions";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  component: IntegrationsPage,
});

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600">
      <Check className="w-3 h-3" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/15 text-rose-600">
      <X className="w-3 h-3" />
    </span>
  );
}

function Row({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusDot ok={ok} />
        <div>
          <div className="text-sm font-medium">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <Badge variant={ok ? "secondary" : "outline"}>{ok ? "Set" : "Missing"}</Badge>
    </div>
  );
}

function IntegrationsPage() {
  const statusFn = useServerFn(getIntegrationStatus);
  const sapTestFn = useServerFn(testSapConnection);
  const pushTestFn = useServerFn(sendTestPush);
  const [testing, setTesting] = useState<"sap" | "push" | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => statusFn(),
  });

  async function runSapTest() {
    setTesting("sap");
    try {
      const r = await sapTestFn();
      r.ok ? toast.success(r.message) : toast.error(r.message);
    } finally {
      setTesting(null);
    }
  }

  async function runPushTest() {
    setTesting("push");
    try {
      const r = await pushTestFn({ data: {} });
      toast.success(`Push attempt: ${r.sent} sent, ${r.removed} stale removed`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(null);
    }
  }

  function copy(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  }

  if (isLoading || !data) {
    return <Card className="p-8 text-center text-muted-foreground">Loading…</Card>;
  }

  const cronUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/hooks/sap-sync`;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Configure SAP Gateway and Web Push. Secret values are entered in <b>View Backend → Secrets</b>;
          this page only shows whether each one is present.
        </p>
      </div>

      {/* SAP */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">SAP Gateway (Z REST wrapper)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live mode is enabled when <code>SAP_USE_REAL=true</code> AND base URL + technical user are set.
              Otherwise the app uses mock data.
            </p>
          </div>
          <Badge variant={data.sap.liveMode ? "secondary" : "outline"}>
            {data.sap.liveMode ? "LIVE" : "MOCK"}
          </Badge>
        </div>
        <div className="rounded-md border p-4">
          <Row label="SAP_BASE_URL" ok={data.sap.baseUrlSet} hint="e.g. https://sap-gw.resustainability.in" />
          <Row label="SAP_USER" ok={data.sap.userSet} hint="Technical user for Basic auth" />
          <Row label="SAP_PASSWORD" ok={data.sap.passwordSet} />
          <Row label={`SAP_USE_REAL = "${data.sap.useRealFlag}"`} ok={data.sap.useRealFlag === "true"} hint='Set to "true" to flip from mock to live' />
        </div>
        <div className="flex gap-2">
          <Button onClick={runSapTest} disabled={testing === "sap" || !data.sap.configured}>
            {testing === "sap" ? "Testing…" : "Test SAP connection"}
          </Button>
          <Button variant="outline" onClick={() => refetch()}>Refresh status</Button>
        </div>
      </Card>

      {/* Push */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Web Push (VAPID)</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Required for real-time push notifications on desktop and installed PWA. The public key
            is shipped to the browser; the private key never leaves the server.
          </p>
        </div>
        <div className="rounded-md border p-4">
          <Row label="VAPID_PUBLIC_KEY" ok={data.push.publicKeySet} />
          <Row label="VAPID_PRIVATE_KEY" ok={data.push.privateKeySet} />
          <Row label="VAPID_SUBJECT" ok={data.push.subjectSet} hint="mailto:ops@resustainability.in" />
        </div>
        {data.push.publicKey && (
          <div className="text-xs">
            <div className="text-muted-foreground mb-1">Current public key (safe to share):</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1">{data.push.publicKey}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(data.push.publicKey)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        <Button onClick={runPushTest} disabled={testing === "push" || !data.push.privateKeySet}>
          {testing === "push" ? "Sending…" : "Send test push to myself"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Don't have keys? Generate a pair on any machine with{" "}
          <code>npx web-push generate-vapid-keys</code> and paste them as secrets.
        </p>
      </Card>

      {/* Cron */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Scheduled SAP sync</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Once SAP is live, point pg_cron (or any scheduler) at the endpoint below every few minutes.
            Requests must include the <code>x-cron-secret</code> header.
          </p>
        </div>
        <div className="rounded-md border p-4">
          <Row label="CRON_SECRET" ok={data.cron.secretSet} hint="Any long random string; shared with the scheduler" />
        </div>
        <div className="text-xs">
          <div className="text-muted-foreground mb-1">Endpoint:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1">{cronUrl}</code>
            <Button size="sm" variant="ghost" onClick={() => copy(cronUrl)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <a
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          href="https://supabase.com/docs/guides/database/extensions/pg_cron"
          target="_blank"
          rel="noreferrer"
        >
          pg_cron docs <ExternalLink className="w-3 h-3" />
        </a>
      </Card>
    </div>
  );
}
