import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/mm/znfa-release")({
  component: ZnfaReleasePage,
});

type Mode = "creation" | "release";

const CREATION_ACTIONS = [
  "Create",
  "Change",
  "Clarification",
  "Release",
  "Display",
  "Approved List",
];

const RELEASE_ACTIONS = ["Release", "Display", "Approved List"];

function ZnfaReleasePage() {
  const [mode, setMode] = useState<Mode>("creation");
  const [action, setAction] = useState<string | null>(null);

  const actions = mode === "creation" ? CREATION_ACTIONS : RELEASE_ACTIONS;

  function onModeChange(v: string) {
    setMode(v as Mode);
    setAction(null);
  }

  function onAction(label: string) {
    setAction(label);
    toast.info(`${label} selected`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ZNFA Release</h1>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> SELECTION SCREEN
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={onModeChange}
              className="flex flex-wrap items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="creation" id="znfa-mode-creation" />
                <Label htmlFor="znfa-mode-creation" className="text-sm font-normal">
                  Creation
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="release" id="znfa-mode-release" />
                <Label htmlFor="znfa-mode-release" className="text-sm font-normal">
                  Release
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions.map((label) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={action === label ? "default" : "outline"}
                className="h-9"
                onClick={() => onAction(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
