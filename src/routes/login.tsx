import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Leaf } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/inbox" }); });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        nav({ to: "/inbox" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created — signing you in");
        nav({ to: "/inbox" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Google sign-in failed");
    else if (!res.redirected) nav({ to: "/inbox" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-primary text-primary-foreground">
        <div className="flex items-center gap-2 font-display text-lg">
          <Leaf className="h-6 w-6" /> Resustainability
        </div>
        <div>
          <h1 className="text-5xl font-bold leading-tight">SAP MM & SD<br/>Approvals, anywhere.</h1>
          <p className="mt-4 max-w-md text-primary-foreground/90">
            Approve POs, PRs, NFAs, sales orders and gate passes — fully integrated with SAP, with role-based access and real-time alerts.
          </p>
        </div>
        <p className="text-sm opacity-80">© {new Date().getFullYear()} Resustainability Limited</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-gradient-surface">
        <Card className="w-full max-w-md p-8 shadow-elegant">
          <h2 className="font-display text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h2>
          <p className="text-sm text-muted-foreground mt-1">Use your Resustainability credentials.</p>

          <Button onClick={google} variant="outline" className="mt-6 w-full">Continue with Google</Button>
          <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center">
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>

          {mode === "signin" && (
            <div className="mt-6 rounded-md border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Demo accounts (password: Demo@1234)</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Admin", email: "admin@demo.app" },
                  { label: "HOD", email: "hod@demo.app" },
                  { label: "Finance", email: "finance@demo.app" },
                  { label: "Requester", email: "requester@demo.app" },
                ].map((a) => (
                  <Button
                    key={a.email}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => { setEmail(a.email); setPassword("Demo@1234"); }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
