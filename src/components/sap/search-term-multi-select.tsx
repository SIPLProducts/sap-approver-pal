import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
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

const CODE_KEYS = ["SORTL", "SEARCH_TERM", "SEARCHTERM", "SEARCH_TERM_1", "SUCHBEGRIFF", "search_term", "SearchTerm"];
const TEXT_KEYS = ["DESCRIPTION", "NAME", "NAME1", "TEXT", "LABEL", "description", "name", "label"];

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

function hasSearchTermShape(row: Record<string, unknown>) {
  const keys = new Set(Object.keys(row).map((k) => k.toLowerCase()));
  return CODE_KEYS.some((k) => keys.has(k.toLowerCase()));
}

function collectRows(value: unknown, depth = 0): any[] {
  if (depth > 6 || value == null) return [];
  const parsed: any = parseJsonIfPossible(value);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];

  if (hasSearchTermShape(parsed)) return [parsed];

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
    parsed.SEARCH_TERM,
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

function firstValue(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const direct = row[k];
    if (direct != null && String(direct).trim()) return String(direct).trim();
  }
  const lowerToKey = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const actual = lowerToKey.get(k.toLowerCase());
    if (!actual) continue;
    const value = row[actual];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function extractSearchTermOptions(resp: unknown): SearchTermOption[] {
  const rows = collectRows(resp);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row == null) continue;
    if (typeof row === "string" || typeof row === "number") {
      const c = String(row).trim();
      if (c && !map.has(c)) map.set(c, "");
      continue;
    }
    const parsedRow = parseJsonIfPossible(row);
    if (!parsedRow || typeof parsedRow !== "object" || Array.isArray(parsedRow)) continue;
    const code = firstValue(parsedRow as Record<string, unknown>, CODE_KEYS);
    if (!code) continue;
    const text = firstValue(parsedRow as Record<string, unknown>, TEXT_KEYS);
    if (!map.has(code) || (text && !map.get(code))) map.set(code, text);
  }
  return Array.from(map.entries())
    .map(([code, text]) => ({ code, text }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function parseCodes(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[,\s]+/)) {
    const t = raw.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function SearchTermMultiSelect({
  value,
  onChange,
  plants,
  placeholder = "e.g. TERM1, TERM2",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState<string>(value.join(", "));
  const [draft, setDraft] = useState<Set<string>>(new Set(value));

  const getCfg = useServerFn(getSearchTermConfig);
  const runApi = useServerFn(runSapApi);

  // Sync external value → input text when parent resets/updates
  useEffect(() => {
    const parsed = parseCodes(inputText);
    // avoid clobbering user's in-progress typing when equivalent
    if (parsed.join(",") !== value.join(",")) {
      setInputText(value.join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(",")]);

  const cfgQuery = useQuery({
    queryKey: ["sap-search-term-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const configId = cfgQuery.data?.configId ?? null;
  const plantKey = (plants ?? []).join(",");

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
      return extractSearchTermOptions(resp?.data ?? resp);
    },
  });

  const options = useMemo(() => stQuery.data ?? [], [stQuery.data]);

  function commitInput(text: string) {
    setInputText(text);
    onChange(parseCodes(text));
  }

  function openPopup() {
    setDraft(new Set(parseCodes(inputText)));
    setOpen(true);
  }

  function toggleDraft(code: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function apply() {
    // Merge: keep typed order first, then any new picks from popup
    const typed = parseCodes(inputText);
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const c of typed) {
      if (draft.has(c) && !seen.has(c)) {
        merged.push(c);
        seen.add(c);
      }
    }
    for (const c of draft) {
      if (!seen.has(c)) {
        merged.push(c);
        seen.add(c);
      }
    }
    const text = merged.join(", ");
    setInputText(text);
    onChange(merged);
    setOpen(false);
  }

  const hasConfig = !!configId;
  const inputDisabled = disabled || cfgQuery.isLoading;

  if (!cfgQuery.isLoading && !configId) {
    return (
      <Input
        value={inputText}
        onChange={(e) => commitInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "F4") {
            e.preventDefault();
            if (hasConfig && !disabled) openPopup();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("h-9 w-full font-mono", className)}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => (o ? openPopup() : setOpen(false))}>
      <PopoverTrigger asChild>
        <Input
          value={cfgQuery.isLoading ? "" : inputText}
          onChange={(e) => commitInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "F4") {
              e.preventDefault();
              if (hasConfig && !disabled) openPopup();
            }
          }}
          placeholder={cfgQuery.isLoading ? "Loading…" : placeholder}
          disabled={inputDisabled}
          aria-expanded={open}
          className={cn("h-9 w-full font-mono", !inputText && "font-sans", className)}
        />
      </PopoverTrigger>
          <PopoverContent
            className="z-[1000] w-[380px] p-0 max-h-[60vh] overflow-hidden"
            align="start"
            side="bottom"
            sideOffset={6}
            avoidCollisions={false}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onWheel={(e) => e.stopPropagation()}
          >
            <Command>
              <CommandInput placeholder="Search…" className="h-9" />
              <CommandList className="max-h-[calc(60vh-6rem)]">
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
                          if (draft.size === options.length) setDraft(new Set());
                          else setDraft(new Set(options.map((o) => o.code)));
                        }}
                        className="font-medium border-b rounded-none"
                      >
                        <Checkbox
                          checked={draft.size === options.length && options.length > 0}
                          tabIndex={-1}
                          className="pointer-events-none mr-2"
                        />
                        {draft.size === options.length
                          ? `Clear all (${options.length})`
                          : `Select all (${options.length})`}
                      </CommandItem>
                      {options.map((o) => {
                        const isSel = draft.has(o.code);
                        return (
                          <CommandItem
                            key={o.code}
                            value={`${o.code} ${o.text}`}
                            onSelect={() => toggleDraft(o.code)}
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
              <div className="flex items-center justify-between gap-2 border-t p-2">
                <span className="text-[11px] text-muted-foreground">
                  {draft.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7"
                    onClick={apply}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
  );
}
