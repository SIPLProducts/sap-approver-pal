import { createFileRoute } from "@tanstack/react-router";
import { useState, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Mail, Send, Eye, EyeOff, Info, X, Save } from "lucide-react";
import { PageHeader } from "@/components/exec/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/hooks/use-permissions";


export const Route = createFileRoute("/_authenticated/email-config")({
  head: () => ({
    meta: [
      { title: "Email Configuration — Resustainability Approvals" },
      { name: "description", content: "Manage SMTP credentials for outbound emails." },
      { property: "og:title", content: "Email Configuration" },
      { property: "og:description", content: "Manage SMTP credentials for outbound emails." },
    ],
  }),
  component: EmailConfigPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailConfigPage() {
  const { loading: adminLoading, isAdmin: isBuiltinAdmin } = useIsBuiltInAdmin();
  const perms = usePermissions();
  const isSapAdmin = (perms.activeRoleLabel ?? "").trim().toUpperCase() === "ADMIN";
  const allowed = isBuiltinAdmin || isSapAdmin;

  const [enabled, setEnabled] = useState(true);
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState("587");
  const [encryption, setEncryption] = useState("tls");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [testTo, setTestTo] = useState("");

  function commitCc(raw: string) {
    const parts = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const next = [...cc];
    for (const p of parts) if (EMAIL_RE.test(p) && !next.includes(p)) next.push(p);
    setCc(next);
    setCcInput("");
  }

  function onCcKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (ccInput.trim()) commitCc(ccInput);
    } else if (e.key === "Backspace" && !ccInput && cc.length) {
      setCc(cc.slice(0, -1));
    }
  }

  function onSave() {
    toast.success("Configuration saved", { description: "UI-only preview — not persisted." });
  }
  function onTest() {
    if (!testTo || !EMAIL_RE.test(testTo)) {
      toast.error("Enter a valid test recipient email");
      return;
    }
    toast.success(`Test email queued to ${testTo}`, { description: "UI-only preview — nothing was sent." });
  }

  if (adminLoading || perms.loading) {
    return <div className="min-h-[40vh] grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <Alert variant="destructive">
          <AlertDescription>You are not authorized to view this screen.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (

    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={
          <span className="inline-flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Email Configuration
          </span>
        }
        subtitle="Manage SMTP credentials for outbound emails (host, port, sender, app password)."
      />

      <Tabs defaultValue="no-reply" className="space-y-5">
        <TabsList>
          <TabsTrigger value="user" disabled>User SMTP Configuration</TabsTrigger>
          <TabsTrigger value="no-reply">No Reply Email Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="no-reply" className="mt-0">
          <div className="bg-card border border-border rounded-lg shadow-card p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-lg inline-flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                No Reply Email Configuration
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                System sender used for vendor-related notifications (invitations, submission alerts, etc.).
                Vendors do not need their own SMTP credentials — outbound notifications go through this account.
              </p>
            </div>

            {/* Enable toggle panel */}
            <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/40 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Enable No-Reply Sending</div>
                <div className="text-xs text-muted-foreground mt-0.5">When off, system notifications are not sent.</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="host">SMTP Host</Label>
                <Input id="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="port">Port</Label>
                <Input id="port" type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="encryption">Encryption</Label>
                <Select value={encryption} onValueChange={setEncryption}>
                  <SelectTrigger id="encryption"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="ssl">SSL (465)</SelectItem>
                    <SelectItem value="tls">TLS (587)</SelectItem>
                    <SelectItem value="starttls">STARTTLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="email" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@example.com" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">
                  App Password <span className="text-muted-foreground font-normal">(leave empty to keep existing)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="from-email">From Email</Label>
                <Input id="from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="from-name">From Name</Label>
                <Input id="from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cc">CC Recipients <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="min-h-10 flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                  {cc.map((email) => (
                    <span key={email} className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground text-xs font-medium px-2.5 py-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => setCc(cc.filter((e) => e !== email))}
                        className="hover:text-destructive"
                        aria-label={`Remove ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="cc"
                    className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm py-1"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={onCcKey}
                    onBlur={() => ccInput.trim() && commitCc(ccInput)}
                    placeholder={cc.length ? "Add another…" : "name@example.com"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Add one or more emails. Press Enter or comma after each. Every valid address here is CC'd on the buyer notification email. Invalid entries are skipped automatically.
                </p>
              </div>
            </div>

            <Alert className="border-info/30 bg-info/5">
              <Info className="h-4 w-4 text-info" />
              <AlertDescription className="text-sm">
                This account is the <strong>From</strong> address for buyer notifications (e.g. when a vendor submits the registration form). The buyer is on <strong>To</strong>; the addresses listed above are added as <strong>CC</strong>.
              </AlertDescription>
            </Alert>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-2 border-t border-border">
              <div className="space-y-1.5 sm:max-w-sm w-full">
                <Label htmlFor="test-to">Send test to</Label>
                <Input id="test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onTest}>
                  <Send className="h-4 w-4 mr-2" /> Send Test Email
                </Button>
                <Button onClick={onSave}>
                  <Save className="h-4 w-4 mr-2" /> Save Configuration
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
