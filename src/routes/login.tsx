import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sapLogin } from "@/lib/auth/sap-login.functions";
import { sapForgot } from "@/lib/auth/sap-forgot.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import {
  ShieldCheck,
  Lock,
  FileCheck2,
  ArrowRight,
  ClipboardList,
  Clock,
  BarChart3,
  Zap,
  User as UserIcon,
} from "lucide-react";
import heroArt from "@/assets/login-hero-approvals.png";
import officeArt from "@/assets/login-office-lineart.png";

export const Route = createFileRoute("/login")({ component: LoginPage });

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Secure & Trusted",
    body: "Enterprise-grade authentication with encrypted sessions.",
  },
  {
    icon: ClipboardList,
    title: "Role-Based Access",
    body: "Access approvals aligned to your SAP authorizations.",
  },
  {
    icon: Clock,
    title: "Timely Decisions",
    body: "Real-time approvals to keep business moving.",
  },
  {
    icon: FileCheck2,
    title: "Audit Ready",
    body: "Every action is tracked, timestamped and audit-logged.",
  },
];

const TRUST = [
  { icon: ShieldCheck, title: "Secure", body: "SSO · MFA · SAP-certified" },
  { icon: BarChart3, title: "Reliable", body: "99.9% Uptime" },
  { icon: Zap, title: "Efficient", body: "Faster approvals, better outcomes" },
];

function LoginPage() {
  const nav = useNavigate();
  const sapLoginFn = useServerFn(sapLogin);
  const sapForgotFn = useServerFn(sapForgot);
  const [userId, setUserId] = useState("");

  const [password, setPassword] = useState("");
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
      {
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
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden grid lg:grid-cols-[1.22fr_1fr] bg-background">
      {/* Executive hero panel */}
      <div className="relative isolate overflow-hidden bg-gradient-exec text-white flex flex-col min-h-[42vh] lg:h-dvh">

        <div className="dot-grid absolute inset-0 text-white/30 opacity-30 pointer-events-none" />
        <div
          className="absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 62%)" }}
        />
        <div
          className="absolute -top-32 -right-24 h-[24rem] w-[24rem] rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 65%)" }}
        />

        <div className="relative flex-1 min-h-0 lg:overflow-y-auto flex flex-col justify-center gap-[clamp(1.25rem,3vh,2.5rem)] p-8 px-[clamp(1.5rem,4vw,3.5rem)] py-[clamp(1.5rem,4vh,3.5rem)]">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card">
              <BrandLogo className="h-8 w-10" />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">Re Sustainability</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
                Executive Approvals
              </div>
            </div>
          </div>

          {/* Headline + illustration */}
          <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 max-w-lg">
              <h1 className="font-display text-[clamp(1.9rem,3.4vw+0.4rem,3rem)] font-bold leading-[1.05] tracking-tight">
                Approvals
                <br />
                <span className="text-gold">that drive progress.</span>
              </h1>
              <div className="mt-[clamp(0.75rem,1.5vh,1.25rem)] h-[3px] w-16 rounded-full bg-gold" />
              <p className="mt-[clamp(0.75rem,1.5vh,1.25rem)] max-w-md text-[15px] leading-relaxed text-white/70">
                A secure, single sign-on gateway to review, approve and manage your SAP transactions – with
                control, transparency and trust.
              </p>

              <ul className="mt-[clamp(1.25rem,2.6vh,2.25rem)] space-y-[clamp(0.65rem,1.4vh,1rem)]">
                {FEATURES.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/40 bg-white/[0.04]">
                      <Icon className="h-5 w-5 text-gold" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{title}</span>
                      <span className="mt-0.5 block max-w-[19rem] text-[13px] leading-relaxed text-white/60">
                        {body}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <img
              src={heroArt}
              alt="Approval request document with security shield and dashboard"
              width={1024}
              height={1024}
              className="hidden xl:block w-[clamp(12rem,20vw,24rem)] max-h-[46vh] object-contain max-w-full select-none drop-shadow-2xl"
              draggable={false}
            />
          </div>

        </div>

        {/* Trust strip */}
        <div className="relative border-t border-white/10 px-8 lg:px-14 py-6">
          <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
            {TRUST.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className={`flex items-center gap-3 ${i > 0 ? "sm:pl-6" : ""}`}>
                <Icon className="h-5 w-5 shrink-0 text-gold" />
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-[12px] text-white/55">{body}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] text-white/40">
            © {new Date().getFullYear()} Re Sustainability Limited
          </p>
        </div>
      </div>

      {/* Sign-in column */}
      <div className="relative isolate flex items-center justify-center overflow-hidden bg-gradient-surface p-6 sm:p-10">
        <img
          src={officeArt}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={1024}
          height={768}
          className="pointer-events-none absolute bottom-0 right-0 w-[34rem] max-w-full select-none opacity-[0.22]"
          draggable={false}
        />

        <div className="relative w-full max-w-[420px]">
          <div className="lg:hidden mb-8 flex justify-center">
            <BrandLogo className="h-9" />
          </div>

          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Welcome To Re Sustainability
            </p>
            <div className="mt-3 h-[3px] w-14 rounded-full bg-gold" />
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Sign in to your Account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your Re Sustainability corporate credentials.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="userId" className="text-[13px] font-medium">
                User ID
              </Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="userId"
                  type="text"
                  autoComplete="username"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="h-12 rounded-lg border-border bg-secondary/70 pl-10 text-[15px] shadow-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  Password
                </Label>
                <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId) ? userId : "");
                      setForgotOpen((v) => !v);
                    }}
                    className="text-[12px] font-semibold text-primary hover:text-primary/80"
                  >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-12 rounded-lg border-border bg-secondary/70 pl-10 text-[15px] shadow-none"
                />
              </div>
            </div>
            <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Recover your password</DialogTitle>
                  <DialogDescription>Enter your account email and we'll send you a password.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="forgotEmail" className="text-xs font-medium uppercase tracking-wide">
                    Email
                  </Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-11"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForgotOpen(false)}
                    disabled={forgotBusy}
                    className="h-11"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={forgotBusy || !forgotEmail.trim()}
                    className="h-11"
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
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              type="submit"
              disabled={busy}
              className="mt-2 w-full h-12 rounded-lg text-[15px] font-semibold group"
            >
              {busy ? (
                "Please wait…"
              ) : (
                <>
                  Sign in{" "}
                  <ArrowRight className="h-4 w-4 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
