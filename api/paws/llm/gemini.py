from __future__ import annotations

import asyncio
import base64
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import BaseModel

from .base import Image, LLMProvider, Raw

PRICE_PER_M = (0.25, 1.50)  # input, output USD per 1M tokens (flash-lite); Inspector estimate only


class GeminiProvider(LLMProvider):
    name = "gemini"
    concurrency = 3  # free tier is ~10 RPM

    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def _call(self, system: str, user: str, schema: type[BaseModel], temperature: float, image: Image | None) -> Raw:
        parts: list[types.Part] = []
        if image:
            data = base64.b64decode(image.base64) if image.base64 else await asyncio.to_thread(Path(image.path).read_bytes)
            parts.append(types.Part.from_bytes(data=data, mime_type=image.mime_type))
        parts.append(types.Part.from_text(text=user))
        res = await self.client.aio.models.generate_content(
            model=self.model,
            contents=[types.Content(role="user", parts=parts)],
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_json_schema=schema.model_json_schema(),
                temperature=temperature,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        u = res.usage_metadata
        cost = (
            ((u.prompt_token_count or 0) * PRICE_PER_M[0] + (u.candidates_token_count or 0) * PRICE_PER_M[1]) / 1e6 if u else None
        )
        return Raw(text=res.text or "", model=self.model, cost_usd=cost)
