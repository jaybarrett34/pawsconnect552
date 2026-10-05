"""Live-mode gate (passcode + 2-strike/30-min lockout + Cloudflare Turnstile + signed session cookie)
and a scraper-defense middleware for /api."""
from __future__ import annotations

import hmac
import re
import time
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import Settings, settings
from .schemas import Mode
from .store import KV, kv

COOKIE = "paws_session"
TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")


class LiveGate:
    """Decides whether a request may use a live (paid) provider."""

    def __init__(self, cfg: Settings, store: KV):
        self.cfg, self.kv = cfg, store

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.passcode)

    def _lock_key(self, ip: str) -> str:
        return f"lock:{ip}"

    async def status(self, request: Request) -> dict:
        ip = client_ip(request)
        fails = int(await self.kv.get(self._lock_key(ip)) or 0)
        locked = fails >= self.cfg.lockout_attempts
        return {
            "gate_enabled": self.enabled,
            "unlocked": not self.enabled or self.has_session(request),
            "locked": locked,
            "retry_after": await self.kv.ttl(self._lock_key(ip)) if locked else 0,
            "attempts_left": max(self.cfg.lockout_attempts - fails, 0),
        }

    async def unlock(self, request: Request, response: Response, passcode: str, token: str | None) -> dict:
        if not self.enabled:
            return await self.status(request)
        ip, key = client_ip(request), self._lock_key(client_ip(request))
        if int(await self.kv.get(key) or 0) >= self.cfg.lockout_attempts:
            # Locked: reject without counting, so attempts can't extend someone else's lock.
            raise HTTPException(429, {"message": "Live mode locked", "retry_after": await self.kv.ttl(key)})
        await self._verify_turnstile(token, ip)
        if not hmac.compare_digest(passcode.encode(), self.cfg.passcode.encode()):
            fails = await self.kv.incr(key, self.cfg.lockout_seconds)
            left = max(self.cfg.lockout_attempts - fails, 0)
            if left == 0:
                raise HTTPException(429, {"message": "Too many wrong passcodes. Live mode locked for 30 minutes.",
                                          "retry_after": self.cfg.lockout_seconds})
            raise HTTPException(401, {"message": "Wrong passcode", "attempts_left": left})
        await self.kv.delete(key)
        exp = datetime.now(timezone.utc) + timedelta(hours=self.cfg.session_hours)
        response.set_cookie(COOKIE, jwt.encode({"live": True, "exp": exp}, self.cfg.session_secret, "HS256"),
                            httponly=True, secure=self.cfg.on_vercel, samesite="lax",
                            max_age=self.cfg.session_hours * 3600, path="/")
        return {**await self.status(request), "unlocked": True}

    def has_session(self, request: Request) -> bool:
        try:
            return bool(jwt.decode(request.cookies.get(COOKIE, ""), self.cfg.session_secret, ["HS256"]).get("live"))
        except jwt.PyJWTError:
            return False

    def require(self, request: Request, mode: Mode) -> None:
        """FastAPI-side check for every feature call. Cached mode is always allowed."""
        if mode == "cached":
            return
        if mode not in self.cfg.providers:
            raise HTTPException(400, f"Live provider '{mode}' is not available on this server")
        if self.enabled and not self.has_session(request):
            raise HTTPException(403, "Live mode is locked. Unlock it with the passcode.")
        if self.cfg.on_vercel and not self.kv.remote:
            raise HTTPException(503, "Live mode disabled: lockout store unavailable (fail closed)")

    async def _verify_turnstile(self, token: str | None, ip: str) -> None:
        if not self.cfg.turnstile_secret:
            return
        if not token:
            raise HTTPException(400, "Bot check required")
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(TURNSTILE_URL, data={"secret": self.cfg.turnstile_secret, "response": token, "remoteip": ip})
        if not r.json().get("success"):
            raise HTTPException(403, "Bot check failed")


class BotGuard(BaseHTTPMiddleware):
    """Scraper defense for /api: blocks known crawler/scraper user agents and rate-limits per IP.
    robots.txt asks politely; this enforces it for clients that ignore it."""

    BLOCKED_UA = re.compile(
        r"GPTBot|ChatGPT-User|CCBot|ClaudeBot|anthropic-ai|Google-Extended|PerplexityBot|Bytespider|Amazonbot|"
        r"FacebookBot|meta-externalagent|Applebot-Extended|Diffbot|ImagesiftBot|Omgilibot|scrapy|python-requests|"
        r"Go-http-client|curl/|wget|HeadlessChrome|PhantomJS", re.I)
    OPEN_PATHS = ("/api/docs", "/api/openapi.json", "/api/health")

    def __init__(self, app, store: KV, per_minute: int = 60):
        super().__init__(app)
        self.kv, self.per_minute = store, per_minute

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api") and not path.startswith(self.OPEN_PATHS):
            ua = request.headers.get("user-agent", "")
            if not ua or (self.BLOCKED_UA.search(ua) and not settings_allows_local(request)):
                return JSONResponse({"detail": "Automated access is not permitted"}, 403)
            bucket = f"rl:{client_ip(request)}:{int(time.time() // 60)}"
            if await self.kv.incr(bucket, 70) > self.per_minute:
                return JSONResponse({"detail": "Rate limit exceeded"}, 429, headers={"Retry-After": "60"})
        response = await call_next(request)
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return response


def settings_allows_local(request: Request) -> bool:
    """Local dev convenience: allow curl/scripts against localhost."""
    return not settings.on_vercel and client_ip(request) in ("127.0.0.1", "::1", "localhost")


gate = LiveGate(settings, kv)
