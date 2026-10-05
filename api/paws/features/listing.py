"""Part B: one pet photo -> structured, honest adoption listing (vision + fallback prompting)."""

from __future__ import annotations

from fastapi import HTTPException

from ..config import PHOTO_DIR
from ..llm import Image, LLMProvider
from ..prompts import LISTING
from ..schemas import Listing, ListingRequest
from ..store import samples
from .base import Feature


class ListingFeature(Feature[ListingRequest]):
    name = "listing"

    def cache_key(self, req: ListingRequest) -> str | None:
        return None if req.image_base64 else req.photo_id

    async def compute(self, req: ListingRequest, llm: LLMProvider):
        if req.image_base64:
            image = Image(req.mime_type, base64=req.image_base64)
        elif req.photo_id in samples.photos:
            image = Image("image/jpeg", path=str(PHOTO_DIR / samples.photos[req.photo_id]["file"].rsplit("/", 1)[-1]))
        else:
            raise HTTPException(404, "Unknown photo")
        data, meta = await llm.complete(
            system=LISTING.system,
            version=LISTING.version,
            schema=Listing,
            image=image,
            user="Draft the adoption listing for this photo. Follow every rule, especially the fallback rule.",
        )
        return enforce_review(data), [meta]


def enforce_review(x: Listing) -> Listing:
    """Guardrail in code, not just in the prompt: any low-confidence signal forces human review."""
    reasons = list(x.review_reasons)
    for field in ("species", "breed", "age_range", "size"):
        attr = getattr(x, field)
        if attr.confidence == "low" and not any(field.split("_")[0] in r.lower() for r in reasons):
            reasons.append(f"{field.replace('_', ' ').capitalize()} is low confidence: {attr.reason}")
    if not x.animal_detected:
        reasons.append("No animal detected in the photo.")
    elif x.animal_count > 1:
        reasons.append(f"{x.animal_count} animals in frame. Confirm which pet this listing is for.")
    if x.image_quality == "poor":
        reasons.append("Photo quality is poor. Consider retaking.")
    reasons = list(dict.fromkeys(reasons))
    return x.model_copy(update={"review_reasons": reasons, "human_review": x.human_review or bool(reasons)})
