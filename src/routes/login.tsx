import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { sapLogin } from "@/lib/auth/sap-login.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { ShieldCheck, Clock3, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const sapLoginFn = useServerFn(sapLogin);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [userId, setUserId] = useState("");
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
        // Try Supabase auth first when the user ID looks like an email.
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId);
        if (looksLikeEmail) {
          const { error } = await supabase.auth.signInWithPassword({ email: userId, password });
          if (!error) {
            toast.success("Welcome");
            nav({ to: "/inbox" });
            return;
          }
        }
        // Fall back to SAP proxy login.
        const result = await sapLoginFn({ data: { username: userId, password } });
        if (!result.ok) {
          toast.error(result.error ?? `Login failed (${result.status})`);
          return;
        }
        if (!result.email || !result.tokenHash) {
          toast.error("SAP login succeeded, but the app session could not be created.");
          return;
        }
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: result.tokenHash,
        });
        if (verifyError) throw verifyError;
        toast.success("Welcome");
        nav({ to: "/inbox" });
      } else {
        const { error } = await supabase.auth.signUp({
          email: userId, password,
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
    <div className="min-h-dvh grid lg:grid-cols-[1.15fr_1fr] bg-background">
      {/* Executive hero panel */}
      <div className="relative isolate overflow-hidden bg-gradient-exec text-white flex flex-col justify-between p-8 lg:p-14 min-h-[38vh] lg:min-h-dvh">
        <div className="dot-grid absolute inset-0 text-white/40 opacity-40 pointer-events-none" />
        <div
          className="absolute -bottom-32 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 60%)" }}
        />
        <div
          className="absolute -top-32 -right-32 h-[22rem] w-[22rem] rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 65%)" }}
        />

        <div className="relative flex items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-xl bg-white/95 px-3 py-2 shadow-card">
            <BrandLogo className="h-7" />
          </div>
          <div className="hidden sm:block">
            <div className="font-display text-sm font-semibold tracking-tight">Re Sustainability</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">Executive Approvals</div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> SAP-integrated · Live
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.02] tracking-tight">
            Approvals,
            <br />
            <span className="text-white/55">decided.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            One executive console for sales orders, contracts, pricing and service certificates —
            synced live with SAP, audited end-to-end.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-4 max-w-lg">
            {[
              { k: "Pending today", v: "12", sub: "across 4 modules" },
              { k: "Median decision", v: "1.8h", sub: "vs 9.4h SLA" },
              { k: "Approved · 7d", v: "184", sub: "₹42.6Cr value" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-white/55">{s.k}</dt>
                <dd className="mt-2 font-display text-2xl font-semibold tabular-nums">{s.v}</dd>
                <dd className="mt-0.5 text-[10px] text-white/45">{s.sub}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-4 text-[11px] text-white/55">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> SSO · MFA</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> 99.95% uptime</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> SAP-certified</span>
          </div>
          <p>© {new Date().getFullYear()} Re Sustainability Limited</p>
        </div>
      </div>

      {/* Sign-in column */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-8 flex justify-center"><BrandLogo className="h-9" /></div>

          <div className="mb-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {mode === "signin" ? "Welcome back" : "Get started"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in to your console" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your Re Sustainability corporate credentials.
            </p>
          </div>

          <Button onClick={google} variant="outline" className="w-full h-11 font-medium">
            <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.15.8 3.87 1.49l2.64-2.55C16.9 3.4 14.66 2.4 12 2.4 6.92 2.4 2.8 6.5 2.8 12s4.12 9.6 9.2 9.6c5.31 0 8.83-3.73 8.83-8.98 0-.6-.07-1.05-.16-1.52H12z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or with user ID</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="userId" className="text-xs font-medium">User ID</Label>
              <Input id="userId" type="text" autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                {mode === "signin" && <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground">Forgot?</button>}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="h-11" />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11 font-medium group">
              {busy ? "Please wait…" : <>{mode === "signin" ? "Sign in" : "Create account"} <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" /></>}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>

          {mode === "signin" && (
            <div className="mt-8 rounded-xl border bg-secondary/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                Demo accounts <span className="font-normal normal-case tracking-normal">· password Demo@1234</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Admin", userId: "admin@demo.app" },
                  { label: "HOD", userId: "hod@demo.app" },
                  { label: "Finance", userId: "finance@demo.app" },
                  { label: "Requester", userId: "requester@demo.app" },
                ].map((a) => (
                  <Button
                    key={a.userId}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => { setUserId(a.userId); setPassword("Demo@1234"); }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
