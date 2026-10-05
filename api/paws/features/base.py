from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from typing import Any, ClassVar

import orjson
from fastapi import HTTPException
from pydantic import BaseModel

from ..config import settings
from ..llm import LLMProvider, get_provider
from ..schemas import CallMeta, Envelope, Mode
from ..store import demo_cache, kv


class Feature[Req: BaseModel](ABC):
    """Template for every AI feature: cached demo lookup -> live KV cache -> provider call."""

    name: ClassVar[str]

    @abstractmethod
    def cache_key(self, req: Req) -> str | None:
        """Stable id of a bundled input, or None for ad-hoc input (uploads, free text)."""

    @abstractmethod
    async def compute(self, req: Req, llm: LLMProvider) -> tuple[Any, list[CallMeta]]: ...

    async def run(self, req: Req, mode: Mode) -> Envelope:
        key = self.cache_key(req)
        if mode == "cached":
            hit = demo_cache.get(self.name, key) if key else None
            if hit is None:
                raise HTTPException(409, "This input has no cached demo response. Switch to live mode to run it.")
            return Envelope(feature=self.name, input_id=key, mode=mode, cached=True, **hit)

        live_key = self._live_key(req, mode)
        if hit := await kv.get(live_key):
            return Envelope(feature=self.name, input_id=key or "adhoc", mode=mode, cached=True, **orjson.loads(hit))

        data, calls = await self.compute(req, get_provider(mode))
        payload = {"data": _dump(data), "calls": [c.model_dump() for c in calls]}
        await kv.set(live_key, orjson.dumps(payload).decode(), settings.live_cache_ttl)
        return Envelope(feature=self.name, input_id=key or "adhoc", mode=mode, cached=False, **payload)

    def _live_key(self, req: Req, mode: Mode) -> str:
        body = req.model_dump(exclude={"mode"})
        digest = hashlib.sha256(orjson.dumps(body, option=orjson.OPT_SORT_KEYS)).hexdigest()[:32]
        return f"live:{self.name}:{mode}:{digest}"


def _dump(x: Any) -> Any:
    if isinstance(x, BaseModel):
        return x.model_dump()
    if isinstance(x, list):
        return [_dump(i) for i in x]
    if isinstance(x, dict):
        return {k: _dump(v) for k, v in x.items()}
    return x


def listing_text(pet: dict) -> str:
    keys = ("name", "species", "breed", "age", "sex", "weight", "energy", "good_with", "not_good_with", "notes", "status")
    return "\n".join(f"{k}: {pet[k]}" for k in keys)
