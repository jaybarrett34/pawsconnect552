"""Part C1: free-text inquiry -> triage record (few-shot classification, fixed label set)."""

from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel

from ..llm import LLMProvider, gather_limited, get_provider
from ..prompts import TRIAGE
from ..schemas import Mode, Triage
from ..store import samples
from .base import Feature


class TriageItem(BaseModel):
    message_id: str | None = None
    text: str | None = None


class TriageFeature(Feature[TriageItem]):
    name = "triage"

    def cache_key(self, req: TriageItem) -> str | None:
        return None if req.text else req.message_id

    async def compute(self, req: TriageItem, llm: LLMProvider):
        text = req.text or samples.messages.get(req.message_id or "", {}).get("text")
        if not text:
            raise HTTPException(404, "Unknown message")
        data, meta = await llm.complete(
            system=TRIAGE.system,
            version=TRIAGE.version,
            schema=Triage,
            user=f'Message: "{text}"\nReturn the triage record JSON.',
        )
        if data.confidence != "high" or data.urgency == "P1":
            data = data.model_copy(update={"human_review": True})
        return data, [meta]

    async def run_many(self, ids: list[str], text: str | None, mode: Mode):
        items = [TriageItem(text=text)] if text else [TriageItem(message_id=i) for i in ids]
        limit = 8 if mode == "cached" else get_provider(mode).concurrency
        return await gather_limited([self.run(i, mode) for i in items], limit)
