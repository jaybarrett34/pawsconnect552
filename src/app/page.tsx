"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, HeartHandshake, ImagePlus, Inbox, MessagesSquare, Scale } from "lucide-react";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { AppProvider } from "@/components/app-state";
import { Header } from "@/components/header";
import { ConfidenceBadge, FitBadge, Panel, ReviewFlag, UrgencyBadge, VerdictBadge } from "@/components/kit";

const DotGrid = dynamic(() => import("@/components/reactbits/DotGrid"), { ssr: false });

const FEATURES = [
  { id: "listing", icon: ImagePlus, title: "Listings from a photo", body: "One phone photo becomes a complete, honest adoption profile. Details the photo can't show are marked unknown, never guessed." },
  { id: "inbox", icon: Inbox, title: "An inbox that sorts itself", body: "Every message is categorized, prioritized, and routed to the right person, with the reason shown. Emergencies rise to the top." },
  { id: "counselor", icon: MessagesSquare, title: "A counselor that stays honest", body: "Maple answers adopters around the clock. Every reply passes a quality review before it's sent, and emergencies go to staff." },
  { id: "match", icon: HeartHandshake, title: "Matches with reasons", body: "See why a pet fits a household, the top concern to discuss, and how consistent the assessment is." },
  { id: "fairness", icon: Scale, title: "Fairness checks", body: "Audits match ratings for breed-label bias, so a word like “pit bull” never decides a pet's future." },
];

const AUDIENCES = [
  { who: "Shelter staff", text: "Post complete listings in minutes and spend the time with the animals instead." },
  { who: "Adopters", text: "Get fast, honest answers and understand why a pet fits their home." },
  { who: "Coordinators", text: "Work an inbox where urgent cases are already at the top and routed." },
  { who: "Trust & Safety", text: "Verify that recommendations are fair before adopters ever see them." },
];

export default function Landing() {
  return (
    <AppProvider>
      <Header controls={false} nav={
        <Link href="/app" className="ml-auto mr-1 hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">Console</Link>
      } />

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 opacity-30 motion-reduce:hidden" aria-hidden>
          <DotGrid dotSize={3} gap={24} baseColor="#C9BBAD" activeColor="#D9734E" proximity={110} shockRadius={200} shockStrength={4} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h1 className="font-display max-w-3xl animate-in fade-in slide-in-from-bottom-2 text-4xl font-semibold leading-tight tracking-tight duration-700 sm:text-6xl">
            Every pet deserves a great first impression.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            PawsConnect helps shelters write better listings, answer adopters faster, and make fairer matches, with a
            person in the loop wherever it matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90">
              Open the shelter console <ArrowRight className="size-4" />
            </Link>
            <a href="#features" className="inline-flex h-11 items-center rounded-full border bg-card px-5 text-sm font-semibold">See what it does</a>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-16">
        <section id="features" className="scroll-mt-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight">What it does</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ id, icon: Icon, title, body }) => (
              <Link key={id} href={`/app#${id}`} className="group">
                <SpotlightCard className="!h-full !rounded-2xl !border-border !bg-card !p-5 text-card-foreground" spotlightColor="rgba(31, 111, 107, 0.12)">
                  <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-4.5" /></span>
                  <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Try it <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>
                </SpotlightCard>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Built for everyone in an adoption</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => (
              <div key={a.who} className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold">{a.who}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Reading the console</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every suggestion shows what was decided, why, and how sure it is. Anything uncertain waits for a person.
          </p>
          <Panel className="mt-6 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Legend label="Urgency"><UrgencyBadge u="P1" /><UrgencyBadge u="P2" /><UrgencyBadge u="P3" /><UrgencyBadge u="P4" /></Legend>
            <Legend label="Confidence"><ConfidenceBadge c="high" /><ConfidenceBadge c="medium" /><ConfidenceBadge c="low" /></Legend>
            <Legend label="Quality review"><VerdictBadge status="pass" /><VerdictBadge status="revised" /><VerdictBadge status="escalated" /></Legend>
            <Legend label="Match"><FitBadge f="Strong Fit" /><FitBadge f="Possible Fit" /><FitBadge f="Poor Fit" /></Legend>
            <Legend label="Held for staff"><ReviewFlag compact /></Legend>
            <Legend label="Details"><span className="text-xs text-muted-foreground">Open <b className="text-primary">Details</b> on any result to see exactly how it was produced.</span></Legend>
          </Panel>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-xs text-muted-foreground">
          <span>© 2026 PawsConnect · Demonstration platform. All people and messages are fictional.</span>
          <span>Pet photos: Wikimedia Commons (CC0 / CC BY / CC BY-SA)</span>
        </div>
      </footer>
    </AppProvider>
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
