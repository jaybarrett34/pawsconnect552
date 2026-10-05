"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Send } from "lucide-react";
import { api, ApiError, type Envelope, type Triage } from "@/lib/api";
import CountUp from "@/components/reactbits/CountUp";
import { useApp, useRun } from "../app-state";
import { ErrorNote, Loading, MetaFooter, Panel, Pill, ReviewFlag, SectionIntro, UrgencyBadge } from "../kit";
import { cn } from "@/lib/utils";

type Row = Envelope<Triage> & { adhocText?: string };

const CATEGORY_LABEL: Record<string, string> = {
  adoption_application: "Adoption application",
  medical_question: "Medical question",
  surrender_request: "Surrender / intake",
  foster_volunteer_offer: "Foster / volunteer",
  general_question: "General question",
  spam_other: "Spam / other",
};

export function TriageTab() {
  const { mode, samples } = useApp();
  const { data, loading, error, run } = useRun<Envelope<Triage>[]>();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [adhoc, setAdhoc] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [adhocError, setAdhocError] = useState<string | null>(null);

  useEffect(() => { setAdhoc([]); if (samples) run(() => api.triage({ mode })); }, [samples, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const msgs = useMemo(() => Object.fromEntries((samples?.messages ?? []).map((m) => [m.id, m])), [samples]);
  const rows = useMemo<Row[]>(
    () => [...adhoc, ...(data ?? [])].sort((a, b) => a.data.urgency.localeCompare(b.data.urgency)),
    [data, adhoc],
  );
  const scored = (data ?? []).filter((r) => msgs[r.input_id]);
  const correct = scored.filter((r) => msgs[r.input_id].gold.category === r.data.category).length;
  const urgentOk = scored.filter((r) => msgs[r.input_id].gold.urgency === r.data.urgency).length;

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setAdhocError(null);
    try {
      const res = await api.triage({ mode, text });
      setAdhoc((a) => [...res.map((r, i) => ({ ...r, input_id: `adhoc-${Date.now()}-${i}`, adhocText: text })), ...a]);
      setText("");
    } catch (e) {
      setAdhocError(e instanceof ApiError ? e.message : "Triage failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionIntro chapter="Ch. 3 · Few-shot classification" title="Inbox Triage" who="Shelter coordinators working the inquiry queue">
        Every message becomes a routed, prioritized record with the model&apos;s stated reason. The queue is sorted by urgency;
        anything uncertain, mixed, or urgent is flagged for a human.
      </SectionIntro>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Category accuracy vs. hand labels" value={correct} total={scored.length} />
        <Stat label="Urgency accuracy vs. hand labels" value={urgentOk} total={scored.length} />
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Flagged for human review</p>
          <p className="font-display text-3xl font-semibold">
            <CountUp to={rows.filter((r) => r.data.human_review).length} duration={0.8} /> <span className="text-base text-muted-foreground">of {rows.length}</span>
          </p>
        </Panel>
      </div>

      {loading && <Loading label="Triaging messages…" />}
      {error && <ErrorNote error={error} />}

      {rows.length > 0 && (
        <Panel className="overflow-hidden p-0">
          <div className="hidden grid-cols-[110px_160px_1fr_170px_120px] gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Urgency</span><span>Category</span><span>Summary · why</span><span>Route to</span><span>Review</span>
          </div>
          {rows.map((r, i) => {
            const m = msgs[r.input_id];
            const miss = m && m.gold.category !== r.data.category;
            const isOpen = open === r.input_id;
            return (
              <motion.div key={r.input_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={cn("border-b last:border-0", r.data.urgency === "P1" && "bg-red-50/40 dark:bg-red-950/20")}>
                <button onClick={() => setOpen(isOpen ? null : r.input_id)}
                  className="grid w-full gap-2 px-4 py-3 text-left md:grid-cols-[110px_160px_1fr_170px_120px] md:gap-3">
                  <span><UrgencyBadge u={r.data.urgency} /></span>
                  <span className="text-sm font-medium">{CATEGORY_LABEL[r.data.category] ?? r.data.category}</span>
                  <span className="space-y-1">
                    <span className="block text-sm">{r.data.summary}</span>
                    <span className="block text-xs text-muted-foreground"><b className="text-foreground/70">Why:</b> {r.data.reason}</span>
                    <span className="flex flex-wrap gap-1">
                      {m?.ambiguous && <Pill tone="violet">ambiguous by design</Pill>}
                      {miss && <Pill tone="rose">differs from hand label</Pill>}
                    </span>
                  </span>
                  <span className="text-sm">{r.data.suggested_routing}</span>
                  <span className="flex flex-col items-start gap-1">
                    {r.data.human_review ? <ReviewFlag compact /> : <Pill tone="green">Auto-route OK</Pill>}
                    <span className="text-[11px] text-muted-foreground">{r.data.confidence} confidence</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-2 bg-muted/40 px-4 pb-4 pt-1 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original message{m ? ` from ${m.from}` : ""}</p>
                    <blockquote className="rounded-xl border-l-4 border-primary bg-card p-3">{m?.text ?? r.adhocText}</blockquote>
                    {m && (
                      <p className="text-xs text-muted-foreground">
                        Hand label: <b>{CATEGORY_LABEL[m.gold.category]}</b> · {m.gold.urgency}. Model: <b>{CATEGORY_LABEL[r.data.category]}</b> · {r.data.urgency}
                      </p>
                    )}
                    <MetaFooter calls={r.calls} title={`Triage · ${m?.from ?? "new message"}`} cached={r.cached} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </Panel>
      )}

      <Panel className="mt-4">
        <h3 className="mb-2 text-sm font-semibold">Triage a new message</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} disabled={mode === "cached"}
            placeholder={mode === "cached" ? "Live mode required for new messages" : "Paste an inquiry…"}
            className="min-h-16 flex-1 rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
          <button onClick={submit} disabled={mode === "cached" || !text.trim() || busy}
            className="inline-flex h-10 items-center justify-center gap-1.5 self-end rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Send className="size-4" /> Triage
          </button>
        </div>
        {adhocError && <div className="mt-2"><ErrorNote error={adhocError} /></div>}
      </Panel>
    </div>
  );
}

function Stat({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <Panel className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-semibold">
        <CountUp to={value} duration={0.8} /> <span className="text-base text-muted-foreground">/ {total}</span>
      </p>
    </Panel>
  );
}
