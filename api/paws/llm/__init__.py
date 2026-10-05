from __future__ import annotations

from functools import cache

from ..config import settings
from .base import Image, LLMError, LLMProvider, gather_limited

__all__ = ["Image", "LLMError", "LLMProvider", "gather_limited", "get_provider"]


@cache
def get_provider(name: str) -> LLMProvider:
    # Lazy imports: the Gemini SDK is heavy, and cached mode (most traffic) never needs it -> faster cold starts.
    if name == "claude" and settings.claude_cli:
        from .claude_cli import ClaudeCliProvider

        return ClaudeCliProvider(settings.claude_model)
    if name == "gemini" and settings.gemini_key:
        from .gemini import GeminiProvider

        return GeminiProvider(settings.gemini_key, settings.gemini_model)
    raise LLMError(f"Provider '{name}' is not available here (available: {settings.providers or 'none'})")
