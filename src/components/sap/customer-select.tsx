import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2 } from "lucide-react";
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
  placeholder = "Customer code",
  disabled,
  className,
  onEnter,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const getCfg = useServerFn(getCustomerConfig);
  const runApi = useServerFn(runSapApi);

  const cfgQuery = useQuery({
    queryKey: ["sap-customer-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const configId = cfgQuery.data?.configId ?? null;
  const plantKey = (plants ?? []).join(",");

  const custQuery = useQuery({
    queryKey: ["sap-customers", configId, plantKey, debounced],
    enabled: !!configId && open,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const inputs: Record<string, unknown> = {};
      if (plants && plants.length > 0) {
        inputs.PLANT = plants[0];
        inputs.PLANTS = plants;
        inputs.VKORG = plants[0];
      }
      if (debounced) inputs.SEARCH = debounced;
      const resp: any = await runApi({ data: { configId: configId!, inputs } });
      return extractCustomerOptions(resp?.data ?? resp);
    },
  });

  const customers = useMemo(() => custQuery.data ?? [], [custQuery.data]);

  // Fallback to plain input when config is missing
  if (!cfgQuery.isLoading && !configId) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder="optional"
        className={cn("h-9 font-mono", className)}
        disabled={disabled}
      />
    );
  }

  return (
    <div className={cn("flex items-stretch gap-1", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        className="h-9 font-mono flex-1"
        disabled={disabled}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={disabled || cfgQuery.isLoading}
            aria-label="Customer value help (F4)"
            title="Customer lookup (F4)"
          >
            {cfgQuery.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="end">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search customer…"
              className="h-9"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {custQuery.isLoading || custQuery.isFetching ? (
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
              ) : (
                <>
                  <CommandEmpty>No customer found.</CommandEmpty>
                  <CommandGroup>
                    {customers.map((c) => (
                      <CommandItem
                        key={c.code}
                        value={`${c.code} ${c.text}`}
                        onSelect={() => {
                          onChange(c.code);
                          setOpen(false);
                        }}
                      >
                        <span className="font-mono">{c.code}</span>
                        {c.text && (
                          <span className="ml-2 text-muted-foreground truncate">— {c.text}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
