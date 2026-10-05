"use client";

import { useEffect, useState } from "react";
import { ImageUp, Sparkles } from "lucide-react";
import { api, type Attr, type Envelope, type Listing } from "@/lib/api";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import StarBorder from "@/components/reactbits/StarBorder";
import { useApp, useRun } from "../app-state";
import { ConfidenceBadge, ErrorNote, Loading, MetaFooter, Pill, ReviewFlag, SectionIntro, Why } from "../kit";
import { cn } from "@/lib/utils";

export function ListingTab() {
  const { mode, samples } = useApp();
  const { data, loading, error, run } = useRun<Envelope<Listing>>();
  const [selected, setSelected] = useState<string>("biscuit");
  const [preview, setPreview] = useState<string | null>(null);

  const runSample = (id: string) => {
    setSelected(id);
    setPreview(null);
    run(() => api.listing({ mode, photo_id: id }));
  };

  useEffect(() => { if (samples) runSample(selected); }, [samples, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPreview(url);
      setSelected("upload");
      run(() => api.listing({ mode, image_base64: url.split(",")[1], mime_type: file.type || "image/jpeg" }));
    };
    reader.readAsDataURL(file);
  };

  const photo = preview ?? samples?.photos.find((p) => p.id === selected)?.file;

  return (
    <div>
      <SectionIntro chapter="Ch. 2 · Vision + structured output" title="Listing Studio" who="Shelter staff and volunteers drafting adoption profiles">
        Snap one photo and get an honest draft listing. Anything the model can&apos;t see is marked <em>unknown</em> rather than guessed,
        and any low-confidence field sends the draft to a human before it&apos;s posted.
      </SectionIntro>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Sample photos</h3>
          <div className="grid grid-cols-3 gap-2">
            {samples?.photos.map((p) => (
              <button key={p.id} onClick={() => runSample(p.id)} title={p.label}
                className={cn("group relative aspect-square overflow-hidden rounded-xl ring-2 ring-transparent transition",
                  selected === p.id ? "ring-primary" : "hover:ring-border")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.file} alt={p.label} className="size-full object-cover" />
                {p.hardCase && (
                  <span className="absolute inset-x-1 bottom-1 rounded-md bg-black/65 px-1 py-0.5 text-[10px] font-medium text-white">
                    hard case · {p.hardCase}
                  </span>
                )}
              </button>
            ))}
          </div>
          <label className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground",
            mode === "cached" && "cursor-not-allowed opacity-60")}>
            <ImageUp className="size-5" />
            <span className="font-medium text-foreground">Upload your own photo</span>
            {mode === "cached" ? "Live mode required for new photos" : "JPEG or PNG, under 5 MB"}
            <input type="file" accept="image/*" className="sr-only" disabled={mode === "cached"}
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        </div>

        <div>
          {loading && <Loading label={mode === "cached" ? "Loading draft…" : "Looking at the photo and drafting the listing…"} />}
          {error && <ErrorNote error={error} />}
          {data && !loading && <ListingCard env={data} photo={photo} />}
        </div>
      </div>
    </div>
  );
}

function ListingCard({ env, photo }: { env: Envelope<Listing>; photo?: string }) {
  const x = env.data;
  return (
    <SpotlightCard className="!rounded-2xl !border-border !bg-card !p-0 text-card-foreground" spotlightColor="rgba(31, 111, 107, 0.12)">
      <div className="grid items-start gap-0 md:grid-cols-[240px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="Uploaded pet" className="aspect-[4/3] w-full rounded-t-2xl object-cover md:aspect-square md:rounded-none md:rounded-tl-2xl" />}
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Draft listing</p>
              <h3 className="font-display text-2xl font-semibold">
                {x.suggested_names.length ? x.suggested_names.join(" · ") : "No name suggested"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={x.animal_detected ? "teal" : "red"}>
                {x.animal_detected ? `${x.animal_count} animal${x.animal_count === 1 ? "" : "s"} detected` : "No animal detected"}
              </Pill>
              <Pill tone={x.image_quality === "poor" ? "red" : x.image_quality === "fair" ? "amber" : "green"}>Photo: {x.image_quality}</Pill>
            </div>
          </div>

          {x.human_review ? <ReviewFlag reasons={x.review_reasons} /> : (
            <Pill tone="green" icon={Sparkles}>Ready for staff sign-off: no low-confidence fields</Pill>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Species" a={x.species} />
            <Field label="Breed" a={x.breed} />
            <Field label="Estimated age" a={x.age_range} />
            <Field label="Size" a={x.size} />
          </div>

          <div>
            <h4 className="mb-1 text-sm font-semibold">Personality (for adopters)</h4>
            <p className="text-sm leading-relaxed">{x.personality}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold">Care requirements</h4>
              {x.care_requirements.length ? (
                <ul className="ml-4 list-disc space-y-0.5 text-sm">{x.care_requirements.map((c) => <li key={c}>{c}</li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">None. Staff to complete.</p>}
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold">Adoption fee tier</h4>
              <StarBorder as="div" className="w-full" color="#D9734E" speed="6s">
                <span className="text-sm font-semibold">{x.fee_tier}</span>
              </StarBorder>
              <div className="mt-1"><Why>{x.fee_tier_reason}</Why></div>
            </div>
          </div>

          {x.unknowns.length > 0 && (
            <details className="rounded-xl bg-muted/60 p-3 text-sm">
              <summary className="cursor-pointer font-medium">What the model couldn&apos;t determine ({x.unknowns.length})</summary>
              <ul className="ml-4 mt-2 list-disc space-y-0.5 text-muted-foreground">{x.unknowns.map((u) => <li key={u}>{u}</li>)}</ul>
            </details>
          )}
          <MetaFooter calls={env.calls} title="Photo → listing" cached={env.cached} />
        </div>
      </div>
    </SpotlightCard>
  );
}

function Field({ label, a }: { label: string; a: Attr }) {
  const unknown = a.value.toLowerCase() === "unknown";
  return (
    <div className="space-y-1 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <ConfidenceBadge c={a.confidence} />
      </div>
      <p className={cn("text-sm font-semibold", unknown && "text-muted-foreground")}>{unknown ? "Unknown" : a.value}</p>
      <Why>{a.reason}</Why>
    </div>
  );
}
