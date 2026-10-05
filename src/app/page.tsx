"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlurText from "@/components/reactbits/BlurText";
import CountUp from "@/components/reactbits/CountUp";
import FadeContent from "@/components/reactbits/FadeContent";
import { AppProvider, useApp } from "@/components/app-state";
import { Header } from "@/components/header";
import { Inspector } from "@/components/inspector";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { ListingTab } from "@/components/tabs/listing-tab";
import { TriageTab } from "@/components/tabs/triage-tab";
import { CounselorTab } from "@/components/tabs/counselor-tab";
import { MatchTab } from "@/components/tabs/match-tab";
import { BiasTab } from "@/components/tabs/bias-tab";

const DotGrid = dynamic(() => import("@/components/reactbits/DotGrid"), { ssr: false });

const TABS = [
  { id: "overview", label: "Overview", el: OverviewTab },
  { id: "listing", label: "Listing Studio", el: ListingTab },
  { id: "triage", label: "Inbox Triage", el: TriageTab },
  { id: "counselor", label: "Counselor", el: CounselorTab },
  { id: "match", label: "Match", el: MatchTab },
  { id: "bias", label: "Bias Lens", el: BiasTab },
];

export default function Home() {
  return (
    <AppProvider>
      <Header />
      <Hero />
      <Main />
      <Inspector />
      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted-foreground">
        PawsConnect is a fictional platform built for MIS 552 (Homework 1). All people and messages are synthetic; photos are
        CC-licensed (see LICENSES). AI outputs are drafts for human review, not decisions.
      </footer>
    </AppProvider>
  );
}

function Hero() {
  const { samples } = useApp();
  const stats = [
    { n: samples?.photos.length ?? 7, label: "photos → listings" },
    { n: samples?.messages.length ?? 10, label: "inquiries triaged" },
    { n: samples?.scenarios.length ?? 4, label: "judged conversations" },
    { n: 5, label: "votes per match" },
  ];
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 opacity-40 motion-reduce:hidden" aria-hidden>
        <DotGrid dotSize={4} gap={22} baseColor="#E8DFD5" activeColor="#D9734E" proximity={110} shockRadius={200} shockStrength={4} />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">MIS 552 · AI for Digital Platforms</p>
        <BlurText text="Every pet deserves a great first impression." animateBy="words" delay={90}
          className="font-display max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl" />
        <p className="mt-4 max-w-2xl text-muted-foreground">
          PawsConnect&apos;s AI suite drafts listings from a single photo, triages the inbox, counsels adopters behind a judge,
          explains matches with voting, and audits itself for breed-label bias.
        </p>
        <div className="mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl font-semibold"><CountUp to={s.n} duration={1.2} /></p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Main() {
  const [tab, setTab] = useState("overview");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mx-auto max-w-6xl px-4 pt-6">
      <div className="sticky top-[57px] z-30 -mx-4 overflow-x-auto bg-background/85 px-4 py-2 backdrop-blur">
        <TabsList className="h-10">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="px-3 text-sm">{t.label}</TabsTrigger>)}
        </TabsList>
      </div>
      {TABS.map(({ id, el: El }) => (
        <TabsContent key={id} value={id} className="pt-6">
          {tab === id && <FadeContent duration={400} blur={false}><El /></FadeContent>}
        </TabsContent>
      ))}
    </Tabs>
  );
}
