from __future__ import annotations

from functools import cache

from ..config import settings
from .base import Image, LLMError, LLMProvider, gather_limited
from .claude_cli import ClaudeCliProvider
from .gemini import GeminiProvider

__all__ = ["Image", "LLMError", "LLMProvider", "gather_limited", "get_provider"]


@cache
def get_provider(name: str) -> LLMProvider:
    if name == "claude" and settings.claude_cli:
        return ClaudeCliProvider(settings.claude_model)
    if name == "gemini" and settings.gemini_key:
        return GeminiProvider(settings.gemini_key, settings.gemini_model)
    raise LLMError(f"Provider '{name}' is not available here (available: {settings.providers or 'none'})")
