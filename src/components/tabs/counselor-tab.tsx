"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, HeartHandshake, Send, XCircle } from "lucide-react";
import { useApp, useRun } from "@/components/app-state";
import { ErrorNote, Loading, MetaFooter, Panel, Pill, SectionIntro, VerdictBadge, Why } from "@/components/kit";
import { api, type Conversation, type Envelope, type Judgement, type Turn } from "@/lib/api";
import { cn } from "@/lib/utils";

const CRITERIA: { key: keyof Omit<Judgement, "verdict" | "feedback">; label: string }[] = [
  { key: "in_scope", label: "In scope" },
  { key: "consistent_with_listing", label: "Matches listing" },
  { key: "tone", label: "Tone" },
  { key: "no_medical_advice", label: "No vet advice" },
  { key: "no_availability_promise", label: "No availability promise" },
];

export function CounselorTab() {
  const { mode, samples } = useApp();
  const { data, loading, error, run, setData } = useRun<Envelope<Conversation>>();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  // Free chat (live only)
  const [message, setMessage] = useState("");
  const [petId, setPetId] = useState("biscuit");
  const [weakened, setWeakened] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const runScenario = (id: string) => {
    setScenarioId(id);
    setSelected(null);
    run(() => api.counselor({ mode, scenario_id: id }));
  };

  useEffect(() => {
    if (samples && !scenarioId && samples.scenarios.length) runScenario(samples.scenarios[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples]);

  const convo = data?.data;
  const turns = useMemo(() => convo?.turns ?? [], [convo]);
  const activePetId = convo?.pet_id ?? petId;
  const pet = samples?.pets.find((p) => p.id === activePetId);
  const defaultSel = useMemo(() => {
    const i = turns.findIndex((t) => t.status !== "pass");
    return i === -1 ? 0 : i;
  }, [turns]);
  const sel = selected ?? defaultSel;
  const selTurn: Turn | undefined = turns[sel];

  const send = async () => {
    if (!message.trim() || mode === "cached") return;
    setSending(true);
    setChatError(null);
    const pid = convo?.pet_id ?? petId;
    const history = turns.flatMap((t) => [
      { role: "adopter", text: t.user },
      { role: "maple", text: t.final },
    ]);
    try {
      const wk = convo?.weakened ?? weakened;
      const res = await api.counselor({ mode, message: message.trim(), pet_id: pid, history, weakened: wk });
      setData({
        ...res,
        data: { pet_id: pid, weakened: wk, turns: [...turns, ...res.data.turns] },
        calls: [...(data?.calls ?? []), ...res.calls],
      });
      setSelected(turns.length + res.data.turns.length - 1);
      setMessage("");
      setScenarioId(null);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const allCalls = data?.calls ?? [];

  return (
    <div>
      <SectionIntro title="Adoption Counselor">
        Adopters chat with Maple, PawsConnect&apos;s adoption counselor. Every reply passes a quality review before it&apos;s sent;
        replies that fail are rewritten once or handed to a staff member.
      </SectionIntro>

      {/* Scenarios */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {samples?.scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => runScenario(s.id)}
            className={cn(
              "rounded-xl border bg-card p-3 text-left transition hover:border-primary/60 hover:shadow-sm",
              scenarioId === s.id && "border-primary ring-2 ring-primary/20",
            )}
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {s.title}
              {s.weakened && <Pill tone="amber">backup coverage</Pill>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="space-y-4">
          {pet && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
              <img src={pet.photo} alt={pet.name} className="size-12 rounded-lg object-cover" />
              <div className="min-w-0 text-sm">
                <div className="font-semibold">Talking about {pet.name}</div>
                <div className="truncate text-xs text-muted-foreground">{pet.breed} · {pet.age} · {pet.sex}</div>
              </div>
            </div>
          )}

          {convo?.weakened && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Backup coverage: Maple is out today and Gus from the front office is covering the chat. His replies still go through quality review before they reach the adopter.
            </div>
          )}

          {loading && <Loading label="Drafting a reply and running quality review…" />}
          {error && <ErrorNote error={error} />}

          {!loading && turns.length > 0 && (
            <div className="space-y-4">
              {turns.map((t, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{t.user}</div>
                  </div>
                  <MapleBubble turn={t} active={i === sel} onSelect={() => setSelected(i)} name={data?.data.weakened ? "Gus (backup)" : "Maple"} />
                </div>
              ))}
            </div>
          )}

          {/* Free chat */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                Pet
                <select
                  value={convo?.pet_id ?? petId}
                  onChange={(e) => { setPetId(e.target.value); setData(null); setScenarioId(null); }}
                  className="rounded-md border bg-background px-2 py-1"
                >
                  {samples?.pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={weakened} onChange={(e) => setWeakened(e.target.checked)} />
                Backup coverage (Gus)
              </label>
            </div>
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={mode === "cached" ? "Live mode required for free chat" : "Ask Maple about adopting…"}
                disabled={mode === "cached" || sending}
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm disabled:opacity-60"
              />
              <button
                onClick={send}
                disabled={mode === "cached" || sending || !message.trim()}
                className="inline-flex items-center gap-1.5 self-end rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Send className="size-4" /> {sending ? "Sending…" : "Send"}
              </button>
            </div>
            {mode === "cached" && <p className="text-xs text-muted-foreground">Live mode required for free chat. The scenarios above replay recorded conversations.</p>}
            {chatError && <ErrorNote error={chatError} />}
          </div>

          {data && <MetaFooter calls={allCalls} title="Counselor + quality review" cached={data.cached} />}
        </Panel>

        <Panel className="h-fit space-y-4 lg:sticky lg:top-28">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Quality review</h3>
            {selTurn && <span className="text-xs text-muted-foreground">Turn {sel + 1}</span>}
          </div>
          {!selTurn ? (
            <p className="text-sm text-muted-foreground">Pick a conversation to see its review.</p>
          ) : (
            <>
              <VerdictBadge status={selTurn.status} />
              <JudgeReview j={selTurn.judgement} title="First review (original draft)" />
              {selTurn.judgement2 && <JudgeReview j={selTurn.judgement2} title="Second review (rewritten draft)" />}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MapleBubble({ turn, active, onSelect, name }: { turn: Turn; active: boolean; onSelect: () => void; name: string }) {
  const revisionRejected = turn.status === "escalated" && turn.judgement2?.verdict === "revise";
  return (
    <button onClick={onSelect} className="block w-full text-left">
      <div className={cn("max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border bg-muted/40 px-3.5 py-2.5 transition", active && "border-primary ring-2 ring-primary/20")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">{name}</span>
          <VerdictBadge status={turn.status} />
        </div>
        {turn.status !== "pass" && turn.judgement.verdict === "revise" && (
          <Struck label="Draft held by quality review" text={turn.draft} />
        )}
        {turn.revision && revisionRejected && <Struck label="Rewrite also rejected" text={turn.revision} />}
        {turn.handoff ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            <HeartHandshake className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">Connecting you with a shelter counselor</div>
              <p className="mt-0.5">{turn.final}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{turn.final}</p>
        )}
      </div>
    </button>
  );
}

function Struck({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">{label}</div>
      <p className="text-xs text-muted-foreground line-through decoration-amber-500/70">{text}</p>
    </div>
  );
}

function JudgeReview({ j, title }: { j: Judgement; title: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <VerdictBadge status={j.verdict} />
      </div>
      <ul className="space-y-1.5">
        {CRITERIA.map(({ key, label }) => {
          const c = j[key];
          return (
            <li key={key} className="flex gap-2 text-sm">
              {c.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="passed" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="failed" />
              )}
              <div>
                <span className="font-medium">{label}</span>
                <p className="text-xs text-muted-foreground">{c.note}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {j.feedback && <Why>{j.feedback}</Why>}
    </div>
  );
}
