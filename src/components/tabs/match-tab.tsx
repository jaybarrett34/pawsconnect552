"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { api, type Envelope, type MatchResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApp, useRun } from "@/components/app-state";
import { ErrorNote, FitBadge, fitColor, Loading, MetaFooter, Panel, ReviewFlag, SectionIntro } from "@/components/kit";
import CountUp from "@/components/reactbits/CountUp";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

export const pickCard = (active: boolean) =>
  cn(
    "cursor-pointer rounded-2xl! border! bg-card! p-4! text-left transition",
    active ? "border-primary! ring-2 ring-primary/40" : "border-border! hover:border-primary/50!",
  );

export function MatchTab() {
  const { mode, samples } = useApp();
  const [profileId, setProfileId] = useState<string>();
  const [petId, setPetId] = useState<string>();
  const { data, loading, error, run } = useRun<Envelope<MatchResult>>();

  const profile = profileId ?? samples?.profiles[0]?.id;
  const pet = petId ?? samples?.pets[0]?.id;

  useEffect(() => {
    if (profile && pet) run(() => api.match({ mode, profile_id: profile, pet_id: pet }));
  }, [mode, profile, pet, run]);

  if (!samples) return <Loading label="Loading sample data…" />;

  return (
    <div>
      <SectionIntro chapter="Ch. 3 · Chain-of-thought + self-consistency" title="Match Explainer"
        who="Adoption counselors deciding which matches need a conversation">
        Given a household profile and a pet, the model reasons step by step, five independent times. The majority
        vote is the rating, and disagreement between runs shows how much to trust it.
      </SectionIntro>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adopter household</div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {samples.profiles.map((p) => (
          <div key={p.id} role="button" tabIndex={0} aria-pressed={p.id === profile}
            onClick={() => setProfileId(p.id)} onKeyDown={(e) => e.key === "Enter" && setProfileId(p.id)}>
            <SpotlightCard className={pickCard(p.id === profile)} spotlightColor="rgba(31, 111, 107, 0.15)">
              <div className="font-display font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.summary}</div>
            </SpotlightCard>
          </div>
        ))}
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pet</div>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {samples.pets.map((p) => (
          <button key={p.id} onClick={() => setPetId(p.id)} aria-pressed={p.id === pet}
            className={cn("flex items-center gap-3 rounded-2xl border bg-card p-2 text-left transition",
              p.id === pet ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/50")}>
            <img src={p.photo} alt={p.name} className="size-12 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0">
              <div className="font-semibold">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.breed}</div>
            </div>
          </button>
        ))}
      </div>

      {loading && <Loading label="Sampling 5 independent assessments…" />}
      {error && <ErrorNote error={error} />}
      {data && !loading && <MatchResultView env={data} />}
    </div>
  );
}

function MatchResultView({ env }: { env: Envelope<MatchResult> }) {
  const d = env.data;
  const n = d.votes.length;
  const count = d.counts[d.majority] ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel className="space-y-4 lg:col-span-3">
        <div className="flex flex-wrap items-center gap-3">
          <FitBadge f={d.majority} className="px-4 py-1.5 text-base" />
          <p className="text-sm">
            <strong><CountUp to={count} duration={0.6} /> of {n} runs: {d.majority}</strong>
          </p>
        </div>

        <div>
          <div className="flex h-8 gap-1 overflow-hidden rounded-xl" role="img"
            aria-label={`Votes: ${d.votes.join(", ")}`}>
            {d.votes.map((v, i) => (
              <div key={i} className={cn("flex flex-1 items-center justify-center text-[10px] font-semibold text-white", fitColor(v))}
                title={`Run ${i + 1}: ${v}`}>
                #{i + 1}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {Object.entries(d.counts).map(([fit, c]) => <span key={fit}>{fit}: {c}</span>)}
            <span>Agreement {Math.round(d.agreement * 100)}%</span>
          </div>
        </div>

        {!d.unanimous && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Runs disagreed. Treat this as a conversation starter, not a verdict.
          </div>
        )}
        {(d.tie || d.human_review) && (
          <ReviewFlag reasons={[d.tie
            ? "Votes tied. The tie was broken toward the more conservative rating."
            : `Low agreement (${Math.round(d.agreement * 100)}%). A counselor should review this match.`]} />
        )}

        <div>
          <div className="mb-2 text-sm font-semibold">Top reasons</div>
          <ul className="space-y-1.5">
            {d.top_reasons.map((r) => (
              <li key={r} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{r}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-0.5 font-semibold text-amber-900 dark:text-amber-200">Top concern to discuss</div>
          {d.top_concern}
        </div>
        <MetaFooter calls={env.calls} title="Match explainer" cached={env.cached} />
      </Panel>

      <Panel className="lg:col-span-2">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            <ChevronRight className="size-4 transition group-open:rotate-90" />
            See the step-by-step reasoning ({n} runs)
          </summary>
          <div className="mt-4 space-y-3">
            {d.runs.map((r, i) => (
              <div key={i} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Run #{i + 1}</span>
                  <FitBadge f={r.rating} />
                </div>
                <ol className="space-y-1.5 text-xs">
                  {r.steps.map((s, j) => (
                    <li key={j}><span className="font-semibold">{j + 1}. {s.step}:</span> <span className="text-muted-foreground">{s.analysis}</span></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </details>
        {!env.data.runs.length && <p className="text-sm text-muted-foreground">No runs.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Reasoning is hidden by default so the summary stays readable.</p>
      </Panel>
    </div>
  );
}
