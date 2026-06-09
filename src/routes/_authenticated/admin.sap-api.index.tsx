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
import { Plug, Plus, Pencil, Trash2, Activity, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listSapConfigs, upsertSapConfig, deleteSapConfig, testSapConnection } from "@/lib/admin/sap-api.functions";

export const Route = createFileRoute("/_authenticated/admin/sap-api/")({
  component: SapApiListPage,
});

function SapApiListPage() {
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
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Plug className="h-6 w-6" /> SAP API Settings</h1>
          <p className="text-sm text-muted-foreground">Register dynamic SAP/REST endpoints with field-level request/response mappings and scheduled sync.</p>
        </div>
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
      </header>

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
