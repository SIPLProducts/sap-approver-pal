import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
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

  return (
    <div className={cn("flex items-center gap-1", className)}>
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
        className="h-9 font-mono flex-1"
      />
      {hasConfig && (
        <Popover open={open} onOpenChange={(o) => (o ? openPopup() : setOpen(false))}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || cfgQuery.isLoading}
              className="h-9 px-2 shrink-0"
              title="F4 help — search terms"
              aria-label="F4 help"
            >
              {cfgQuery.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[1000] w-[380px] p-0 max-h-[65vh] overflow-hidden"
            align="end"
            side="bottom"
            sideOffset={6}
            avoidCollisions={false}
            onWheel={(e) => e.stopPropagation()}
          >
            <Command>
              <CommandInput placeholder="Search…" className="h-9" />
              <CommandList className="max-h-[calc(65vh-6rem)]">
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
      )}
    </div>
  );
}
