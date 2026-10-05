"use client";

// Shared, interpretable building blocks: every AI output shows label -> reason -> confidence -> review flag.

import {
  AlertTriangle, Bot, CheckCircle2, CircleHelp, Code2, Flag, Loader2, PencilLine, ShieldCheck, Siren, UserRound,
} from "lucide-react";
import type { CallMeta, Confidence, Fit } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApp } from "./app-state";

type Tone = "red" | "orange" | "amber" | "green" | "teal" | "slate" | "violet" | "blue" | "rose";

const TONES: Record<Tone, string> = {
  red: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900",
  orange: "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900",
  amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900",
  teal: "bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900",
  slate: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800/60 dark:text-stone-200 dark:ring-stone-700",
  violet: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900",
  blue: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
  rose: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900",
};

export function Pill({ tone = "slate", icon: Icon, children, className, title }: {
  tone?: Tone; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string; title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

const URGENCY: Record<string, { tone: Tone; label: string }> = {
  P1: { tone: "red", label: "P1 Urgent" },
  P2: { tone: "orange", label: "P2 High" },
  P3: { tone: "amber", label: "P3 Normal" },
  P4: { tone: "slate", label: "P4 Low" },
};
export const UrgencyBadge = ({ u }: { u: string }) => (
  <Pill tone={URGENCY[u]?.tone ?? "slate"} icon={u === "P1" ? Siren : undefined}>{URGENCY[u]?.label ?? u}</Pill>
);

const CONF: Record<Confidence, { tone: Tone; icon: typeof CheckCircle2 }> = {
  high: { tone: "green", icon: CheckCircle2 },
  medium: { tone: "amber", icon: CircleHelp },
  low: { tone: "red", icon: AlertTriangle },
};
export const ConfidenceBadge = ({ c }: { c: Confidence }) => (
  <Pill tone={CONF[c].tone} icon={CONF[c].icon}>{c[0].toUpperCase() + c.slice(1)} confidence</Pill>
);

const FIT_TONE: Record<Fit, Tone> = { "Strong Fit": "teal", "Possible Fit": "amber", "Poor Fit": "rose" };
export const FitBadge = ({ f, className }: { f: Fit; className?: string }) => <Pill tone={FIT_TONE[f]} className={className}>{f}</Pill>;
export const fitColor = (f: Fit) => ({ "Strong Fit": "bg-teal-500", "Possible Fit": "bg-amber-400", "Poor Fit": "bg-rose-500" })[f];

export function VerdictBadge({ status }: { status: "pass" | "revised" | "escalated" | "revise" }) {
  if (status === "pass") return <Pill tone="green" icon={ShieldCheck}>Judge: PASS</Pill>;
  if (status === "revised") return <Pill tone="amber" icon={PencilLine}>Judge: REVISED</Pill>;
  if (status === "revise") return <Pill tone="amber" icon={PencilLine}>Judge: REVISE</Pill>;
  return <Pill tone="red" icon={UserRound}>Escalated to human</Pill>;
}

export function ReviewFlag({ reasons, compact }: { reasons?: string[]; compact?: boolean }) {
  if (compact) return <Pill tone="red" icon={Flag} title={reasons?.join("\n")}>Needs human review</Pill>;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
      <div className="mb-1 flex items-center gap-1.5 font-semibold"><Flag className="size-4" /> Needs human review</div>
      {reasons && reasons.length > 0 && (
        <ul className="ml-5 list-disc space-y-0.5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      )}
    </div>
  );
}

export function Why({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground/70">Why: </span>{children}</p>;
}

/** Provenance footer: model, latency, cost, prompt version, and the full prompt on demand. */
export function MetaFooter({ calls, title, cached }: { calls: CallMeta[]; title: string; cached?: boolean }) {
  const { inspect } = useApp();
  if (!calls.length) return null;
  const c = calls[0];
  const latency = Math.max(...calls.map((x) => x.latency_ms));
  const cost = calls.reduce((s, x) => s + (x.cost_usd ?? 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Bot className="size-3.5" />{c.model}</span>
      <span>{calls.length > 1 ? `${calls.length} calls · ` : ""}{(latency / 1000).toFixed(1)}s</span>
      {cost > 0 && <span title={c.provider === "claude" ? "Billed to Claude plan; API-equivalent cost" : "Estimated API cost"}>~${cost.toFixed(4)}</span>}
      <span>prompt {c.prompt_version}</span>
      {cached && <span>replayed from cache</span>}
      <button onClick={() => inspect(calls, title)} className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
        <Code2 className="size-3.5" /> View prompt
      </button>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
    </div>
  );
}

export function SectionIntro({ chapter, title, who, children }: { chapter: string; title: string; who: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
        <Pill tone="teal">{chapter}</Pill>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{children}</p>
      <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground/70">For:</span> {who}</p>
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>{children}</div>;
}
