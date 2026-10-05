"use client";

import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { ConfidenceBadge, FitBadge, Panel, Pill, ReviewFlag, SectionIntro, UrgencyBadge, VerdictBadge } from "../kit";

const STAKEHOLDERS = [
  { who: "Shelter staff & volunteers", goal: "Get every animal a complete, honest listing fast.", pain: "No time to write profiles; listings sit half-empty.", feature: "Listing Studio" },
  { who: "Adopters", goal: "Find a pet that fits their real life, and get answers quickly.", pain: "Slow replies to repeat questions; unclear why a pet fits.", feature: "Counselor · Match" },
  { who: "Shelter coordinators", goal: "Handle urgent cases first and route the rest.", pain: "Thousands of mixed messages; emergencies buried in the inbox.", feature: "Inbox Triage" },
  { who: "Trust & Safety", goal: "Keep AI decisions fair and accountable.", pain: "No way to tell if the AI treats 'pit bull' listings differently.", feature: "Bias Lens" },
];

const MATRIX = [
  ["Listing Studio (B)", "Multimodal vision + JSON schema + fallback rules", "The model needs to see and be instructed well, not know new facts (no RAG) or behave differently (no fine-tuning). Fallback rules + code-enforced review flags make it honest."],
  ["Inbox Triage (C1)", "Few-shot classification, labels defined in prompt", "Six labels and four examples give 10/10 on our samples; fine-tuning needs hundreds of labeled messages we don't have and is harder to change when categories change."],
  ["Counselor (C2)", "Role-play system prompt + LLM-as-judge", "Behavior rules (scope, honesty, escalation) are instructions; a second model call checks them because a single prompt can be talked out of its rules."],
  ["Match (C3)", "Chain-of-thought + self-consistency (5 votes)", "Fit is multi-factor reasoning; step-by-step prompting exposes the logic and voting turns sampling noise into an agreement signal for counselors."],
  ["Bias Lens (D)", "Counterfactual prompting + self-consistency", "Auditing needs controlled experiments on our own matcher, not new knowledge: swap only the breed label and measure the vote shift."],
];

export function OverviewTab() {
  return (
    <div className="space-y-8">
      <SectionIntro chapter="Ch. 1 · Customization roadmap" title="Platform AI design brief" who="Shelter directors and the PawsConnect operations team">
        PawsConnect connects shelters and rescues with adopters. Five AI features target specific stakeholders and decisions;
        every output is labeled, explained, and flagged for a human when uncertain, because adoption mistakes affect living animals.
      </SectionIntro>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stakeholder map</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAKEHOLDERS.map((s) => (
            <SpotlightCard key={s.who} className="!rounded-2xl !border-border !bg-card !p-5 text-card-foreground" spotlightColor="rgba(217, 115, 78, 0.14)">
              <h4 className="font-display text-lg font-semibold">{s.who}</h4>
              <p className="mt-2 text-sm"><b>Goal:</b> {s.goal}</p>
              <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground/80">Pain point:</b> {s.pain}</p>
              <div className="mt-3"><Pill tone="teal">{s.feature}</Pill></div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Feature → technique</h3>
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Feature</th><th className="p-3">Technique</th><th className="p-3">Why this over RAG / fine-tuning</th></tr>
            </thead>
            <tbody>
              {MATRIX.map(([f, t, w]) => (
                <tr key={f} className="border-t align-top">
                  <td className="p-3 font-medium">{f}</td><td className="p-3">{t}</td><td className="p-3 text-muted-foreground">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <p className="mt-2 text-xs text-muted-foreground">
          Models: Claude Haiku 4.5 via the Claude Code CLI (local live mode; recorded the demo cache) and Gemini 3.1 Flash-Lite (deployed live mode).
          Small, fast, vision-capable, and cheap enough to run 5-vote self-consistency per match.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">How to read this demo</h3>
        <Panel className="grid gap-4 text-sm sm:grid-cols-2">
          <Legend label="Urgency"><UrgencyBadge u="P1" /><UrgencyBadge u="P2" /><UrgencyBadge u="P3" /><UrgencyBadge u="P4" /></Legend>
          <Legend label="Confidence"><ConfidenceBadge c="high" /><ConfidenceBadge c="medium" /><ConfidenceBadge c="low" /></Legend>
          <Legend label="Judge verdict"><VerdictBadge status="pass" /><VerdictBadge status="revised" /><VerdictBadge status="escalated" /></Legend>
          <Legend label="Match fit"><FitBadge f="Strong Fit" /><FitBadge f="Possible Fit" /><FitBadge f="Poor Fit" /></Legend>
          <Legend label="Human review"><ReviewFlag compact /></Legend>
          <Legend label="Provenance"><span className="text-xs text-muted-foreground">Every result has a <b className="text-primary">View prompt</b> link showing the exact prompt, model, latency, and cost.</span></Legend>
        </Panel>
      </section>
    </div>
  );
}

function Legend({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
