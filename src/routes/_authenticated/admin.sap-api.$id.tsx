import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, Plus, Trash2, Activity, Loader2, GripVertical, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getSapConfig, upsertSapConfig, replaceRequestFields, replaceResponseFields,
  upsertCredentials, testSapConnection,
} from "@/lib/admin/sap-api.functions";

export const Route = createFileRoute("/_authenticated/admin/sap-api/$id")({
  component: SapApiEditPage,
});

type ReqRow = { field_name: string; source: "static"|"column"|"expr"|"secret"; default_value: string; required: boolean; sort_order: number };
type ResRow = { field_name: string; target_table: string; target_column: string; transform_expr: string; sort_order: number };

function SapApiEditPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getSapConfig);
  const saveFn = useServerFn(upsertSapConfig);
  const saveReqFn = useServerFn(replaceRequestFields);
  const saveResFn = useServerFn(replaceResponseFields);
  const saveCredsFn = useServerFn(upsertCredentials);
  const testFn = useServerFn(testSapConnection);

  const { data, isLoading } = useQuery({ queryKey: ["sap-config", id], queryFn: () => getFn({ data: { id } }) });
  const [cfg, setCfg] = useState<any>(null);
  const [reqRows, setReqRows] = useState<ReqRow[]>([]);
  const [resRows, setResRows] = useState<ResRow[]>([]);
  const [creds, setCreds] = useState({ username: "", password: "", extra_headers: "{}", passwordSet: false });
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency_ms: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setCfg(data.config);
      setReqRows(data.requestFields.map((r: any) => ({ ...r })));
      setResRows(data.responseFields.map((r: any) => ({ ...r })));
      setCreds({
        username: data.credentials.username ?? "",
        password: "",
        extra_headers: JSON.stringify(data.credentials.extra_headers ?? {}, null, 2),
        passwordSet: data.credentials.password_set,
      });
    }
  }, [data]);

  if (isLoading || !cfg) return <Card className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></Card>;

  async function saveDetails() {
    setBusy(true);
    try {
      await saveFn({ data: {
        id: cfg.id, name: cfg.name, description: cfg.description, module: cfg.module,
        endpoint_url: cfg.endpoint_url, http_method: cfg.http_method, auth_type: cfg.auth_type,
        middleware_url: cfg.middleware_url, proxy_secret_ref: cfg.proxy_secret_ref,
        api_type: cfg.api_type, auto_sync_enabled: cfg.auto_sync_enabled,
        schedule_cron: cfg.schedule_cron, is_active: cfg.is_active,
      } });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["sap-config", id] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function saveRequest() {
    setBusy(true);
    try {
      await saveReqFn({ data: { config_id: id, fields: reqRows.map((r, i) => ({ ...r, sort_order: i })) } });
      toast.success("Request fields saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function saveResponse() {
    setBusy(true);
    try {
      await saveResFn({ data: { config_id: id, fields: resRows.map((r, i) => ({ ...r, sort_order: i })) } });
      toast.success("Response fields saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function saveCredentials() {
    setBusy(true);
    let headers: Record<string, string> = {};
    try { headers = JSON.parse(creds.extra_headers || "{}"); }
    catch { setBusy(false); return toast.error("Extra headers must be valid JSON"); }
    try {
      await saveCredsFn({ data: { config_id: id, username: creds.username, password: creds.password || undefined, extra_headers: headers } });
      toast.success("Credentials saved");
      setCreds({ ...creds, password: "", passwordSet: !!creds.password || creds.passwordSet });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function runTest() {
    setBusy(true); setTestResult(null);
    try { const r = await testFn({ data: { id } }); setTestResult(r); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/admin/sap-api"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
          <h1 className="text-xl font-bold">{cfg.name}</h1>
          <Badge variant="secondary">{cfg.module}</Badge>
        </div>
        <Button onClick={runTest} disabled={busy} variant="outline">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Activity className="h-4 w-4 mr-1" />} Test connection
        </Button>
      </div>

      {testResult && (
        <Card className={`p-3 flex items-center gap-2 text-sm ${testResult.ok ? "border-emerald-500/50" : "border-destructive/50"}`}>
          {testResult.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
          <span>{testResult.message}</span>
          <span className="text-muted-foreground ml-auto">{testResult.latency_ms} ms</span>
        </Card>
      )}

      <Tabs defaultValue="details">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
        </TabsList>

        {/* DETAILS */}
        <TabsContent value="details">
          <Card className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} /></div>
              <div><Label>Module</Label>
                <Select value={cfg.module} onValueChange={(v) => setCfg({ ...cfg, module: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MM">MM</SelectItem><SelectItem value="SD">SD</SelectItem><SelectItem value="COMMON">Common</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea value={cfg.description ?? ""} onChange={(e) => setCfg({ ...cfg, description: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Endpoint URL</Label><Input value={cfg.endpoint_url} onChange={(e) => setCfg({ ...cfg, endpoint_url: e.target.value })} /></div>
              <div><Label>HTTP method</Label>
                <Select value={cfg.http_method} onValueChange={(v) => setCfg({ ...cfg, http_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["GET","POST","PUT","PATCH","DELETE","HEAD"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Auth type</Label>
                <Select value={cfg.auth_type} onValueChange={(v) => setCfg({ ...cfg, auth_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["basic","oauth","none","proxy"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>API type</Label>
                <Select value={cfg.api_type} onValueChange={(v) => setCfg({ ...cfg, api_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sync">sync (store locally)</SelectItem><SelectItem value="fetch">fetch (live pass-through)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2"><Switch checked={cfg.is_active} onCheckedChange={(v) => setCfg({ ...cfg, is_active: v })} /><Label>Active</Label></div>
              {cfg.auth_type === "proxy" && (
                <>
                  <div className="sm:col-span-2"><Label>Middleware URL <span className="text-destructive">*</span></Label><Input value={cfg.middleware_url ?? ""} onChange={(e) => setCfg({ ...cfg, middleware_url: e.target.value })} placeholder="https://your-middleware/relay" /></div>
                  <div className="sm:col-span-2"><Label>Proxy secret name <span className="text-destructive">*</span></Label><Input value={cfg.proxy_secret_ref ?? ""} onChange={(e) => setCfg({ ...cfg, proxy_secret_ref: e.target.value })} placeholder="MIDDLEWARE_SHARED_SECRET" /><p className="text-xs text-muted-foreground mt-1">Name of the Lovable Cloud secret holding the middleware shared secret. Set it in Backend → Secrets.</p></div>
                </>
              )}
            </div>
            <Button onClick={saveDetails} disabled={busy}><Save className="h-4 w-4 mr-2" /> Save details</Button>
          </Card>
        </TabsContent>

        {/* REQUEST FIELDS */}
        <TabsContent value="request">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Configure how request payload fields are built.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setReqRows([...reqRows, { field_name: "", source: "static", default_value: "", required: false, sort_order: reqRows.length }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add row
                </Button>
                <Button size="sm" onClick={saveRequest} disabled={busy}><Save className="h-4 w-4 mr-1" /> Save</Button>
              </div>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Field</TableHead><TableHead>Source</TableHead><TableHead>Default</TableHead><TableHead>Required</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {reqRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground"><GripVertical className="h-4 w-4" /></TableCell>
                      <TableCell><Input value={r.field_name} onChange={(e) => { const c = [...reqRows]; c[i].field_name = e.target.value; setReqRows(c); }} /></TableCell>
                      <TableCell>
                        <Select value={r.source} onValueChange={(v) => { const c = [...reqRows]; c[i].source = v as any; setReqRows(c); }}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{["static","column","expr","secret"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input value={r.default_value ?? ""} onChange={(e) => { const c = [...reqRows]; c[i].default_value = e.target.value; setReqRows(c); }} /></TableCell>
                      <TableCell><Switch checked={r.required} onCheckedChange={(v) => { const c = [...reqRows]; c[i].required = v; setReqRows(c); }} /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" className="text-destructive" onClick={() => setReqRows(reqRows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {reqRows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No request fields.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* RESPONSE FIELDS */}
        <TabsContent value="response">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Map response fields to local table columns for sync.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setResRows([...resRows, { field_name: "", target_table: "", target_column: "", transform_expr: "", sort_order: resRows.length }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add row
                </Button>
                <Button size="sm" onClick={saveResponse} disabled={busy}><Save className="h-4 w-4 mr-1" /> Save</Button>
              </div>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>SAP field</TableHead><TableHead>Target table</TableHead><TableHead>Target column</TableHead><TableHead>Transform</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {resRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={r.field_name} onChange={(e) => { const c = [...resRows]; c[i].field_name = e.target.value; setResRows(c); }} /></TableCell>
                      <TableCell><Input value={r.target_table ?? ""} onChange={(e) => { const c = [...resRows]; c[i].target_table = e.target.value; setResRows(c); }} /></TableCell>
                      <TableCell><Input value={r.target_column ?? ""} onChange={(e) => { const c = [...resRows]; c[i].target_column = e.target.value; setResRows(c); }} /></TableCell>
                      <TableCell><Input value={r.transform_expr ?? ""} onChange={(e) => { const c = [...resRows]; c[i].transform_expr = e.target.value; setResRows(c); }} placeholder="e.g. toUpper($)" /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" className="text-destructive" onClick={() => setResRows(resRows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {resRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No response mappings.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* CREDENTIALS */}
        <TabsContent value="credentials">
          <Card className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Username</Label><Input value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} /></div>
              <div>
                <Label>Password {creds.passwordSet && <Badge variant="secondary" className="ml-2 text-[10px]">set</Badge>}</Label>
                <Input type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} placeholder={creds.passwordSet ? "•••••••• (leave blank to keep)" : "Enter password"} />
              </div>
              <div className="sm:col-span-2">
                <Label>Extra headers (JSON)</Label>
                <Textarea rows={6} value={creds.extra_headers} onChange={(e) => setCreds({ ...creds, extra_headers: e.target.value })} className="font-mono text-xs" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Credentials are stored in a service-role-only table and are never returned to the client. v1 stores values as-provided; Vault encryption is a follow-up.</p>
            <Button onClick={saveCredentials} disabled={busy}><Save className="h-4 w-4 mr-2" /> Save credentials</Button>
          </Card>
        </TabsContent>

        {/* SCHEDULER */}
        <TabsContent value="scheduler">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2"><Switch checked={cfg.auto_sync_enabled} onCheckedChange={(v) => setCfg({ ...cfg, auto_sync_enabled: v })} /><Label>Auto sync enabled</Label></div>
            <div><Label>Cron expression</Label><Input value={cfg.schedule_cron ?? ""} onChange={(e) => setCfg({ ...cfg, schedule_cron: e.target.value })} placeholder="*/5 * * * *" /></div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div>Last synced: <b>{cfg.last_synced_at ? new Date(cfg.last_synced_at).toLocaleString() : "—"}</b></div>
              <div>Next sync: <b>{cfg.next_sync_at ? new Date(cfg.next_sync_at).toLocaleString() : "—"}</b></div>
            </div>
            <Button onClick={saveDetails} disabled={busy}><Save className="h-4 w-4 mr-2" /> Save scheduler</Button>
          </Card>
        </TabsContent>

        {/* CONNECTIVITY */}
        <TabsContent value="connectivity">
          <Card className="p-4 space-y-3 text-sm">
            <div>
              <h3 className="font-semibold">Direct vs Proxy</h3>
              <p className="text-muted-foreground mt-1">
                <b>Direct</b>: server functions call the SAP endpoint directly using the configured auth.<br />
                <b>Proxy</b>: server functions call your self-hosted middleware over a private network; middleware then reaches SAP.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Self-hosted middleware checklist</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground mt-1">
                <li>Configure <code>middleware/.env</code> with <code>MIDDLEWARE_SHARED_SECRET</code>, <code>SAP_BP_API_URL</code>, <code>SAP_BP_USERNAME</code>, <code>SAP_BP_PASSWORD</code>.</li>
                <li>Run <code>node server.js</code> on port 3002.</li>
                <li>Expose with ngrok or a reverse proxy.</li>
                <li>Paste the URL into <i>Middleware URL</i> and the secret name into <i>Proxy secret name</i> on the Details tab.</li>
                <li>Add the secret value in Backend → Secrets under the same name.</li>
                <li>Click <b>Test connection</b> above.</li>
              </ol>
            </div>
            <Button onClick={runTest} disabled={busy}><Activity className="h-4 w-4 mr-2" /> Test SAP connection</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
