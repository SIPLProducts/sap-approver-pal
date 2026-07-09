import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePush } from "@/hooks/use-push";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Mail, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const push = usePush();
  const { data: p } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const [form, setForm] = useState({ full_name: "", sap_user_id: "", designation: "", plant: "", business_unit: "", company_code: "", phone: "" });

  if (p && !form.full_name && p.full_name) {
    setForm({
      full_name: p.full_name ?? "",
      sap_user_id: p.sap_user_id ?? "",
      designation: p.designation ?? "",
      plant: p.plant ?? "",
      business_unit: p.business_unit ?? "",
      company_code: p.company_code ?? "",
      phone: p.phone ?? "",
    });
  }

  async function save() {
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile", user!.id] }); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your SAP profile, contact details, and notification channels.</p>
      </div>

      <Card className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Browser & PWA push</h2>
              {push.enabled && <Badge variant="secondary">Enabled</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time push alerts for new approvals, even when the app is closed.
              {!push.supported && " Not available in this preview — open the published app on a supported browser."}
            </p>
          </div>
          {push.enabled ? (
            <Button variant="outline" disabled={push.busy} onClick={push.disable}>
              <BellOff className="w-4 h-4 mr-2" /> Disable
            </Button>
          ) : (
            <Button disabled={!push.supported || push.busy} onClick={push.enable}>
              <Bell className="w-4 h-4 mr-2" /> Enable push
            </Button>
          )}
        </div>
      </Card>

      <Link to="/settings/email-config" className="block">
        <Card className="p-6 hover:bg-muted/40 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-accent p-2 text-accent-foreground">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Email Configuration</div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage SMTP credentials for outbound notifications.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </Card>
      </Link>

      <Card className="p-6 space-y-4">
        {[
          ["full_name","Full name"],["sap_user_id","SAP user ID"],["designation","Designation"],
          ["plant","Plant code"],["business_unit","Business unit (IWM / BMW / Recycling / ISS)"],
          ["company_code","Company code"],["phone","Phone (for SMS)"],
        ].map(([k,label]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{label}</Label>
            <Input id={k} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <Button onClick={save}>Save changes</Button>
      </Card>
    </div>
  );
}
