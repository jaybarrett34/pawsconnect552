"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "./app-state";
import { cn } from "@/lib/utils";

/** Prompt Inspector: the only place raw prompts and raw model JSON appear. */
export function Inspector() {
  const { inspected, closeInspector } = useApp();
  const [i, setI] = useState(0);
  const calls = inspected?.calls ?? [];
  const c = calls[Math.min(i, calls.length - 1)];
  return (
    <Sheet open={!!inspected} onOpenChange={(o) => { if (!o) { closeInspector(); setI(0); } }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Prompt Inspector · {inspected?.title}</SheetTitle>
          <SheetDescription>Exactly what was sent to the model and what came back.</SheetDescription>
        </SheetHeader>
        {c && (
          <div className="space-y-4 px-4 pb-6 text-sm">
            {calls.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {calls.map((x, k) => (
                  <button key={k} onClick={() => setI(k)}
                    className={cn("rounded-full border px-2.5 py-0.5 text-xs", k === i ? "bg-primary text-primary-foreground" : "bg-card")}>
                    Call {k + 1}
                  </button>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-3 text-xs">
              <dt className="text-muted-foreground">Provider / model</dt><dd>{c.provider} · {c.model}</dd>
              <dt className="text-muted-foreground">Prompt version</dt><dd>{c.prompt_version}</dd>
              <dt className="text-muted-foreground">Latency</dt><dd>{(c.latency_ms / 1000).toFixed(2)}s{c.attempts > 1 ? ` (${c.attempts} attempts)` : ""}</dd>
              <dt className="text-muted-foreground">Cost</dt><dd>{c.cost_usd != null ? `$${c.cost_usd.toFixed(5)}${c.provider === "claude" ? " (plan-billed, API-equivalent)" : ""}` : "n/a"}</dd>
            </dl>
            <Block title="System prompt" text={c.system} />
            <Block title="User message" text={c.user} />
            <Block title="Raw model output" text={pretty(c.raw)} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border bg-background p-3 font-mono text-[11px] leading-relaxed">{text}</pre>
    </section>
  );
}

function pretty(raw: string) {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.stringify(JSON.parse(m[0]), null, 2) : raw;
  } catch {
    return raw;
  }
}
