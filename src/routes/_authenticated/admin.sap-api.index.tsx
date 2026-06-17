import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plug, Plus, Pencil, Trash2, Activity, Loader2, CheckCircle2, AlertCircle, Save, Server, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listSapConfigs, upsertSapConfig, deleteSapConfig, testSapConnection } from "@/lib/admin/sap-api.functions";
import { getSapGlobalSettings, upsertSapGlobalSettings, testGlobalMiddleware, upsertSapConnection, testSapConnectionGlobal } from "@/lib/admin/sap-global.functions";

export const Route = createFileRoute("/_authenticated/admin/sap-api/")({
  component: SapApiListPage,
});

function SapApiListPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Plug className="h-6 w-6" /> SAP API Settings</h1>
        <p className="text-sm text-muted-foreground">Register dynamic SAP/REST endpoints and configure the shared Node.js middleware.</p>
      </header>
      <Tabs defaultValue="apis">
        <TabsList>
          <TabsTrigger value="apis"><Plug className="h-4 w-4 mr-1" /> APIs</TabsTrigger>
          <TabsTrigger value="middleware"><Server className="h-4 w-4 mr-1" /> Middleware Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="apis" className="mt-4"><ApisTab /></TabsContent>
        <TabsContent value="middleware" className="mt-4"><MiddlewareTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ApisTab() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const listFn = useServerFn(listSapConfigs);
  const upsertFn = useServerFn(upsertSapConfig);
  const deleteFn = useServerFn(deleteSapConfig);
  const testFn = useServerFn(testSapConnection);

  const { data, isLoading } = useQuery({ queryKey: ["sap-configs"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", module: "COMMON" as "MM" | "SD" | "COMMON",
    endpoint_url: "", auth_type: "basic" as "basic" | "oauth" | "none" | "proxy",
  });

  async function createNew() {
    if (!form.name || !form.endpoint_url) return toast.error("Name and endpoint URL are required");
    try {
      const res = await upsertFn({ data: {
        name: form.name, description: form.description, module: form.module,
        endpoint_url: form.endpoint_url, http_method: "GET", auth_type: form.auth_type,
        api_type: "fetch", auto_sync_enabled: false, is_active: true,
      } as any });
      toast.success("Endpoint created");
      setOpen(false);
      nav({ to: "/admin/sap-api/$id", params: { id: res.config.id } });
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete endpoint "${name}"?`)) return;
    try { await deleteFn({ data: { id } }); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["sap-configs"] }); }
    catch (e: any) { toast.error(e.message); }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const r = await testFn({ data: { id } });
      r.ok ? toast.success(`OK — ${r.message} (${r.latency_ms}ms)`) : toast.error(`${r.message} (${r.latency_ms}ms)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New endpoint</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register a new SAP endpoint</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. PR_GET" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Module</Label>
                  <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM">MM</SelectItem>
                      <SelectItem value="SD">SD</SelectItem>
                      <SelectItem value="COMMON">Common</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Auth type</Label>
                  <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="oauth">OAuth</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="proxy">Proxy / Middleware</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Endpoint URL</Label><Input value={form.endpoint_url} onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })} placeholder="https://sap-gw.example.com/api/..." /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={createNew}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></Card>
      ) : data?.configs.length === 0 ? (
        <Card className="p-12 text-center">
          <Plug className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No endpoints yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click "New endpoint" to register the first SAP REST endpoint.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.configs.map((c: any) => (
            <Card key={c.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{c.description || c.endpoint_url}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{c.module}</Badge>
                  <Badge variant="outline" className="text-[10px]">{c.auth_type}</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {c.is_active ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3 text-amber-600" />}
                {c.last_synced_at ? `Last synced ${new Date(c.last_synced_at).toLocaleString()}` : "Never synced"}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Link to="/admin/sap-api/$id" params={{ id: c.id }}>
                  <Button size="sm" variant="outline"><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => handleTest(c.id)} disabled={testing === c.id}>
                  {testing === c.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />} Test
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id, c.name)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MiddlewareTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSapGlobalSettings);
  const saveFn = useServerFn(upsertSapGlobalSettings);
  const testFn = useServerFn(testGlobalMiddleware);
  const { data, isLoading } = useQuery({ queryKey: ["sap-global-settings"], queryFn: () => getFn() });

  const [form, setForm] = useState({
    connection_mode: "direct" as "direct" | "via_proxy",
    deployment_mode: "lovable_cloud" as "lovable_cloud" | "self_hosted",
    middleware_port: 3002,
    middleware_url: "",
    proxy_secret: "",
  });
  const [secretSet, setSecretSet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm({
        connection_mode: (data.settings.connection_mode as any) ?? "direct",
        deployment_mode: (data.settings.deployment_mode as any) ?? "lovable_cloud",
        middleware_port: data.settings.middleware_port ?? 3002,
        middleware_url: data.settings.middleware_url ?? "",
        proxy_secret: "",
      });
      setSecretSet(!!data.proxy_secret_set);
    }
  }, [data]);

  const proxy = form.connection_mode === "via_proxy";

  async function save() {
    setBusy(true);
    try {
      await saveFn({ data: {
        connection_mode: form.connection_mode,
        deployment_mode: form.deployment_mode,
        middleware_port: form.middleware_port,
        middleware_url: form.middleware_url || null,
        proxy_secret: form.proxy_secret || null,
      } });
      toast.success("Middleware settings saved");
      setForm((f) => ({ ...f, proxy_secret: "" }));
      setSecretSet((s) => s || !!form.proxy_secret);
      qc.invalidateQueries({ queryKey: ["sap-global-settings"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function runTest() {
    setTesting(true);
    try {
      const r = await testFn();
      r.ok ? toast.success(`OK — ${r.message} (${r.latency_ms}ms)`) : toast.error(`${r.message} (${r.latency_ms}ms)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  }

  if (isLoading) return <Card className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></Card>;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Server className="h-4 w-4" /> Node.js Middleware</h2>
          <p className="text-xs text-muted-foreground mt-1">These settings are shared by every SAP API integration whose Auth Type is set to Proxy / Middleware.</p>
        </div>
        <Button variant="outline" onClick={runTest} disabled={testing || !form.middleware_url}>
          {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Activity className="h-4 w-4 mr-1" />} Test middleware
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Connection Mode</Label>
          <Select value={form.connection_mode} onValueChange={(v) => setForm({ ...form, connection_mode: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="via_proxy">Via Proxy Server</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Deployment Mode</Label>
          <Select value={form.deployment_mode} onValueChange={(v) => setForm({ ...form, deployment_mode: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lovable_cloud">Lovable Cloud</SelectItem>
              <SelectItem value="self_hosted">Self-hosted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Middleware Port</Label>
          <Input type="number" value={form.middleware_port} onChange={(e) => setForm({ ...form, middleware_port: Number(e.target.value) || 0 })} placeholder="3002" />
        </div>
        <div>
          <Label>Node.js Middleware URL {proxy && <span className="text-destructive">*</span>}</Label>
          <Input value={form.middleware_url} onChange={(e) => setForm({ ...form, middleware_url: e.target.value })} placeholder="https://your-middleware.example.com" />
        </div>
        <div className="sm:col-span-2">
          <Label>
            Proxy Secret / Password {proxy && <span className="text-destructive">*</span>}
            {secretSet && <Badge variant="secondary" className="ml-2 text-[10px]">set</Badge>}
          </Label>
          <Input
            type="password"
            value={form.proxy_secret}
            onChange={(e) => setForm({ ...form, proxy_secret: e.target.value })}
            placeholder={secretSet ? "•••••••• (leave blank to keep)" : "Enter shared secret"}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save middleware settings
        </Button>
      </div>
    </Card>
  );
}
