"""Local-only provider: Claude Code in headless mode (`claude -p`), billed to the user's Claude plan.

Notes: the CLI exposes no temperature flag, so sampling uses Claude's default (1.0). Images are passed by
file path with only the Read tool enabled and scoped to the image's folder.
"""

from __future__ import annotations

import asyncio
import base64
import json
import tempfile
from pathlib import Path

import orjson
from pydantic import BaseModel

from .base import Image, LLMError, LLMProvider, Raw


class ClaudeCliProvider(LLMProvider):
    name = "claude"
    concurrency = 6

    def __init__(self, model: str):
        self.model = model

    async def _call(self, system: str, user: str, schema: type[BaseModel], temperature: float, image: Image | None) -> Raw:
        # A short custom system prompt replaces Claude Code's large default one (cost + behavior).
        sys_prompt = (
            f"{system}\n\nOUTPUT FORMAT: Respond with ONLY one JSON object matching this JSON Schema. "
            f"No prose, no code fences.\n{json.dumps(schema.model_json_schema())}"
        )
        args = [
            "claude",
            "-p",
            "--output-format",
            "json",
            "--model",
            self.model,
            "--system-prompt",
            sys_prompt,
            "--no-session-persistence",
        ]
        prompt = user
        if image:
            path = image.path or self._spill(image)
            args += ["--tools", "Read", "--allowedTools", "Read", "--add-dir", str(Path(path).parent)]
            prompt = f"First use the Read tool to view the image at: {path}\nThen answer.\n\n{user}"
        else:
            args += ["--tools", ""]

        # Neutral cwd so no project CLAUDE.md / settings leak into the call.
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=tempfile.gettempdir(),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(prompt.encode()), timeout=180)
        except TimeoutError:
            proc.kill()
            raise LLMError("claude -p timed out") from None
        if proc.returncode != 0:
            raise LLMError(f"claude -p exited {proc.returncode}: {(err or out).decode()[:400]}")
        res = orjson.loads(out)
        if res.get("is_error"):
            raise LLMError(f"claude -p error: {res.get('result')}")
        model = next(iter(res.get("modelUsage") or {}), self.model)
        return Raw(text=res.get("result", ""), model=model, cost_usd=res.get("total_cost_usd"))

    @staticmethod
    def _spill(image: Image) -> str:
        suffix = "." + (image.mime_type.split("/")[-1] or "jpg")
        with tempfile.NamedTemporaryFile(prefix="paws-", suffix=suffix, delete=False) as f:
            f.write(base64.b64decode(image.base64 or ""))
        return f.name
