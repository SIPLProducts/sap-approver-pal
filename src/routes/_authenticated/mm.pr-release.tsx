import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Filter, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/mm/pr-release")({
  component: PrReleasePage,
});

function PrReleasePage() {
  const [level, setLevel] = useState<"single" | "multiple">("single");
  const [releaseGroup, setReleaseGroup] = useState("");
  const [releaseCode, setReleaseCode] = useState("");

  function execute() {
    toast.info(
      `Execute (${level === "single" ? "Single Level" : "Multiple Level"}) — Release Group: ${releaseGroup || "-"}, Release Code: ${releaseCode || "-"}`,
    );
  }

  function reset() {
    setLevel("single");
    setReleaseGroup("");
    setReleaseCode("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PR Release</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <RadioGroup
          value={level}
          onValueChange={(v) => setLevel(v as "single" | "multiple")}
          className="flex items-center gap-6 mb-4"
        >
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="single" id="pr-level-single" />
            Single Level
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="multiple" id="pr-level-multiple" />
            Multiple Level
          </label>
        </RadioGroup>

        <div className="grid gap-3 md:grid-cols-[240px_240px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Release Group</Label>
            <Input
              value={releaseGroup}
              onChange={(e) => setReleaseGroup(e.target.value)}
              placeholder="Release group"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Release Code</Label>
            <Input
              value={releaseCode}
              onChange={(e) => setReleaseCode(e.target.value)}
              placeholder="Release code"
              className="h-9 text-sm"
            />
          </div>
          <div />
          <div className="flex gap-2">
            <Button size="sm" onClick={execute}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Execute
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
