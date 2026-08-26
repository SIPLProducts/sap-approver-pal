import { useEffect, useMemo, useRef, useState } from "react";
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
import { fetchGatePassDocF4 } from "@/lib/mm/gate-pass-doc-f4.functions";

export type GatePassF4Flag = "" | "hod" | "stores" | "scm" | "plant";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** SAP login user id sent as USER_ID in the F4 payload. */
  userId: string;
  /** Which selection-screen checkbox is ticked; drives the payload flag. */
  flag: GatePassF4Flag;
  /** Called with the exact SAP failure text when the F4 call fails. */
  onFailure?: (message: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/** Gate Pass Number field with SAP F4 help (Gate_Pass_Doc_F4_API). */
export function GatePassNumberSelect({
  value,
  onChange,
  userId,
  flag,
  onFailure,
  disabled,
  className,
  placeholder = "Select gate pass number…",
}: Props) {
  const [open, setOpen] = useState(false);
  const fetchF4 = useServerFn(fetchGatePassDocF4);

  const enabled = !!userId.trim() && flag !== "";

  const listQuery = useQuery({
    queryKey: ["gate-pass-doc-f4", userId, flag],
    queryFn: () =>
      fetchF4({
        data: {
          user_id: userId,
          hod: flag === "hod",
          stores: flag === "stores",
          scm: flag === "scm",
          plant: flag === "plant",
        },
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(() => listQuery.data?.numbers ?? [], [listQuery.data]);
  const sapMessage = listQuery.data?.sapMessage ?? listQuery.data?.error ?? null;

  // Surface the exact SAP failure text once per response.
  const reportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      reportedRef.current = null;
      return;
    }
    const msg = sapMessage;
    const stamp = msg ? `${flag}|${msg}` : null;
    if (msg && reportedRef.current !== stamp) {
      reportedRef.current = stamp;
      onFailure?.(msg);
    }
    if (!msg) reportedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sapMessage, enabled, flag]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between",
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
        className="z-[1000] max-h-[60vh] w-[320px] p-0"
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
      >
        <Command>
          <CommandInput placeholder="Search gate pass number…" className="h-9" />
          <CommandList className="max-h-[calc(60vh-3rem)]">
            {!enabled ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                Select one approval option to load gate pass numbers.
              </div>
            ) : listQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching gate pass numbers…
              </div>
            ) : listQuery.isError ? (
              <div className="space-y-1 px-3 py-4 text-xs text-destructive">
                <div className="font-medium">Failed to load gate pass numbers.</div>
                <div className="break-words text-[11px] opacity-80">
                  {(listQuery.error as Error)?.message ?? "Unknown error"}
                </div>
                <button className="underline" onClick={() => listQuery.refetch()}>
                  Retry
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                {sapMessage ?? "No gate pass numbers returned."}
              </div>
            ) : (
              <>
                <CommandEmpty>No gate pass number found.</CommandEmpty>
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
