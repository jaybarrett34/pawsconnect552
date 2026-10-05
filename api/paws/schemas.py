"""Pydantic models: LLM output schemas (sent to the model as JSON Schema) and API envelopes."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Confidence = Literal["high", "medium", "low"]
Mode = Literal["cached", "claude", "gemini"]


# ---------- Part B: Photo -> Listing ----------
class Attr(BaseModel):
    value: str = Field(description='Best answer, or "unknown" if it cannot be determined from the photo')
    confidence: Confidence
    reason: str = Field(description="Visual evidence for the answer, or why it is unknown")


class Listing(BaseModel):
    animal_detected: bool
    animal_count: int = Field(ge=0)
    image_quality: Literal["good", "fair", "poor"]
    suggested_names: list[str] = Field(max_length=3)
    species: Attr
    breed: Attr
    age_range: Attr
    size: Attr
    personality: str = Field(description="Warm, honest adopter-facing description; never invent behavior the photo cannot show")
    care_requirements: list[str] = Field(max_length=5)
    fee_tier: Literal["Standard", "Senior Special", "Bonded Pair", "Needs Assessment"]
    fee_tier_reason: str
    unknowns: list[str] = Field(description="Fields that could not be determined and why")
    human_review: bool
    review_reasons: list[str]


# ---------- Part C1: Triage ----------
Category = Literal[
    "adoption_application",
    "medical_question",
    "surrender_request",
    "foster_volunteer_offer",
    "general_question",
    "spam_other",
]
Urgency = Literal["P1", "P2", "P3", "P4"]


class Triage(BaseModel):
    category: Category
    urgency: Urgency
    suggested_routing: str
    summary: str = Field(description="One sentence")
    reason: str = Field(description="Why this category and urgency, quoting words from the message")
    confidence: Confidence
    human_review: bool


# ---------- Part C2: Counselor + Judge ----------
class CounselorReply(BaseModel):
    reply: str
    escalate: bool = Field(description="True if a human must take over (medical emergency, animal-welfare concern)")


class Criterion(BaseModel):
    passed: bool
    note: str


class Judgement(BaseModel):
    in_scope: Criterion
    consistent_with_listing: Criterion
    tone: Criterion
    no_medical_advice: Criterion
    no_availability_promise: Criterion
    verdict: Literal["pass", "revise"]
    feedback: str = Field(description="Concrete fix instructions; empty when verdict is pass")


# ---------- Part C3: Match ----------
Fit = Literal["Strong Fit", "Possible Fit", "Poor Fit"]


class Step(BaseModel):
    step: str
    analysis: str


class Match(BaseModel):
    steps: list[Step] = Field(min_length=4)
    rating: Fit
    top_reasons: list[str] = Field(min_length=3, max_length=3)
    top_concern: str


# ---------- API envelopes ----------
class CallMeta(BaseModel):
    provider: str
    model: str
    latency_ms: int
    cost_usd: float | None = None
    prompt_version: str
    system: str
    user: str
    raw: str
    attempts: int = 1


class Envelope(BaseModel):
    feature: str
    input_id: str
    mode: Mode
    cached: bool
    data: Any
    calls: list[CallMeta] = []


class RunRequest(BaseModel):
    mode: Mode = "cached"


class ListingRequest(RunRequest):
    photo_id: str | None = None
    image_base64: str | None = Field(default=None, max_length=7_000_000, description="Uploaded photo (live mode only)")
    mime_type: str = "image/jpeg"


class TriageRequest(RunRequest):
    message_ids: list[str] | None = Field(default=None, max_length=20)
    text: str | None = Field(default=None, max_length=2000, description="Ad-hoc message (live mode only)")


class ChatRequest(RunRequest):
    scenario_id: str | None = None
    pet_id: str = "biscuit"
    weakened: bool = False
    history: list[dict[str, str]] = Field(default=[], max_length=40)
    message: str | None = Field(default=None, max_length=2000)


class MatchRequest(RunRequest):
    profile_id: str
    pet_id: str
    samples: int = Field(default=5, ge=3, le=7)


class BiasRequest(RunRequest):
    profile_id: str
    pet_id: str


class UnlockRequest(BaseModel):
    passcode: str = Field(max_length=128)
    turnstile_token: str | None = Field(default=None, max_length=4096)
