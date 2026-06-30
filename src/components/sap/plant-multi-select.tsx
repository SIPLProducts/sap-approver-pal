import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronsUpDown, Loader2, X } from "lucide-react";
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
import { getPlantConfig } from "@/lib/sap/plant.functions";
import { runSapApi } from "@/lib/sap/sap.functions";
import { extractPlantOptions } from "@/components/sap/plant-select";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
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
      return extractPlantOptions(resp?.data ?? resp, plantField);
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
    <div className={cn("relative", className)}>
      {value.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-10 flex flex-wrap gap-1 rounded-md border bg-popover/95 backdrop-blur p-1 shadow-sm max-h-24 overflow-y-auto">
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
          className="w-[320px] p-0 max-h-[340px] overflow-hidden"
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
                    <CommandItem
                      value="__select_all__"
                      onSelect={() => {
                        if (value.length === plants.length) onChange([]);
                        else onChange(plants.map((p) => p.code));
                      }}
                      className="font-medium border-b rounded-none"
                    >
                      <Checkbox
                        checked={value.length === plants.length}
                        tabIndex={-1}
                        className="pointer-events-none mr-2"
                      />
                      {value.length === plants.length
                        ? `Clear all (${plants.length})`
                        : `Select all (${plants.length})`}
                    </CommandItem>
                    {plants.map((p) => {
                      const isSel = selected.has(p.code);
                      return (
                        <CommandItem
                          key={p.code}
                          value={`${p.code} ${p.text}`}
                          onSelect={() => toggle(p.code)}
                        >
                          <Checkbox
                            checked={isSel}
                            tabIndex={-1}
                            className="pointer-events-none mr-2"
                          />
                          <span className="font-mono">{p.code}</span>
                          {p.text && (
                            <span className="ml-2 text-muted-foreground truncate">— {p.text}</span>
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
    </div>
  );
}
