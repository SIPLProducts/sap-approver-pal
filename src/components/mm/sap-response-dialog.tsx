import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface SapResponseRow {
  /** Document / item identifier shown in the first column. */
  ref: string;
  message: string;
  ok: boolean;
  /** Optional raw SAP payload for the collapsible block. */
  response?: any;
}

export interface SapResponseDialogState {
  open: boolean;
  title: string;
  /** Header label for the first column, e.g. "PO Number", "PR / Item". */
  refLabel?: string;
  results: SapResponseRow[];
}

export function SapResponseDialog({
  dialog,
  onOpenChange,
  defaultTitle = "SAP Response",
}: {
  dialog: SapResponseDialogState | null;
  onOpenChange: (open: boolean) => void;
  defaultTitle?: string;
}) {
  const refLabel = dialog?.refLabel ?? "Document";
  return (
    <Dialog open={!!dialog?.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialog?.title ?? defaultTitle}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{refLabel}</TableHead>
                  <TableHead className="text-xs">Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialog?.results.map((r, i) => (
                  <TableRow key={`${r.ref}-${i}`}>
                    <TableCell className="text-xs font-medium whitespace-nowrap align-top">
                      {r.ref || "—"}
                    </TableCell>
                    <TableCell
                      className={cn("text-xs", r.ok ? "text-success" : "text-destructive")}
                    >
                      {r.message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {dialog?.results.map((r, i) => (
            <details key={`raw-${r.ref}-${i}`} className="border rounded-md">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">
                Raw response{r.ref ? ` — ${r.ref}` : ""}
              </summary>
              <pre className="text-xs font-mono bg-muted/50 p-3 overflow-x-auto whitespace-pre">
{JSON.stringify(r.response ?? { message: r.message }, null, 2)}
              </pre>
            </details>
          ))}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
