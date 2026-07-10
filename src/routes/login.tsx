import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sapLogin } from "@/lib/auth/sap-login.functions";
import { sapForgot } from "@/lib/auth/sap-forgot.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { ShieldCheck, Lock, FileCheck2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const sapLoginFn = useServerFn(sapLogin);
  const sapForgotFn = useServerFn(sapForgot);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/inbox" });
    });
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
        if (result.profile) {
          const { setSapProfile } = await import("@/hooks/use-sap-profile");
          setSapProfile(result.profile);
        }
        toast.success("Welcome");
        nav({ to: "/inbox" });
      } else {
        const { error } = await supabase.auth.signUp({
          email: userId,
          password,
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
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Secure SAP Approvals
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.02] tracking-tight">
            Approve with
            <br />
            <span className="text-white/55">confidence.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            A secure, single sign-on gateway to review and approve your SAP transactions — protected end-to-end and
            fully audit-ready.
          </p>

          <ul className="mt-10 space-y-3 max-w-md text-sm text-white/75">
            <li className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-gold shrink-0" />
              <span>Enterprise-grade authentication with encrypted sessions.</span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-gold shrink-0" />
              <span>Role-based access aligned to your SAP authorizations.</span>
            </li>
            <li className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-4 w-4 text-gold shrink-0" />
              <span>Every approval signed, timestamped and audit-logged.</span>
            </li>
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> SSO · MFA · SAP-certified
          </span>
          <p>© {new Date().getFullYear()} Re Sustainability Limited</p>
        </div>
      </div>

      {/* Sign-in column */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-8 flex justify-center">
            <BrandLogo className="h-9" />
          </div>

          <div className="mb-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {mode === "signin" ? "Welcome back" : "Get started"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in to your console" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Use your Re Sustainability corporate credentials.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">
                  Full name
                </Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="userId" className="text-xs font-medium">
                User ID
              </Label>
              <Input
                id="userId"
                type="text"
                autoComplete="username"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId) ? userId : "");
                      setForgotOpen((v) => !v);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-11"
              />
            </div>
            {forgotOpen && mode === "signin" && (
              <div className="rounded-xl border bg-secondary/40 p-4 space-y-2">
                <Label htmlFor="forgotEmail" className="text-xs font-medium">
                  Email
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="Enter your mail"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-10 flex-1"
                  />
                  <Button
                    type="button"
                    disabled={forgotBusy || !forgotEmail.trim()}
                    className="h-10"
                    onClick={async () => {
                      setForgotBusy(true);
                      try {
                        const result = await sapForgotFn({ data: { email: forgotEmail.trim() } });
                        if (result.ok) {
                          toast.success("Password reset request sent");
                          setForgotOpen(false);
                          setForgotEmail("");
                        } else {
                          toast.error(result.error ?? "Could not send reset request");
                        }
                      } catch (err: any) {
                        toast.error(err?.message ?? "Could not send reset request");
                      } finally {
                        setForgotBusy(false);
                      }
                    }}
                  >
                    {forgotBusy ? "Sending…" : "Send"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  We'll trigger the SAP password reset for this email.
                </p>
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full h-11 font-medium group">
              {busy ? (
                "Please wait…"
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}{" "}
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          ></button>

          {mode === "signin" && (
            <div className="mt-8 rounded-xl border bg-secondary/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                Demo account <span className="font-normal normal-case tracking-normal">· password Demo@1234</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs font-medium"
                onClick={() => {
                  setUserId("admin@demo.app");
                  setPassword("Demo@1234");
                }}
              >
                Admin
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
