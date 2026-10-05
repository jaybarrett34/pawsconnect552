"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Lock, LockOpen, Moon, PawPrint, Sun } from "lucide-react";
import { api, ApiError, type Mode } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "./app-state";
import { cn } from "@/lib/utils";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const MODE_LABEL: Record<Mode, string> = { cached: "Demo (cached)", claude: "Live · Claude", gemini: "Live · Gemini" };
const MODE_DOT: Record<Mode, string> = { cached: "bg-stone-400", claude: "bg-violet-500", gemini: "bg-sky-500" };

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void }) => string; reset: (id?: string) => void };
  }
}

export function Header({ nav, controls = true }: { nav?: React.ReactNode; controls?: boolean }) {
  const { mode, setMode, config, refreshConfig } = useApp();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const live = (config?.providers ?? []) as Mode[];
  const needsUnlock = !!config?.gate_enabled && !config.unlocked;

  const choose = (m: Mode) => {
    if (m !== "cached" && needsUnlock) return setUnlockOpen(true);
    setMode(m);
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground"><PawPrint className="size-4" /></span>
          <span className="font-display text-lg font-semibold tracking-tight">PawsConnect</span>
        </Link>
        {nav}
        <div className="ml-auto flex items-center gap-2">
          {controls && <>
          <label className="sr-only" htmlFor="mode">Mode</label>
          <div className="relative">
            <span className={cn("pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full", MODE_DOT[mode])} />
            <select
              id="mode" value={mode} onChange={(e) => choose(e.target.value as Mode)}
              className="h-9 appearance-none rounded-full border bg-card pl-7 pr-8 text-sm font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="cached">{MODE_LABEL.cached}</option>
              {(["claude", "gemini"] as Mode[]).map((m) => (
                <option key={m} value={m} disabled={!live.includes(m)}>
                  {MODE_LABEL[m]}{live.includes(m) ? "" : " (unavailable)"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
          </div>
          {config?.gate_enabled && (
            <button
              onClick={() => setUnlockOpen(true)} disabled={config.unlocked}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium shadow-sm disabled:opacity-70"
            >
              {config.unlocked ? <LockOpen className="size-4 text-primary" /> : <Lock className="size-4" />}
              <span className="hidden sm:inline">{config.unlocked ? "Live unlocked" : "Unlock live"}</span>
            </button>
          )}
          </>}
          <ThemeToggle />
        </div>
      </div>
      <UnlockDialog open={unlockOpen} onOpenChange={setUnlockOpen} onUnlocked={async () => {
        await refreshConfig();
        setUnlockOpen(false);
        const first = live[0];
        if (first) setMode(first);
      }} />
    </header>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} aria-label="Toggle dark mode" className="grid size-9 place-items-center rounded-full border bg-card shadow-sm">
      <Sun className="size-4 dark:hidden" /><Moon className="hidden size-4 dark:block" />
    </button>
  );
}

function UnlockDialog({ open, onOpenChange, onUnlocked }: { open: boolean; onOpenChange: (o: boolean) => void; onUnlocked: () => void }) {
  const { config, refreshConfig } = useApp();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => setRemaining(config?.locked ? config.retry_after : 0), [config]);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => { if (r <= 1) { refreshConfig(); return 0; } return r - 1; }), 1000);
    return () => clearInterval(t);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !TURNSTILE_SITE_KEY) return;
    const id = setInterval(() => {
      if (window.turnstile && widget.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(widget.current, { sitekey: TURNSTILE_SITE_KEY, callback: setToken });
        clearInterval(id);
      }
    }, 200);
    return () => { clearInterval(id); widgetId.current = undefined; };
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.unlock(code, token);
      setCode("");
      onUnlocked();
    } catch (err) {
      const d = err instanceof ApiError ? (err.detail as { retry_after?: number; attempts_left?: number } | undefined) : undefined;
      if (d?.retry_after) setRemaining(d.retry_after);
      setMsg(err instanceof Error ? err.message + (d?.attempts_left ? ` · ${d.attempts_left} attempt left` : "") : "Unlock failed");
      window.turnstile?.reset(widgetId.current);
      setToken(undefined);
      refreshConfig();
    } finally {
      setBusy(false);
    }
  };

  const locked = remaining > 0;
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      {TURNSTILE_SITE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock live mode</DialogTitle>
          <DialogDescription>
            Live mode calls a real model and costs money, so it&apos;s passcode-protected. Two wrong attempts lock it for 30 minutes.
            The cached demo always works.
          </DialogDescription>
        </DialogHeader>
        {locked ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            Live mode locked · <span className="font-mono font-semibold">{mmss}</span>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode"
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {TURNSTILE_SITE_KEY && <div ref={widget} />}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{config?.attempts_left ?? 2} attempt{config?.attempts_left === 1 ? "" : "s"} remaining</span>
              <button
                disabled={busy || !code || (!!TURNSTILE_SITE_KEY && !token)}
                className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Checking…" : "Unlock"}
              </button>
            </div>
            {msg && <p className="text-sm text-red-700 dark:text-red-300">{msg}</p>}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
