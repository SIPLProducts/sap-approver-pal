import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getCustomerConfig } from "@/lib/sap/customer.functions";
import { runSapApi } from "@/lib/sap/sap.functions";

interface Props {
  value: string;
  onChange: (v: string) => void;
  plants?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onEnter?: () => void;
}

export interface CustomerOption {
  code: string;
  text: string;
}

const CODE_KEYS = ["KUNNR", "CUSTOMER", "Customer", "customer", "KUNAG", "CUST_CODE"];
const TEXT_KEYS = ["NAME1", "NAME", "CUSTOMER_NAME", "Name", "name", "DESCRIPTION"];

export function extractCustomerOptions(resp: unknown): CustomerOption[] {
  const r: any = resp;
  let rows: any[] = [];
  if (Array.isArray(r)) rows = r;
  else if (r && typeof r === "object") {
    const candidates = [r.DATA, r.data?.DATA, r.data, r.ITEMS, r.items, r.RESULTS, r.results, r.CUSTOMER_LIST];
    rows = candidates.find((c) => Array.isArray(c)) ?? [];
    if (!rows.length) {
      for (const v of Object.values(r)) {
        if (Array.isArray(v)) { rows = v; break; }
      }
    }
  }
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row == null) continue;
    if (typeof row === "string" || typeof row === "number") {
      const c = String(row).trim();
      if (c && !map.has(c)) map.set(c, "");
      continue;
    }
    let code = "";
    for (const k of CODE_KEYS) {
      const v = row?.[k];
      if (v != null && String(v).trim()) { code = String(v).trim(); break; }
    }
    if (!code) continue;
    let text = "";
    for (const k of TEXT_KEYS) {
      const v = row?.[k];
      if (v != null && String(v).trim()) { text = String(v).trim(); break; }
    }
    if (!map.has(code) || (text && !map.get(code))) map.set(code, text);
  }
  return Array.from(map.entries())
    .map(([code, text]) => ({ code, text }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function CustomerSelect({
  value,
  onChange,
  plants,
  placeholder = "Select customer…",
  disabled,
  className,
  onEnter: _onEnter,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const getCfg = useServerFn(getCustomerConfig);
  const runApi = useServerFn(runSapApi);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  const cfgQuery = useQuery({
    queryKey: ["sap-customer-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const configId = cfgQuery.data?.configId ?? null;
  const plantKey = (plants ?? []).join(",");

  const custQuery = useQuery({
    queryKey: ["sap-customers", configId, plantKey],
    enabled: !!configId && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inputs: Record<string, unknown> = {};
      if (plants && plants.length > 0) {
        inputs.PLANT = plants[0];
        inputs.PLANTS = plants;
        inputs.VKORG = plants[0];
      }
      const resp: any = await runApi({ data: { configId: configId!, inputs } });
      return extractCustomerOptions(resp?.data ?? resp);
    },
  });

  const customers = useMemo(() => custQuery.data ?? [], [custQuery.data]);
  const selectedOption = useMemo(
    () => customers.find((c) => c.code === value),
    [customers, value],
  );
  const triggerLabel = value
    ? selectedOption && selectedOption.text
      ? `${selectedOption.code} - ${selectedOption.text}`
      : value
    : "";

  const hasQuery = debouncedSearch.length >= 1;
  const filtered = useMemo(() => {
    if (!hasQuery) return customers;
    const q = debouncedSearch.toLowerCase();
    return customers.filter(
      (c) => c.code.toLowerCase().includes(q) || c.text.toLowerCase().includes(q),
    );
  }, [customers, debouncedSearch, hasQuery]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, customers]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { root: el.closest("[cmdk-list]") as Element | null, threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visibleCount, filtered.length]);

  // Fallback to plain input when config is missing
  if (!cfgQuery.isLoading && !configId) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && _onEnter?.()}
        placeholder="optional"
        className={cn("h-9 font-mono", className)}
        disabled={disabled}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || cfgQuery.isLoading}
          className={cn(
            "h-9 w-full justify-between",
            !value && "text-muted-foreground font-sans",
            className,
          )}
        >
          {cfgQuery.isLoading ? (
            <span className="flex items-center gap-2 font-sans">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          ) : (
            <span className="truncate text-left">{triggerLabel || placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[1000] w-[380px] p-0 max-h-[60vh]"
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customer…"
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[calc(60vh-3rem)]">
            {custQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching customers…
              </div>
            ) : custQuery.isError ? (
              <div className="px-3 py-4 text-xs text-destructive space-y-1">
                <div className="font-medium">Failed to load customers.</div>
                <div className="text-[11px] opacity-80 break-words">
                  {(custQuery.error as Error)?.message ?? "Unknown error"}
                </div>
                <button className="underline" onClick={() => custQuery.refetch()}>
                  Retry
                </button>
              </div>
            ) : customers.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No customers returned by Customer_Fetch_API.
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">No customer found.</div>
            ) : (
              <>
                <CommandGroup>
                  {visible.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.text}`}
                      onSelect={() => {
                        onChange(c.code === value ? "" : c.code);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          value === c.code ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="font-mono">{c.code}</span>
                      {c.text && (
                        <span className="ml-2 text-muted-foreground truncate">— {c.text}</span>
                      )}
                    </CommandItem>
                  ))}
                  {hasMore && (
                    <CommandItem
                      value="__load_more__"
                      onSelect={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="justify-center text-xs text-muted-foreground"
                    >
                      <div ref={loadMoreRef} className="w-full text-center">
                        Load more (showing {visible.length} of {filtered.length})
                      </div>
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
