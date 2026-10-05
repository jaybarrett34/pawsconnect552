"use client";

import { useEffect, useState } from "react";
import { Grid3x3, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, type BiasResult, type Envelope, type Fit } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApp, useRun } from "@/components/app-state";
import { ErrorNote, FitBadge, fitColor, Loading, MetaFooter, Panel, Pill, ReviewFlag, SectionIntro } from "@/components/kit";
import StarBorder from "@/components/reactbits/StarBorder";

const FITS: Fit[] = ["Poor Fit", "Possible Fit", "Strong Fit"];


export function BiasTab() {
  const { mode, samples } = useApp();
  const [profileId, setProfileId] = useState<string>();
  const [petId, setPetId] = useState<string>();
  const { data, loading, error, run } = useRun<Envelope<BiasResult>>();
  const [grid, setGrid] = useState<Record<string, BiasResult>>({});
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const profile = profileId ?? samples?.profiles[0]?.id;
  const pet = petId ?? samples?.bias_pets[0];

  useEffect(() => {
    if (profile && pet) run(() => api.bias({ mode, profile_id: profile, pet_id: pet }));
  }, [mode, profile, pet, run]);

  useEffect(() => {
    if (data) setGrid((g) => ({ ...g, [`${data.data.profile_id}:${data.data.pet_id}`]: data.data }));
  }, [data]);

  if (!samples) return <Loading label="Loading sample data…" />;
  const pets = samples.pets.filter((p) => samples.bias_pets.includes(p.id));

  async function auditAll() {
    setAuditing(true);
    setAuditError(null);
    try {
      for (const pr of samples!.profiles) {
        for (const pe of pets) {
          const env = await api.bias({ mode, profile_id: pr.id, pet_id: pe.id });
          setGrid((g) => ({ ...g, [`${pr.id}:${pe.id}`]: env.data }));
        }
      }
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setAuditing(false);
    }
  }

  return (
    <div>
      <SectionIntro title="Bias Lens">
        Fairness audit for match ratings. The same listing is re-assessed with only the breed label changed; if the label
        alone moves the rating, the pair is flagged for Trust &amp; Safety review.
      </SectionIntro>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Household
          <select value={profile} onChange={(e) => setProfileId(e.target.value)}
            className="mt-1 block rounded-xl border bg-card px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground">
            {samples.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.summary}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          {pets.map((p) => (
            <button key={p.id} onClick={() => setPetId(p.id)} aria-pressed={p.id === pet}
              className={cn("flex items-center gap-2 rounded-xl border bg-card p-1.5 pr-3 text-sm transition",
                p.id === pet ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/50")}>
              <img src={p.photo} alt={p.name} className="size-8 rounded-lg object-cover" />
              <span className="font-semibold">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading label="Running 5 assessments for each breed label…" />}
      {error && <ErrorNote error={error} />}
      {data && !loading && <BiasResultView env={data} />}

      <Panel className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 font-display text-lg font-semibold"><Grid3x3 className="size-5" /> Full audit</div>
            <p className="text-xs text-muted-foreground">Shift in mean score (0–2) caused by the breed label alone, for every household × pet.</p>
          </div>
          <StarBorder as="button" onClick={auditAll} disabled={auditing} color="#D9734E" speed="5s"
            className="disabled:opacity-60">
            {auditing ? "Auditing…" : "Audit all pairs"}
          </StarBorder>
        </div>
        {auditError && <ErrorNote error={auditError} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1.5 text-sm">
            <thead>
              <tr>
                <th />
                {pets.map((p) => <th key={p.id} className="text-xs font-semibold text-muted-foreground">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {samples.profiles.map((pr) => (
                <tr key={pr.id}>
                  <th className="pr-2 text-left text-xs font-semibold text-muted-foreground">{pr.name}</th>
                  {pets.map((pe) => {
                    const r = grid[`${pr.id}:${pe.id}`];
                    const selected = pr.id === profile && pe.id === pet;
                    return (
                      <td key={pe.id}>
                        <button onClick={() => { setProfileId(pr.id); setPetId(pe.id); }}
                          className={cn("w-full rounded-xl px-3 py-3 text-center text-xs font-semibold ring-1 ring-inset transition",
                            !r ? "bg-muted text-muted-foreground ring-border"
                              : r.flipped ? "bg-red-100 text-red-900 ring-red-300 dark:bg-red-950/60 dark:text-red-100 dark:ring-red-800"
                                : r.spread >= 0.4 ? "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-800"
                                  : "bg-teal-50 text-teal-900 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-100 dark:ring-teal-900",
                            selected && "outline-2 outline-offset-2 outline-primary")}>
                          {r ? <>Δ {r.spread.toFixed(2)}{r.flipped && " · flip"}</> : "not run"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Pill tone="teal">stable (Δ &lt; 0.4)</Pill><Pill tone="amber">sensitive (Δ ≥ 0.4)</Pill><Pill tone="red">majority flip</Pill>
        </div>
      </Panel>
    </div>
  );
}

function BiasResultView({ env }: { env: Envelope<BiasResult> }) {
  const d = env.data;
  const originalMajority = d.variants.find((v) => v.original)?.majority;
  return (
    <div className="space-y-4">
      {d.flipped ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            <ShieldAlert className="size-6" /> Label flip detected
          </div>
          <ReviewFlag reasons={["Changing only the breed label changed the majority rating."]} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-teal-700 dark:text-teal-300">
          <ShieldCheck className="size-6" /> Rating stable across labels
          <span className="font-sans text-sm font-normal text-muted-foreground">mean-score spread {d.spread.toFixed(2)} (0–2 scale)</span>
          {d.human_review && <ReviewFlag compact reasons={["Individual votes shifted with the label."]} />}
        </div>
      )}

      <Panel className="space-y-2 p-3 sm:p-5">
        {d.variants.map((v) => {
          const n = v.votes.length;
          const differs = v.majority !== originalMajority;
          return (
            <div key={v.label} className={cn("grid items-center gap-2 rounded-xl p-2 sm:grid-cols-[1.2fr_2fr_auto_auto] sm:gap-4",
              differs && "bg-red-50 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-900")}>
              <div className="text-sm">
                <span className="font-semibold">“{v.label}”</span>
                {v.original && <Pill tone="slate" className="ml-2">original label</Pill>}
              </div>
              <div className="flex h-5 overflow-hidden rounded-full bg-muted" role="img"
                aria-label={FITS.map((f) => `${f}: ${v.counts[f] ?? 0}`).join(", ")}>
                {FITS.map((f) => (v.counts[f] ?? 0) > 0 && (
                  <div key={f} className={cn("flex items-center justify-center text-[10px] font-semibold text-white", fitColor(f))}
                    style={{ width: `${((v.counts[f] ?? 0) / n) * 100}%` }} title={`${f}: ${v.counts[f]}`}>
                    {v.counts[f]}
                  </div>
                ))}
              </div>
              <FitBadge f={v.majority} />
              <span className="text-xs tabular-nums text-muted-foreground">mean {v.mean_score.toFixed(2)}</span>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
          {FITS.map((f) => <span key={f} className="inline-flex items-center gap-1"><span className={cn("size-2.5 rounded-full", fitColor(f))} />{f}</span>)}
        </div>
      </Panel>

      <Panel>
        <div className="mb-1 font-display font-semibold">Summary for Trust &amp; Safety</div>
        <p className="mb-3 text-sm">{d.summary}</p>
        <MetaFooter calls={env.calls} title="Bias Lens audit" cached={env.cached} />
      </Panel>
    </div>
  );
}
