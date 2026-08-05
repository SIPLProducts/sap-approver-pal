import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

/** Main NFA Number field with SAP F4 help (ZNFA_NFA_GET_API). */
export function NfaNumberSelect({ value, onChange, user, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const fetchList = useServerFn(fetchZnfaNfaList);

  const { data, isFetching } = useQuery({
    queryKey: ["znfa-nfa-list", user],
    queryFn: () => fetchList({ data: { user } }),
    enabled: open && !!user.trim(),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(() => data?.numbers ?? [], [data]);
  const message = data?.sapMessage ?? data?.error ?? null;

  return (
    <div className={cn("flex w-full max-w-[420px] items-center gap-2", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 flex-1 text-sm"
        placeholder="Enter Main NFA Number"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={disabled}
            aria-label="Search NFA numbers"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-60" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search NFA number…" />
            <CommandList>
              <CommandEmpty>
                {isFetching ? "Loading…" : (message ?? "No NFA numbers found.")}
              </CommandEmpty>
              <CommandGroup>
                {options.map((n) => (
                  <CommandItem
                    key={n}
                    value={n}
                    onSelect={() => {
                      onChange(n);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === n ? "opacity-100" : "opacity-0")}
                    />
                    <span className="font-mono text-xs">{n}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
