import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
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
import { getPlantConfig } from "@/lib/sap/plant.functions";
import { runSapApi } from "@/lib/sap/sap.functions";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function extractPlants(resp: unknown, field: string): string[] {
  const r: any = resp;
  let rows: any[] = [];
  if (Array.isArray(r)) rows = r;
  else if (r && typeof r === "object") {
    const candidates = [r.DATA, r.data?.DATA, r.data, r.ITEMS, r.items, r.RESULTS, r.results, r.PLANT_LIST];
    rows = candidates.find((c) => Array.isArray(c)) ?? [];
    if (!rows.length) {
      for (const v of Object.values(r)) {
        if (Array.isArray(v)) { rows = v; break; }
      }
    }
  }
  const keys = [field, "VKORG", "WERKS", "PLANT", "Plant", "Werks", "Vkorg", "plant", "werks", "vkorg"];
  const out = new Set<string>();
  for (const row of rows) {
    if (row == null) continue;
    if (typeof row === "string" || typeof row === "number") { out.add(String(row)); continue; }
    for (const k of keys) {
      const v = row?.[k];
      if (v != null && String(v).trim()) { out.add(String(v).trim()); break; }
    }
  }
  return Array.from(out).sort();
}

export function PlantMultiSelect({
  value,
  onChange,
  placeholder = "Select plants…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const getCfg = useServerFn(getPlantConfig);
  const runApi = useServerFn(runSapApi);

  const cfgQuery = useQuery({
    queryKey: ["sap-plant-config"],
    queryFn: () => getCfg(),
    staleTime: 10 * 60 * 1000,
  });

  const configId = cfgQuery.data?.configId ?? null;
  const plantField = cfgQuery.data?.plantField ?? "VKORG";

  const plantsQuery = useQuery({
    queryKey: ["sap-plants", configId],
    enabled: !!configId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const resp: any = await runApi({ data: { configId: configId!, inputs: {} } });
      return extractPlants(resp?.data ?? resp, plantField);
    },
  });

  const plants = useMemo(() => plantsQuery.data ?? [], [plantsQuery.data]);
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
        placeholder="e.g. 3801, 3802"
        className={cn("h-9 font-mono", className)}
        disabled={disabled}
      />
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || cfgQuery.isLoading}
            className={cn(
              "h-9 w-full justify-between font-mono",
              value.length === 0 && "text-muted-foreground font-sans",
            )}
          >
            {cfgQuery.isLoading ? (
              <span className="flex items-center gap-2 font-sans">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : value.length === 0 ? (
              placeholder
            ) : (
              <span className="truncate text-left">
                {value.join(", ")}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-0 max-h-[340px] overflow-hidden"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder="Search plant…" className="h-9" />
            <CommandList>
              {plantsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching plants…
                </div>
              ) : plantsQuery.isError ? (
                <div className="px-3 py-4 text-xs text-destructive space-y-1">
                  <div className="font-medium">Failed to load plants.</div>
                  <div className="text-[11px] opacity-80 break-words">
                    {(plantsQuery.error as Error)?.message ?? "Unknown error"}
                  </div>
                  <button className="underline" onClick={() => plantsQuery.refetch()}>
                    Retry
                  </button>
                </div>
              ) : plants.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">
                  No plants returned by Get_Plant. Check SAP API Settings.
                </div>
              ) : (
                <>
                  <CommandEmpty>No plant found.</CommandEmpty>
                  <CommandGroup>
                    {plants.map((p) => {
                      const isSel = selected.has(p);
                      return (
                        <CommandItem
                          key={p}
                          value={p}
                          onSelect={() => toggle(p)}
                          className="font-mono"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5",
                              isSel ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {p}
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
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-mono"
            >
              {p}
              <button
                type="button"
                onClick={() => toggle(p)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${p}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
