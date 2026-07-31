import { useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SapReleaseKey } from "@/hooks/use-sap-profile";

const BLANK = "__blank__";

type Props = {
  keys: SapReleaseKey[];
  group: string;
  code: string;
  onGroupChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Release Group / Release Code F4 pair sourced from the Login_API response
 * (PR_KEYS / PO_KEYS of the selected plant). SAP sometimes returns a blank
 * REL_GROUP, which is shown as "(blank)" and submitted as an empty string.
 */
export function ReleaseKeySelect({
  keys,
  group,
  code,
  onGroupChange,
  onCodeChange,
  disabled,
}: Props) {
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of keys) {
      if (seen.has(k.relGroup)) continue;
      seen.add(k.relGroup);
      out.push(k.relGroup);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [keys]);

  const codes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of keys) {
      if (k.relGroup !== group) continue;
      if (seen.has(k.releaseCode)) continue;
      seen.add(k.releaseCode);
      out.push(k.releaseCode);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [keys, group]);

  const hasKeys = keys.length > 0;
  const groupSelected = groups.includes(group);

  // Drop selections that are no longer offered (e.g. after a plant change).
  useEffect(() => {
    if (!hasKeys) return;
    if (!groupSelected && (group || code)) {
      onGroupChange("");
      onCodeChange("");
      return;
    }
    if (code && !codes.includes(code)) onCodeChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKeys, groupSelected, codes.join(","), group, code]);

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Release Group</Label>
        <Select
          value={groupSelected ? group || BLANK : ""}
          onValueChange={(v) => {
            onGroupChange(v === BLANK ? "" : v);
            onCodeChange("");
          }}
          disabled={disabled || !hasKeys}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={hasKeys ? "Select group" : "No keys assigned"} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g || BLANK} value={g || BLANK}>
                {g || "(blank)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Release Code</Label>
        <Select
          value={codes.includes(code) ? code : ""}
          onValueChange={onCodeChange}
          disabled={disabled || !groupSelected || codes.length === 0}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue
              placeholder={
                !hasKeys ? "No keys assigned" : groupSelected ? "Select code" : "Select group first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {codes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
