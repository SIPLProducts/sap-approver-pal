import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
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

function parseJsonIfPossible(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !(trimmed.startsWith("[") || trimmed.startsWith("{"))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function collectRows(value: unknown, depth = 0): any[] {
  if (depth > 6 || value == null) return [];
  const parsed: any = parseJsonIfPossible(value);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];

  if ("SEARCH_TERM" in parsed) return [parsed];

  const candidates = [
    parsed.DATA,
    parsed.data?.DATA,
    parsed.data?.data,
    parsed.data,
    parsed.ITEMS,
    parsed.items,
    parsed.RESULTS,
    parsed.results,
    parsed.SEARCH_TERMS,
    parsed.SEARCH_TERM_LIST,
  ];

  for (const candidate of candidates) {
    const rows = collectRows(candidate, depth + 1);
    if (rows.length) return rows;
  }

  for (const child of Object.values(parsed)) {
    const rows = collectRows(child, depth + 1);
    if (rows.length) return rows;
  }

  return [];
}

export function extractSearchTermOptions(resp: unknown): SearchTermOption[] {
  const rows = collectRows(resp);
  const seen = new Set<string>();
  const out: SearchTermOption[] = [];
  for (const row of rows) {
    if (row == null) continue;
    const parsedRow = parseJsonIfPossible(row);
    if (!parsedRow || typeof parsedRow !== "object" || Array.isArray(parsedRow)) continue;
    const raw = (parsedRow as Record<string, unknown>).SEARCH_TERM;
    if (raw == null) continue;
    const code = String(raw).trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, text: "" });
  }
  return out;
}

export function getSearchTermParseError(resp: unknown): string | null {
  const parsed: any = parseJsonIfPossible(resp);
  if (!parsed || typeof parsed !== "object") return null;
  const direct = parsed.__parse_error;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const candidates = [parsed.data, parsed.DATA, parsed.body, parsed.result];
  for (const candidate of candidates) {
    const nested = getSearchTermParseError(candidate);
    if (nested) return nested;
  }
  return null;
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset search/pagination when popover closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  const getCfg = useServerFn(getSearchTermConfig);
  const runApi = useServerFn(runSapApi);

  const cfgQuery = useQuery({
    queryKey: ["sap-search-term-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const configId = cfgQuery.data?.configId ?? null;
  const plantKey = (plants ?? []).join(",");
  const hasQuery = debouncedSearch.length >= 2;

  const stQuery = useQuery({
    queryKey: ["sap-search-terms", configId, plantKey],
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
      const payload = resp?.data ?? resp;
      const parseError = getSearchTermParseError(payload);
      if (parseError) {
        throw new Error(`SAP returned malformed JSON: ${parseError}`);
      }
      return extractSearchTermOptions(payload);
    },
  });

  const options = useMemo(() => stQuery.data ?? [], [stQuery.data]);
  const selected = useMemo(() => new Set(value), [value]);
  const triggerLabel = value.length ? value.join(", ") : "";

  const filtered = useMemo(() => {
    if (!hasQuery) return options;
    const q = debouncedSearch.toLowerCase();
    return options.filter((o) => o.code.toLowerCase().includes(q));
  }, [options, debouncedSearch, hasQuery]);

  // Reset pagination when filter/results change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, options]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  // IntersectionObserver-based auto load-more
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

  function toggle(code: string) {
    if (selected.has(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  }

  function toggleAllFiltered() {
    const codes = filtered.map((o) => o.code);
    const allSelected = codes.length > 0 && codes.every((c) => selected.has(c));
    if (allSelected) {
      onChange(value.filter((c) => !codes.includes(c)));
    } else {
      const merged = new Set([...value, ...codes]);
      onChange(Array.from(merged));
    }
  }

  // Fallback to disabled button when config is missing
  if (!cfgQuery.isLoading && !configId) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn("h-9 w-full justify-between text-muted-foreground font-sans", className)}
      >
        <span className="truncate text-left">Get_Search_Term not configured</span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
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
            !value.length && "text-muted-foreground font-sans",
            className,
          )}
        >
          {cfgQuery.isLoading ? (
            <span className="flex items-center gap-2 font-sans">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          ) : (
            <span className={cn("truncate text-left", value.length && "font-mono")}>
              {triggerLabel || placeholder}
            </span>
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
            placeholder="Search… (type 2+ chars to filter)"
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
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
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No search terms match "{debouncedSearch}".
              </div>
            ) : (
              <CommandGroup>
                <CommandItem
                  value="__select_all__"
                  onSelect={toggleAllFiltered}
                  className="font-medium border-b rounded-none"
                >
                  <Checkbox
                    checked={
                      filtered.length > 0 &&
                      filtered.every((o) => selected.has(o.code))
                    }
                    tabIndex={-1}
                    className="pointer-events-none mr-2"
                  />
                  {filtered.every((o) => selected.has(o.code))
                    ? `Clear all matching (${filtered.length})`
                    : `Select all matching (${filtered.length})`}
                </CommandItem>
                {visible.map((o) => {
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
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
