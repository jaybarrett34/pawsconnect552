"""Part C3 (match explainer, CoT + self-consistency) and Part D (Bias Lens, breed-label counterfactuals)."""
from __future__ import annotations

from collections import Counter

from fastapi import HTTPException

from ..llm import LLMProvider, gather_limited
from ..prompts import MATCH
from ..schemas import BiasRequest, CallMeta, Match, MatchRequest
from ..store import samples
from .base import Feature, listing_text

SCORE = {"Poor Fit": 0, "Possible Fit": 1, "Strong Fit": 2}
SAMPLE_TEMPERATURE = 1.0  # > 0 so runs can genuinely disagree


def resolve(profile_id: str, pet_id: str) -> tuple[dict, dict]:
    profile, pet = samples.profiles.get(profile_id), samples.pets.get(pet_id)
    if not (profile and pet):
        raise HTTPException(404, "Unknown profile or pet")
    return profile, pet


async def sample_matches(llm: LLMProvider, profile: dict, pet: dict, n: int) -> tuple[list[Match], list[CallMeta]]:
    async def one(i: int):
        return await llm.complete(
            system=MATCH.system, version=MATCH.version, schema=Match, temperature=SAMPLE_TEMPERATURE,
            user=f"HOUSEHOLD PROFILE\n{profile['text']}\n\nPET LISTING\n{listing_text(pet)}\n\n"
                 f"(Independent assessment #{i + 1}.) Work through the steps, then rate.",
        )
    results = await gather_limited([one(i) for i in range(n)], llm.concurrency)
    return [r[0] for r in results], [r[1] for r in results]


def vote(runs: list[Match]) -> dict:
    """Majority vote; ties break toward the more conservative rating and are flagged for review."""
    counts = Counter(r.rating for r in runs)
    top = max(counts.values())
    leaders = [k for k, v in counts.items() if v == top]
    majority = min(leaders, key=SCORE.__getitem__)
    return {
        "votes": [r.rating for r in runs],
        "counts": dict(counts),
        "majority": majority,
        "agreement": top / len(runs),
        "unanimous": len(counts) == 1,
        "tie": len(leaders) > 1,
        "mean_score": sum(SCORE[r.rating] for r in runs) / len(runs),
        "human_review": len(leaders) > 1 or top / len(runs) < 0.6,
    }


class MatchFeature(Feature[MatchRequest]):
    name = "match"

    def cache_key(self, req: MatchRequest) -> str:
        return f"{req.profile_id}:{req.pet_id}"

    async def compute(self, req: MatchRequest, llm: LLMProvider):
        profile, pet = resolve(req.profile_id, req.pet_id)
        runs, calls = await sample_matches(llm, profile, pet, req.samples)
        v = vote(runs)
        rep = next(r for r in runs if r.rating == v["majority"])
        return {**v, "runs": [r.model_dump() for r in runs], "top_reasons": rep.top_reasons,
                "top_concern": rep.top_concern}, calls


class BiasLensFeature(Feature[BiasRequest]):
    """Counterfactual audit: hold every listing fact fixed, swap only the breed label, re-run the matcher."""
    name = "bias"
    samples_per_variant = 5

    def cache_key(self, req: BiasRequest) -> str:
        return f"{req.profile_id}:{req.pet_id}"

    async def compute(self, req: BiasRequest, llm: LLMProvider):
        profile, pet = resolve(req.profile_id, req.pet_id)
        labels = list(dict.fromkeys([pet["breed"], *samples.raw["breed_variants"]]))
        batches = [sample_matches(llm, profile, {**pet, "breed": label}, self.samples_per_variant) for label in labels]
        results = await gather_limited(batches, 2)
        variants, calls = [], []
        for label, (runs, metas) in zip(labels, results):
            variants.append({"label": label, "original": label == pet["breed"], **vote(runs),
                             "top_concern": runs[0].top_concern})
            calls += metas
        means = [v["mean_score"] for v in variants]
        majorities = {v["majority"] for v in variants}
        spread = max(means) - min(means)
        flipped = len(majorities) > 1
        best, worst = max(variants, key=lambda v: v["mean_score"]), min(variants, key=lambda v: v["mean_score"])
        summary = (
            f"Changing only the breed label moved the majority rating ({' / '.join(sorted(majorities, key=SCORE.get))}). "
            f"'{worst['label']}' scored lowest and '{best['label']}' highest. Treat this as label-driven bias and review the prompt."
            if flipped else
            f"The majority rating stayed '{variants[0]['majority']}' under every label (mean-score spread {spread:.2f} on a 0-2 scale). "
            + ("Small shifts in individual votes suggest some label sensitivity worth monitoring." if spread >= 0.4
               else "No meaningful label sensitivity detected for this pair.")
        )
        return {"pet_id": pet["id"], "profile_id": profile["id"], "variants": variants, "flipped": flipped,
                "spread": spread, "summary": summary, "human_review": flipped or spread >= 0.4}, calls
