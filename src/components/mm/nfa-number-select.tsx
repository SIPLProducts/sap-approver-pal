import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { fetchZnfaNfaList } from "@/lib/mm/znfa-nfa-list.functions";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** SAP login user id sent as the F4 payload { USER }. */
  user: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/** Main NFA Number field with SAP F4 help (ZNFA_NFA_GET_API). */
export function NfaNumberSelect({
  value,
  onChange,
  user,
  disabled,
  className,
  placeholder = "Select NFA number…",
}: Props) {
  const [open, setOpen] = useState(false);
  const fetchList = useServerFn(fetchZnfaNfaList);

  const listQuery = useQuery({
    queryKey: ["znfa-nfa-list", user],
    queryFn: () => fetchList({ data: { user } }),
    enabled: !!user.trim(),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(() => listQuery.data?.numbers ?? [], [listQuery.data]);
  const sapMessage = listQuery.data?.sapMessage ?? listQuery.data?.error ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full max-w-[420px] justify-between",
            !value && "font-sans text-muted-foreground",
            className,
          )}
        >
          <span className={cn("truncate text-left", value && "font-mono text-xs")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[1000] max-h-[60vh] w-[340px] p-0"
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
      >
        <Command>
          <CommandInput placeholder="Search NFA number…" className="h-9" />
          <CommandList className="max-h-[calc(60vh-3rem)]">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching NFA numbers…
              </div>
            ) : listQuery.isError ? (
              <div className="space-y-1 px-3 py-4 text-xs text-destructive">
                <div className="font-medium">Failed to load NFA numbers.</div>
                <div className="break-words text-[11px] opacity-80">
                  {(listQuery.error as Error)?.message ?? "Unknown error"}
                </div>
                <button className="underline" onClick={() => listQuery.refetch()}>
                  Retry
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                {sapMessage ?? "No NFA numbers returned. Check SAP API Settings."}
              </div>
            ) : (
              <>
                <CommandEmpty>No NFA number found.</CommandEmpty>
                <CommandGroup>
                  {options.map((n) => (
                    <CommandItem
                      key={n}
                      value={n}
                      onSelect={() => {
                        onChange(n === value ? "" : n);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-3.5 w-3.5", value === n ? "opacity-100" : "opacity-0")}
                      />
                      <span className="font-mono text-xs">{n}</span>
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
