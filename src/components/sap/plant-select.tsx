import { useMemo, useState } from "react";
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
import { getPlantConfig } from "@/lib/sap/plant.functions";
import { runSapApi } from "@/lib/sap/sap.functions";

interface Props {
  value: string;
  onChange: (v: string) => void;
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
      // fallback: first array-valued property
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

export function PlantSelect({
  value,
  onChange,
  placeholder = "Select plant…",
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

  // Fallback to plain input when config is missing or fetch failed
  if (!cfgQuery.isLoading && !configId) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 3801"
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
            "h-9 w-full justify-between font-mono",
            !value && "text-muted-foreground font-sans",
            className,
          )}
        >
          {cfgQuery.isLoading ? (
            <span className="flex items-center gap-2 font-sans">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          ) : (
            value || placeholder
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search plant…" className="h-9" />
          <CommandList>
            {plantsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching plants…
              </div>
            ) : plantsQuery.isError ? (
              <div className="px-3 py-4 text-xs text-destructive">
                Failed to load plants.
                <button
                  className="ml-2 underline"
                  onClick={() => plantsQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <CommandEmpty>No plant found.</CommandEmpty>
                <CommandGroup>
                  {plants.map((p) => (
                    <CommandItem
                      key={p}
                      value={p}
                      onSelect={(curr) => {
                        onChange(curr === value ? "" : curr);
                        setOpen(false);
                      }}
                      className="font-mono"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          value === p ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {p}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
