"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, ImagePlus, Inbox, MessagesSquare, Scale } from "lucide-react";
import FadeContent from "@/components/reactbits/FadeContent";
import { AppProvider } from "@/components/app-state";
import { Header } from "@/components/header";
import { Inspector } from "@/components/inspector";
import { ListingTab } from "@/components/tabs/listing-tab";
import { TriageTab } from "@/components/tabs/triage-tab";
import { CounselorTab } from "@/components/tabs/counselor-tab";
import { MatchTab } from "@/components/tabs/match-tab";
import { BiasTab } from "@/components/tabs/bias-tab";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "listing", label: "Listings", icon: ImagePlus, el: ListingTab },
  { id: "inbox", label: "Inbox", icon: Inbox, el: TriageTab },
  { id: "counselor", label: "Counselor", icon: MessagesSquare, el: CounselorTab },
  { id: "match", label: "Match", icon: HeartHandshake, el: MatchTab },
  { id: "fairness", label: "Fairness", icon: Scale, el: BiasTab },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default function Console() {
  const [active, setActive] = useState<SectionId>("listing");

  // Deep links (/app#inbox) and back/forward.
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1);
      if (SECTIONS.some((s) => s.id === h)) setActive(h as SectionId);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = (id: SectionId) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };

  const Active = SECTIONS.find((s) => s.id === active)!.el;
  return (
    <AppProvider>
      <Header
        nav={
          <nav aria-label="Console sections" className="-my-1 ml-2 flex min-w-0 gap-1 overflow-x-auto">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => go(id)} aria-current={active === id ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
                  active === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}>
                <Icon className="size-4" /><span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <FadeContent key={active} duration={350} blur={false}><Active /></FadeContent>
      </main>
      <Inspector />
    </AppProvider>
  );
}
