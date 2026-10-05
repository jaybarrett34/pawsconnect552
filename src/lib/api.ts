// Typed client for the FastAPI backend (see /api/docs).

export type Mode = "cached" | "claude" | "gemini";
export type Confidence = "high" | "medium" | "low";
export type Fit = "Strong Fit" | "Possible Fit" | "Poor Fit";

export interface CallMeta {
  provider: string;
  model: string;
  latency_ms: number;
  cost_usd: number | null;
  prompt_version: string;
  system: string;
  user: string;
  raw: string;
  attempts: number;
}

export interface Envelope<T> {
  feature: string;
  input_id: string;
  mode: Mode;
  cached: boolean;
  data: T;
  calls: CallMeta[];
}

export interface Attr { value: string; confidence: Confidence; reason: string }
export interface Listing {
  animal_detected: boolean;
  animal_count: number;
  image_quality: "good" | "fair" | "poor";
  suggested_names: string[];
  species: Attr;
  breed: Attr;
  age_range: Attr;
  size: Attr;
  personality: string;
  care_requirements: string[];
  fee_tier: string;
  fee_tier_reason: string;
  unknowns: string[];
  human_review: boolean;
  review_reasons: string[];
}

export interface Triage {
  category: string;
  urgency: "P1" | "P2" | "P3" | "P4";
  suggested_routing: string;
  summary: string;
  reason: string;
  confidence: Confidence;
  human_review: boolean;
}

export interface Criterion { passed: boolean; note: string }
export interface Judgement {
  in_scope: Criterion;
  consistent_with_listing: Criterion;
  tone: Criterion;
  no_medical_advice: Criterion;
  no_availability_promise: Criterion;
  verdict: "pass" | "revise";
  feedback: string;
}
export interface Turn {
  user: string;
  draft: string;
  judgement: Judgement;
  revision: string | null;
  judgement2: Judgement | null;
  status: "pass" | "revised" | "escalated";
  final: string;
  handoff: boolean;
}
export interface Conversation { pet_id: string; weakened: boolean; turns: Turn[] }

export interface MatchRun { steps: { step: string; analysis: string }[]; rating: Fit; top_reasons: string[]; top_concern: string }
export interface Vote {
  votes: Fit[];
  counts: Partial<Record<Fit, number>>;
  majority: Fit;
  agreement: number;
  unanimous: boolean;
  tie: boolean;
  mean_score: number;
  human_review: boolean;
}
export interface MatchResult extends Vote { runs: MatchRun[]; top_reasons: string[]; top_concern: string }
export interface BiasVariant extends Vote { label: string; original: boolean; top_concern: string }
export interface BiasResult {
  pet_id: string;
  profile_id: string;
  variants: BiasVariant[];
  flipped: boolean;
  spread: number;
  summary: string;
  human_review: boolean;
}

export interface Pet {
  id: string; name: string; species: string; breed: string; age: string; sex: string; weight: string;
  photo: string; energy: string; good_with: string; not_good_with: string; notes: string; status: string;
}
export interface Samples {
  photos: { id: string; file: string; label: string; hardCase?: string }[];
  pets: Pet[];
  messages: { id: string; from: string; text: string; ambiguous?: boolean; gold: { category: string; urgency: string } }[];
  profiles: { id: string; name: string; summary: string; text: string }[];
  scenarios: { id: string; title: string; description: string; petId: string; weakened: boolean; messages: string[] }[];
  breed_variants: string[];
  bias_pets: string[];
}

export interface ServerConfig {
  providers: Mode[];
  default_mode: Mode;
  on_vercel: boolean;
  gate_enabled: boolean;
  unlocked: boolean;
  locked: boolean;
  retry_after: number;
  attempts_left: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (json as { detail?: unknown }).detail;
    const msg = typeof d === "string" ? d : (d as { message?: string })?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, d);
  }
  return json as T;
}

export const api = {
  config: () => request<ServerConfig>("/config"),
  samples: () => request<Samples>("/samples"),
  unlock: (passcode: string, turnstile_token?: string) => request<ServerConfig>("/auth/unlock", { passcode, turnstile_token }),
  listing: (b: { mode: Mode; photo_id?: string; image_base64?: string; mime_type?: string }) => request<Envelope<Listing>>("/ai/listing", b),
  triage: (b: { mode: Mode; message_ids?: string[]; text?: string }) => request<Envelope<Triage>[]>("/ai/triage", b),
  counselor: (b: { mode: Mode; scenario_id?: string; pet_id?: string; weakened?: boolean; message?: string; history?: { role: string; text: string }[] }) =>
    request<Envelope<Conversation>>("/ai/counselor", b),
  match: (b: { mode: Mode; profile_id: string; pet_id: string }) => request<Envelope<MatchResult>>("/ai/match", b),
  bias: (b: { mode: Mode; profile_id: string; pet_id: string }) => request<Envelope<BiasResult>>("/ai/bias", b),
};
