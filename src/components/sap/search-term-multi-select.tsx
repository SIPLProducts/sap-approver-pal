import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getSearchTermConfig } from "@/lib/sap/search-term.functions";
import { runSapApi } from "@/lib/sap/sap.functions";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  plants?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface SearchTermOption {
  code: string;
  text: string;
}

const CODE_KEYS = ["SORTL", "SEARCH_TERM", "SEARCHTERM", "SEARCH_TERM_1", "SUCHBEGRIFF"];
const TEXT_KEYS = ["DESCRIPTION", "NAME", "NAME1", "TEXT", "LABEL"];

export function extractSearchTermOptions(resp: unknown): SearchTermOption[] {
  const r: any = resp;
  let rows: any[] = [];
  if (Array.isArray(r)) rows = r;
  else if (r && typeof r === "object") {
    const candidates = [r.DATA, r.data?.DATA, r.data, r.ITEMS, r.items, r.RESULTS, r.results, r.SEARCH_TERMS, r.SEARCH_TERM_LIST];
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

export function SearchTermMultiSelect({
  value,
  onChange,
  plants,
  placeholder = "Select search term…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const getCfg = useServerFn(getSearchTermConfig);
  const runApi = useServerFn(runSapApi);

  const cfgQuery = useQuery({
    queryKey: ["sap-search-term-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const configId = cfgQuery.data?.configId ?? null;
  const plantKey = (plants ?? []).join(",");

  const stQuery = useQuery({
    queryKey: ["sap-search-terms", configId, plantKey],
    enabled: !!configId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const inputs: Record<string, unknown> = {};
      if (plants && plants.length > 0) {
        inputs.PLANT = plants[0];
        inputs.PLANTS = plants;
        inputs.VKORG = plants[0];
      }
      const resp: any = await runApi({ data: { configId: configId!, inputs } });
      return extractSearchTermOptions(resp?.data ?? resp);
    },
  });

  const options = useMemo(() => stQuery.data ?? [], [stQuery.data]);
  const selected = useMemo(() => new Set(value), [value]);

  function toggle(code: string) {
    if (selected.has(code)) onChange(value.filter((v) => v !== code));
    else onChange([...value, code]);
  }

  // Fallback to comma-separated text input when config is missing
  if (!cfgQuery.isLoading && !configId) {
    return (
      <Input
        value={value.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder="e.g. TERM1, TERM2"
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
            "h-9 w-full justify-between gap-2 px-3",
            value.length === 0 && "text-muted-foreground font-sans",
            value.length > 0 && "font-mono",
            className,
          )}
        >
          {cfgQuery.isLoading ? (
            <span className="flex items-center gap-2 font-sans">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          ) : value.length === 0 ? (
            <span className="flex-1 text-left truncate">{placeholder}</span>
          ) : (
            <div
              className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onWheel={(e) => {
                if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
              }}
            >
              {value.join(", ")}
            </div>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[1000] w-[380px] p-0 max-h-[60vh] overflow-hidden"
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
        onWheel={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search…" className="h-9" />
          <CommandList className="max-h-[calc(60vh-3rem)]">
            {stQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching search terms…
              </div>
            ) : stQuery.isError ? (
              <div className="px-3 py-4 text-xs text-destructive space-y-1">
                <div className="font-medium">Failed to load search terms.</div>
                <div className="text-[11px] opacity-80 break-words">
                  {(stQuery.error as Error)?.message ?? "Unknown error"}
                </div>
                <button className="underline" onClick={() => stQuery.refetch()}>
                  Retry
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No search terms returned by Get_Search_Term.
              </div>
            ) : (
              <>
                <CommandEmpty>No search term found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__select_all__"
                    onSelect={() => {
                      if (value.length === options.length) onChange([]);
                      else onChange(options.map((o) => o.code));
                    }}
                    className="font-medium border-b rounded-none"
                  >
                    <Checkbox
                      checked={value.length === options.length}
                      tabIndex={-1}
                      className="pointer-events-none mr-2"
                    />
                    {value.length === options.length
                      ? `Clear all (${options.length})`
                      : `Select all (${options.length})`}
                  </CommandItem>
                  {options.map((o) => {
                    const isSel = selected.has(o.code);
                    return (
                      <CommandItem
                        key={o.code}
                        value={`${o.code} ${o.text}`}
                        onSelect={() => toggle(o.code)}
                      >
                        <Checkbox
                          checked={isSel}
                          tabIndex={-1}
                          className="pointer-events-none mr-2"
                        />
                        <span className="font-mono">{o.code}</span>
                        {o.text && (
                          <span className="ml-2 text-muted-foreground truncate">— {o.text}</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
