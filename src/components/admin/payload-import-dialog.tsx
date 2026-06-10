import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Upload, Sparkles, FileJson } from "lucide-react";
import { toast } from "sonner";
import {
  flattenPayload,
  parsePayloadText,
  toReqRows,
  toResRows,
  type DetectedField,
  type MergeMode,
  type ReqRow,
  type ResRow,
  MAX_PAYLOAD_BYTES,
} from "@/lib/admin/payload-detect";

type Props =
  | { mode: "request"; onApply: (rows: ReqRow[], merge: MergeMode) => void; trigger?: React.ReactNode }
  | { mode: "response"; onApply: (rows: ResRow[], merge: MergeMode) => void; trigger?: React.ReactNode };

export function PayloadImportDialog(props: Props) {
  const { mode } = props;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merge, setMerge] = useState<MergeMode>("replace");
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setText(""); setFields([]); setSelected(new Set()); setMerge("replace");
  }

  function detect(raw: string) {
    const parsed = parsePayloadText(raw);
    if (!parsed.ok) { toast.error(parsed.error); return; }
    const detected = flattenPayload(parsed.value);
    if (detected.length === 0) { toast.error("No fields detected in payload"); return; }
    setFields(detected);
    setSelected(new Set(detected.map((f) => f.path)));
    toast.success(`Detected ${detected.length} field${detected.length === 1 ? "" : "s"}`);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_PAYLOAD_BYTES) { toast.error("File too large (max 1 MB)"); return; }
    const raw = await f.text();
    setText(raw);
    detect(raw);
    if (fileRef.current) fileRef.current.value = "";
  }

  function apply() {
    const chosen = fields.filter((f) => selected.has(f.path));
    if (chosen.length === 0) { toast.error("Select at least one field"); return; }
    if (mode === "request") props.onApply(toReqRows(chosen), merge);
    else props.onApply(toResRows(chosen), merge);
    toast.success(`Imported ${chosen.length} field${chosen.length === 1 ? "" : "s"}`);
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {props.trigger ?? (
          <Button size="sm" variant="outline">
            <Sparkles className="h-4 w-4 mr-1" /> Import payload
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" /> Import {mode} payload</DialogTitle>
          <DialogDescription>
            Upload or paste a sample JSON payload. Detected fields will be added to the {mode} mapping table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".json,application/json,.txt,text/plain" className="hidden" onChange={onFile} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Upload .json
            </Button>
            <Button size="sm" variant="outline" onClick={() => detect(text)} disabled={!text.trim()}>
              <Sparkles className="h-4 w-4 mr-1" /> Detect fields
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">Max 1 MB · JSON only</span>
          </div>

          <div>
            <Label className="text-xs">Paste JSON</Label>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='{ "doc_no": "4500000001", "items": [{ "material": "MAT-1", "qty": 10 }] }'
              className="font-mono text-xs"
            />
          </div>

          {fields.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Detected fields</Label>
                  <Badge variant="secondary">{selected.size}/{fields.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(fields.map((f) => f.path)))}>All</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>None</Button>
                </div>
              </div>
              <div className="rounded-md border max-h-64 overflow-y-auto">
                {fields.map((f) => {
                  const checked = selected.has(f.path);
                  return (
                    <label key={f.path} className="flex items-center gap-2 px-3 py-1.5 text-xs border-b last:border-b-0 hover:bg-muted/40 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(f.path); else next.delete(f.path);
                          setSelected(next);
                        }}
                      />
                      <span className="font-mono truncate flex-1">{f.path}</span>
                      <Badge variant="outline" className="text-[10px]">{f.inferredType}</Badge>
                      <span className="text-muted-foreground truncate max-w-[180px]">
                        {f.sampleValue === null ? "null" : typeof f.sampleValue === "object" ? "…" : String(f.sampleValue)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Merge mode</Label>
                <Select value={merge} onValueChange={(v) => setMerge(v as MergeMode)}>
                  <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">Replace existing rows</SelectItem>
                    <SelectItem value="append">Append new fields only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={apply} disabled={fields.length === 0}>Apply to table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
