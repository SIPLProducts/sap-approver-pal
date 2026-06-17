import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Zap, Bell, Smartphone, Layers, BarChart3, ArrowRight, CheckCircle2,
  Package, Truck, Globe2, Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inbox" });
    throw redirect({ to: "/login" });
  },
  component: LandingPage,
});

function LandingPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  const primaryHref = authed ? "/inbox/mm" : "/login";
  const primaryLabel = authed ? "Open Inbox" : "Sign in";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-9" />
          </Link>
          <nav className="ml-6 hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#security" className="hover:text-foreground">Security</a>
            <a href="#devices" className="hover:text-foreground">Devices</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to={primaryHref}>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                {primaryLabel} <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px, 60px 60px",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-primary-foreground">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Enterprise SAP Approvals
              </div>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
                SAP MM &amp; SD <br />
                <span className="text-white/90">Approvals, anywhere.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base sm:text-lg text-primary-foreground/85">
                Re Sustainability's enterprise approvals hub — POs, PRs, NFAs, sales
                orders and gate passes, fully integrated with SAP. Role-based access,
                real-time alerts, and a familiar interface on every device.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to={primaryHref}>
                  <Button size="lg" className="bg-white text-foreground hover:bg-white/90">
                    {primaryLabel} <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
                    Explore features
                  </Button>
                </a>
              </div>
              <ul className="mt-8 grid grid-cols-2 gap-3 max-w-md text-sm text-primary-foreground/85">
                {["Native SAP integration", "Mobile, tablet & desktop", "Push & in-app alerts", "Role-based release strategies"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-white" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero card */}
            <div className="relative">
              <div className="absolute -inset-6 bg-white/10 blur-3xl rounded-[3rem] -z-10" />
              <div className="rounded-2xl bg-card text-card-foreground shadow-elegant border overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center gap-3">
                  <BrandLogo className="h-6" />
                  <div className="text-xs text-muted-foreground">Approvals Inbox</div>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-primary font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live
                  </span>
                </div>
                <div className="divide-y">
                  {[
                    { t: "PO #4500023118 — Bio-fuel resin", a: "₹ 12,40,000 • Plant HYD-01", b: "MM" },
                    { t: "Sales Order #1100087432 — RDF dispatch", a: "₹ 6,82,500 • SD / Region South", b: "SD" },
                    { t: "PR #1000093321 — Lab consumables", a: "₹ 1,45,200 • Plant DEL-02", b: "MM" },
                  ].map((r) => (
                    <div key={r.t} className="px-5 py-3 flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-md grid place-items-center ${r.b === "MM" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                        {r.b === "MM" ? <Package className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{r.t}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.a}</div>
                      </div>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r.b}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-muted/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span>3 pending • avg cycle 4h 12m</span>
                  <span className="font-medium text-foreground">View all →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-6">
          <BrandLogo className="h-7 opacity-90" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Trusted by approvers across Plants • Procurement • Finance • Sales
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Built for Re Sustainability</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
              Every SAP approval in one cockpit
            </h2>
            <p className="mt-4 text-muted-foreground">
              Replace email chains and SAP GUI hunts with a focused approvals workspace
              that respects your release strategies and runs on any device.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { i: Zap, t: "Real-time SAP sync", d: "Z REST endpoints feed pending items into your inbox the moment they're created." },
              { i: ShieldCheck, t: "Release strategies", d: "Multi-level chains by document type, plant, BU and value band — exactly as in SAP." },
              { i: Bell, t: "Push & in-app alerts", d: "Web Push with VAPID + service worker keeps approvers notified, even off the app." },
              { i: Smartphone, t: "Mobile-first UI", d: "Approve on phone in the corridor, tablet on the floor, desktop at HQ." },
              { i: Layers, t: "MM & SD modules", d: "Purchase orders, requisitions, NFAs, sales orders, gate passes — one workflow." },
              { i: BarChart3, t: "Auditable history", d: "Every decision, comment and SAP write-back captured with timestamps and roles." },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-xl border bg-card p-6 hover:shadow-elegant transition-shadow">
                <div className="h-10 w-10 rounded-md grid place-items-center bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-20 lg:py-24 bg-gradient-surface border-y">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
          <div className="rounded-2xl border bg-card p-8 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center"><Package className="h-5 w-5" /></div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Materials Management</div>
                <h3 className="text-xl font-semibold">MM Approvals</h3>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {["Purchase Orders (ME29N)", "Purchase Requisitions (ME54N)", "Service Entry Sheets", "NFA / spend approvals"].map((x) => (
                <li key={x} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-8 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-foreground text-background grid place-items-center"><Truck className="h-5 w-5" /></div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Sales &amp; Distribution</div>
                <h3 className="text-xl font-semibold">SD Approvals</h3>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {["Sales Orders (VA02)", "Credit limit releases (VKM3)", "Delivery & gate passes", "Pricing condition approvals"].map((x) => (
                <li key={x} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Devices */}
      <section id="devices" className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary">One experience, every screen</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
              Approve from the plant floor, the boardroom, or the back of a car.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Installable as a PWA on iOS and Android. Touch-optimised cards on phone,
              dense tables on desktop, and a tablet layout that's perfect for site walks.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">iOS</span>
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">Android</span>
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">Windows</span>
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">macOS</span>
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">PWA</span>
            </div>
          </div>
          <div className="relative grid grid-cols-12 gap-4">
            {/* Desktop */}
            <div className="col-span-12 sm:col-span-8 rounded-xl border bg-card shadow-elegant overflow-hidden">
              <div className="px-3 py-2 border-b flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <BrandLogo className="h-4 ml-3" />
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <div className="h-20 rounded bg-primary/10" />
                <div className="h-20 rounded bg-muted" />
                <div className="h-20 rounded bg-muted" />
                <div className="h-20 rounded bg-muted col-span-2" />
                <div className="h-20 rounded bg-accent" />
              </div>
            </div>
            {/* Phone */}
            <div className="col-span-12 sm:col-span-4 rounded-2xl border bg-card shadow-elegant overflow-hidden">
              <div className="px-3 py-2 border-b flex justify-center"><BrandLogo className="h-4" /></div>
              <div className="p-3 space-y-2">
                <div className="h-10 rounded bg-primary/10" />
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-accent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-20 lg:py-24 bg-gradient-surface border-y">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Enterprise-grade by default</h2>
          <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
            Built on Re Sustainability's standards for access, auditability and integration security.
          </p>
          <div className="mt-10 grid sm:grid-cols-3 gap-5 text-left">
            {[
              { i: Lock, t: "Role-based access", d: "HOD, Finance Head, Admin and IC roles enforced via row-level security." },
              { i: ShieldCheck, t: "SAP-side controls", d: "Technical user + Z-wrapper with basic auth — no GUI credentials exposed." },
              { i: Globe2, t: "Encrypted in transit", d: "TLS everywhere, signed webhooks, and audit trails on every approval action." },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-xl border bg-card p-6">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-10 lg:p-14 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-10">
              <div className="bg-white rounded-md px-3 py-2 shadow-card"><BrandLogo className="h-8" /></div>
              <div className="flex-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Approvals that move at the speed of operations.</h3>
                <p className="mt-2 text-primary-foreground/85">Sign in with your Re Sustainability account and start clearing your inbox in minutes.</p>
              </div>
              <Link to={primaryHref}>
                <Button size="lg" className="bg-white text-foreground hover:bg-white/90">
                  {primaryLabel} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandLogo className="h-9" />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Re Sustainability Limited — Asia's leading environmental services and
              sustainability solutions company. This portal powers SAP approvals across our plants and regions.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#modules" className="hover:text-foreground">Modules</a></li>
              <li><a href="#devices" className="hover:text-foreground">Devices</a></li>
              <li><a href="#security" className="hover:text-foreground">Security</a></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Account</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/login" className="hover:text-foreground">Sign in</Link></li>
              <li><Link to="/inbox/mm" className="hover:text-foreground">MM Approvals</Link></li>
              <li><Link to="/inbox/sd" className="hover:text-foreground">SD Approvals</Link></li>
              <li><Link to="/notifications" className="hover:text-foreground">Notifications</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-5" />
              <span>© {new Date().getFullYear()} Re Sustainability Limited. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="#" className="hover:text-foreground">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
