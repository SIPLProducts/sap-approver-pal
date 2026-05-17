import { createFileRoute } from "@tanstack/react-router";
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
import { Bell, BellOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
        <p className="text-sm text-muted-foreground">Your SAP profile and contact details.</p>
      </div>
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
