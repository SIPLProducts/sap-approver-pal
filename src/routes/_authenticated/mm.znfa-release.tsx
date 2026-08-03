import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Search, User2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

type Buyer = { id: string; name: string; email: string; location: string };

const EMPTY_BUYER: Buyer = { id: "", name: "", email: "", location: "" };

function ZnfaReleasePage() {
  const [mode, setMode] = useState<Mode>("creation");
  const [action, setAction] = useState<string | null>(null);

  // Create form state (UI only for now)
  const [nfaType, setNfaType] = useState("");
  const [rfqNumber, setRfqNumber] = useState("");
  const [nfaTitle, setNfaTitle] = useState("");
  const [buyer, setBuyer] = useState<Buyer>(EMPTY_BUYER);

  const actions = mode === "creation" ? CREATION_ACTIONS : RELEASE_ACTIONS;
  const showCreate = mode === "creation" && action === "Create";

  function resetCreateForm() {
    setNfaType("");
    setRfqNumber("");
    setNfaTitle("");
    setBuyer(EMPTY_BUYER);
  }

  function onModeChange(v: string) {
    setMode(v as Mode);
    setAction(null);
    resetCreateForm();
  }

  function onAction(label: string) {
    setAction(label);
    resetCreateForm();
    toast.info(`${label} selected`);
  }

  function onRfqF4() {
    toast.info("RFQ Number F4 help will be enabled once the SAP API is configured.");
  }

  function onGetDetails() {
    if (!rfqNumber.trim()) {
      toast.error("Enter an RFQ Number");
      return;
    }
    toast.info("Get Details will fetch buyer details once the SAP API is configured.");
  }


  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ZNFA Release</h1>
      </div>

      <Card className="border border-border/60 p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {actions.map((label) => {
              const active = action === label;
              return (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-11 min-w-[140px] justify-center rounded-xl border px-4 font-medium transition-all duration-200",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] hover:bg-primary/90 hover:text-primary-foreground"
                      : "border-border bg-muted/60 text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-md"
                  )}
                  onClick={() => onAction(label)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
