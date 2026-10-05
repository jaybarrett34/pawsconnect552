"""Runtime settings, read once from the environment. Never hardcode keys."""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parent / "data"
PHOTO_DIR = ROOT / "public" / "pets"


def _load_dotenv() -> None:
    """Share Next.js's .env.local / .env with the API locally (real env vars always win)."""
    for name in (".env.local", ".env"):
        f = ROOT / name
        if f.is_file():
            for line in f.read_text().splitlines():
                k, sep, v = line.partition("=")
                if sep and k.strip() and not k.lstrip().startswith("#"):
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


@dataclass(frozen=True)
class Settings:
    provider: str = field(default_factory=lambda: os.getenv("PROVIDER", "").strip().lower())
    gemini_key: str | None = field(default_factory=lambda: os.getenv("GEMINI_API_KEY") or None)
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"))
    claude_model: str = field(default_factory=lambda: os.getenv("CLAUDE_MODEL", "haiku"))
    passcode: str | None = field(default_factory=lambda: os.getenv("LIVE_MODE_PASSCODE") or None)
    session_secret: str = field(default_factory=lambda: os.getenv("SESSION_SECRET", "dev-only-insecure-secret"))
    turnstile_secret: str | None = field(default_factory=lambda: os.getenv("TURNSTILE_SECRET_KEY") or None)
    kv_url: str | None = field(default_factory=lambda: os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL"))
    kv_token: str | None = field(default_factory=lambda: os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN"))
    on_vercel: bool = field(default_factory=lambda: bool(os.getenv("VERCEL")))

    lockout_attempts: int = 2
    lockout_seconds: int = 30 * 60
    session_hours: int = 12
    live_cache_ttl: int = 7 * 24 * 3600

    @cached_property
    def claude_cli(self) -> bool:
        return not self.on_vercel and shutil.which("claude") is not None

    @property
    def providers(self) -> list[str]:
        out = []
        if self.claude_cli:
            out.append("claude")
        if self.gemini_key:
            out.append("gemini")
        return out

    @property
    def default_mode(self) -> str:
        """Always start in cached demo mode unless PROVIDER explicitly selects an available live provider."""
        return self.provider if self.provider in self.providers else "cached"


settings = Settings()
