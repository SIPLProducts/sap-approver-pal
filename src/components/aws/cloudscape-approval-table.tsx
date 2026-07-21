import { ReactNode, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CloudscapeColumn<T> = {
  id: string;
  header: string;
  cell: (item: T) => ReactNode;
  align?: "right";
  minWidth?: number;
  sortingField?: keyof T | string;
};

export interface CloudscapeApprovalTableProps<T> {
  title: string;
  countLabel?: string;
  rows: T[];
  columns: CloudscapeColumn<T>[];
  rowKey: (r: T, index: number) => string;
  loading?: boolean;
  showSelect?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  onAccept?: () => void;
  onReject?: () => void;
  acceptDisabled?: boolean;
  rejectDisabled?: boolean;
  acceptLoading?: boolean;
  rejectLoading?: boolean;
  showReason?: boolean;
  reasonValue?: (k: string) => string;
  onReasonChange?: (k: string, value: string) => void;
  reasonInvalid?: (k: string) => boolean;
  readonlyReason?: (r: T) => string | null;
  emptyMessage?: ReactNode;
  pageSize?: number;
  headerExtras?: ReactNode;
}

function stringifyCell(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(stringifyCell).join(" ");
  if (typeof node === "object" && "props" in (node as any)) {
    const p = (node as any).props ?? {};
    return [p.children, p.value, p.title, p["aria-label"]]
      .filter(Boolean)
      .map(stringifyCell)
      .join(" ");
  }
  return "";
}

export function CloudscapeApprovalTable<T>({
  title,
  countLabel,
  rows,
  columns,
  rowKey,
  loading,
  showSelect,
  selectedKeys,
  onSelectionChange,
  onAccept,
  onReject,
  acceptDisabled,
  rejectDisabled,
  acceptLoading,
  rejectLoading,
  showReason,
  reasonValue,
  onReasonChange,
  reasonInvalid,
  readonlyReason,
  emptyMessage,
  pageSize = 25,
  headerExtras,
}: CloudscapeApprovalTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const keyed = useMemo(
    () => rows.map((r, i) => ({ r, i, k: rowKey(r, i) })),
    [rows, rowKey],
  );

  const allColumns = useMemo(() => {
    const cols = [...columns];
    if (showReason) {
      cols.push({
        id: "__reason",
        header: "Reason",
        cell: (item: T) => {
          const idx = keyed.find((x) => x.r === item)?.i ?? 0;
          const k = rowKey(item, idx);
          if (readonlyReason && !showSelect) return readonlyReason(item) ?? "—";
          const val = reasonValue?.(k) ?? "";
          const invalid = reasonInvalid?.(k) ?? false;
          return (
            <Input
              value={val}
              onChange={(e) => onReasonChange?.(k, e.target.value)}
              placeholder="Required"
              className={`h-8 text-xs min-w-[180px] ${invalid ? "border-destructive" : ""}`}
            />
          );
        },
        minWidth: 200,
      });
    } else if (readonlyReason) {
      cols.push({
        id: "__reason",
        header: "Reason",
        cell: (item: T) => readonlyReason(item) ?? "—",
        minWidth: 160,
      });
    }
    return cols;
  }, [columns, showReason, showSelect, readonlyReason, reasonValue, reasonInvalid, onReasonChange, rowKey, keyed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return keyed;
    return keyed.filter(({ r }) =>
      allColumns.some((c) => stringifyCell(c.cell(r)).toLowerCase().includes(q)),
    );
  }, [keyed, search, allColumns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  const pagedKeys = paged.map((x) => x.k);
  const allSelected =
    pagedKeys.length > 0 && pagedKeys.every((k) => selectedKeys?.has(k));
  const someSelected =
    !!selectedKeys && selectedKeys.size > 0 && !allSelected;

  function toggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys ?? []);
    if (checked) pagedKeys.forEach((k) => next.add(k));
    else pagedKeys.forEach((k) => next.delete(k));
    onSelectionChange(next);
  }
  function toggleRow(k: string, checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys ?? []);
    if (checked) next.add(k);
    else next.delete(k);
    onSelectionChange(next);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
            {title}
          </div>
          <div className="text-xs text-muted-foreground">
            {countLabel ??
              `${filtered.length}${search.trim() ? ` / ${rows.length}` : ""} row(s)`}
            {showSelect && selectedKeys ? ` · ${selectedKeys.size} selected` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search..."
              className="h-9 text-sm pl-8"
            />
          </div>
          {headerExtras}
          {showSelect && onReject && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onReject}
              disabled={rejectDisabled}
            >
              {rejectLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Reject
            </Button>
          )}
          {showSelect && onAccept && (
            <Button
              size="sm"
              onClick={onAccept}
              disabled={acceptDisabled}
            >
              {acceptLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Accept
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {showSelect && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {allColumns.map((c) => (
                <TableHead
                  key={c.id}
                  className="whitespace-nowrap text-xs"
                  style={{ minWidth: c.minWidth ?? 120, textAlign: c.align === "right" ? "right" : undefined }}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length + (showSelect ? 1 : 0)}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                  Fetching from SAP…
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length + (showSelect ? 1 : 0)}
                  className="text-center text-sm text-muted-foreground py-6"
                >
                  {rows.length === 0
                    ? emptyMessage ?? "No records."
                    : "No records match the filter."}
                </TableCell>
              </TableRow>
            ) : (
              paged.map(({ r, i, k }) => {
                const checked = selectedKeys?.has(k) ?? false;
                return (
                  <TableRow key={k} data-state={checked ? "selected" : undefined}>
                    {showSelect && (
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleRow(k, v === true)}
                          aria-label={`Select row ${i + 1}`}
                        />
                      </TableCell>
                    )}
                    {allColumns.map((c) => (
                      <TableCell
                        key={c.id}
                        className="whitespace-nowrap text-xs"
                        style={{ textAlign: c.align === "right" ? "right" : undefined }}
                      >
                        {c.cell(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div>
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
