import { ReactNode, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Filter, RotateCcw } from "lucide-react";
import { PlantSelect } from "@/components/sap/plant-select";
import type { Database } from "@/integrations/supabase/types";

type DocType = Database["public"]["Enums"]["document_type"];
type DocRow = Database["public"]["Tables"]["approval_documents"]["Row"];

export type ColumnDef = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  width?: string;
  render: (d: DocRow) => ReactNode;
};

export type ExtraFilter = { id: string; label: string };

interface Props {
  title: string;
  subtitle: string;
  tCode: string;
  levels: string;
  docType: DocType;
  columns: ColumnDef[];
  extraFilters?: ExtraFilter[];
  defaultExtra?: string[];
  status: Status;
  onStatusChange: (s: Status) => void;
}

type Status = "pending" | "accepted" | "rejected";

export function SdApprovalShell({
  title, subtitle, tCode, levels, docType, columns, extraFilters, defaultExtra,
  status, onStatusChange,
}: Props) {
  const [plant, setPlant] = useState("");
  const [customer, setCustomer] = useState("");
  const [extra, setExtra] = useState<string[]>(defaultExtra ?? (extraFilters?.[0] ? [extraFilters[0].id] : []));

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sd", docType, status],
    queryFn: async () => {
      const dbStatus = status === "accepted" ? "approved" : status;
      const { data } = await supabase
        .from("approval_documents")
        .select("*")
        .eq("doc_type", docType)
        .eq("status", dbStatus)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => rows.filter((r) =>
    (!plant || (r.plant ?? "").toLowerCase().includes(plant.toLowerCase())) &&
    (!customer || (r.customer_name ?? "").toLowerCase().includes(customer.toLowerCase()) || (r.sap_doc_no ?? "").toLowerCase().includes(customer.toLowerCase()))
  ), [rows, plant, customer]);

  function reset() { setPlant(""); setCustomer(""); onStatusChange("pending"); }

  function toggleExtra(id: string) {
    setExtra((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">SD Approvals · {tCode}</p>
          <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold tracking-tight truncate">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">{tCode}</Badge>
          <Badge variant="secondary" className="text-xs">{levels}</Badge>
        </div>
      </header>



      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>
        <div className="grid gap-3 md:grid-cols-[200px_240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Plant</Label>
            <PlantSelect value={plant} onChange={setPlant} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer / Doc No</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name or no." className="h-9" />
          </div>
          {extraFilters?.length ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Approval Type</Label>
              <div className="flex flex-wrap gap-3 h-9 items-center">
                {extraFilters.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={extra.includes(f.id)} onCheckedChange={() => toggleExtra(f.id)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
          </div>
        </div>

        <div className="mt-4 -mx-4 px-4 pt-3 border-t">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label className="text-xs text-muted-foreground">Action</Label>
            <Tabs value={status} onValueChange={(v) => onStatusChange(v as Status)}>
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="accepted">Accepted</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Output — {status}</div>
          <div className="text-xs text-muted-foreground">{filtered.length} record{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b sticky top-0">
              <tr>
                <th className="text-left font-semibold px-3 py-2 w-10">#</th>
                {columns.map((c) => (
                  <th key={c.key} className={`font-semibold px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`} style={c.width ? { minWidth: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
                <th className="text-right font-semibold px-3 py-2 sticky right-0 bg-muted/80 backdrop-blur">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={columns.length + 2} className="py-12 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="py-12 text-center text-muted-foreground">
                  No {status} records. Try "Sync SAP" or change filters.
                </td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""} ${c.mono ? "font-mono" : ""}`}>
                      {c.render(d)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right sticky right-0 bg-card/95 backdrop-blur">
                    <Link to="/approval/$id" params={{ id: d.id }}>
                      <Button size="sm" variant="outline" className="h-7 px-2">
                        <Eye className="h-3.5 w-3.5 mr-1" /> Open
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function fmtINR(v: number | string | null) {
  if (v == null) return "—";
  const n = Number(v); if (!isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s); if (isNaN(+d)) return s;
  return d.toLocaleDateString("en-GB").replaceAll("/", ".");
}
