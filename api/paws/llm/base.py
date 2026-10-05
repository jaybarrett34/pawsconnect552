"""Provider abstraction: every model call goes through LLMProvider.complete()."""

from __future__ import annotations

import asyncio
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TypeVar

import orjson
from pydantic import BaseModel, ValidationError

from ..schemas import CallMeta

T = TypeVar("T", bound=BaseModel)
RETRYABLE = re.compile(r"429|RESOURCE_EXHAUSTED|503|overloaded|UNAVAILABLE", re.I)


@dataclass(slots=True)
class Image:
    mime_type: str
    path: str | None = None
    base64: str | None = None


@dataclass(slots=True)
class Raw:
    text: str
    model: str
    cost_usd: float | None


class LLMError(RuntimeError):
    pass


class LLMProvider(ABC):
    name: str
    concurrency: int = 4

    @abstractmethod
    async def _call(self, system: str, user: str, schema: type[BaseModel], temperature: float, image: Image | None) -> Raw: ...

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        version: str,
        temperature: float = 0.2,
        image: Image | None = None,
    ) -> tuple[T, CallMeta]:
        """Call the model, validate against `schema`, retry once with the validation error appended."""
        t0, prompt, cost, err = time.perf_counter(), user, None, None
        for attempt in (1, 2):
            raw = await self._with_backoff(system, prompt, schema, temperature, image)
            if raw.cost_usd is not None:
                cost = (cost or 0) + raw.cost_usd
            try:
                data = schema.model_validate(extract_json(raw.text))
            except (ValueError, ValidationError) as e:
                err = e
                prompt = (
                    f"{user}\n\nYour previous answer failed validation: {str(e)[:300]}\nReturn ONLY the corrected JSON object."
                )
                continue
            return data, CallMeta(
                provider=self.name,
                model=raw.model,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                cost_usd=cost,
                prompt_version=version,
                system=system,
                user=user,
                raw=raw.text,
                attempts=attempt,
            )
        raise LLMError(f"Model output failed validation twice: {str(err)[:300]}")

    async def _with_backoff(self, *args) -> Raw:
        delay = 1.5
        for i in range(3):
            try:
                return await self._call(*args)
            except Exception as e:  # noqa: BLE001 - provider SDKs raise heterogeneous errors
                if i == 2 or not RETRYABLE.search(str(e)):
                    raise
                await asyncio.sleep(delay)
                delay *= 2
        raise AssertionError("unreachable")


def extract_json(text: str) -> object:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    body = fenced.group(1) if fenced else text
    start, end = body.find("{"), body.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in model output")
    return orjson.loads(body[start : end + 1])


async def gather_limited(coros, limit: int):
    """asyncio.gather with a concurrency cap (free-tier rate limits, local CLI processes)."""
    sem = asyncio.Semaphore(limit)

    async def run(c):
        async with sem:
            return await c

    return await asyncio.gather(*(run(c) for c in coros))
