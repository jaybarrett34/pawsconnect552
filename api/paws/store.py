"""Storage: bundled demo cache (read-only JSON), and a tiny KV (Upstash REST on Vercel, memory locally)."""

from __future__ import annotations

import time
from functools import cached_property
from pathlib import Path
from typing import Any

import httpx
import orjson

from .config import DATA_DIR, settings

CACHE_DIR = DATA_DIR / "cache"


class Samples:
    """The bundled synthetic dataset (pets, messages, profiles, scenarios)."""

    @cached_property
    def raw(self) -> dict[str, Any]:
        return orjson.loads((DATA_DIR / "samples.json").read_bytes())

    def _index(self, key: str) -> dict[str, dict]:
        return {x["id"]: x for x in self.raw[key]}

    @cached_property
    def pets(self):
        return self._index("pets")

    @cached_property
    def photos(self):
        return self._index("photos")

    @cached_property
    def messages(self):
        return self._index("messages")

    @cached_property
    def profiles(self):
        return self._index("profiles")

    @cached_property
    def scenarios(self):
        return self._index("scenarios")


class DemoCache:
    """Pre-recorded responses for every bundled input: one JSON file per feature, loaded once."""

    def __init__(self, root: Path = CACHE_DIR):
        self.root = root
        self._files: dict[str, dict[str, Any]] = {}

    def _file(self, feature: str) -> dict[str, Any]:
        if feature not in self._files:
            p = self.root / f"{feature}.json"
            self._files[feature] = orjson.loads(p.read_bytes()) if p.exists() else {}
        return self._files[feature]

    def get(self, feature: str, key: str) -> Any | None:
        return self._file(feature).get(key)

    def put(self, feature: str, key: str, value: Any) -> None:
        f = self._file(feature)
        f[key] = value
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / f"{feature}.json").write_bytes(orjson.dumps(f, option=orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS))

    def keys(self, feature: str) -> list[str]:
        return sorted(self._file(feature))


class KV:
    """Minimal async KV. Upstash Redis over REST when configured (shared across serverless instances),
    otherwise an in-process dict with expiries (local dev)."""

    def __init__(self, url: str | None, token: str | None):
        self.remote = bool(url and token)
        self._url, self._headers = url, {"Authorization": f"Bearer {token}"}
        self._mem: dict[str, tuple[Any, float | None]] = {}

    async def _cmd(self, *args: Any) -> Any:
        # Fresh client per call: Vercel's Python runtime may use a new event loop per invocation.
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(self._url, headers=self._headers, content=orjson.dumps([str(a) for a in args]))
        r.raise_for_status()
        return r.json()["result"]

    def _alive(self, key: str) -> Any | None:
        v = self._mem.get(key)
        if v and (v[1] is None or v[1] > time.time()):
            return v[0]
        self._mem.pop(key, None)
        return None

    async def get(self, key: str) -> str | None:
        return await self._cmd("GET", key) if self.remote else self._alive(key)

    async def set(self, key: str, value: str, ttl: int) -> None:
        if self.remote:
            await self._cmd("SET", key, value, "EX", ttl)
        else:
            self._mem[key] = (value, time.time() + ttl)

    async def incr(self, key: str, ttl_on_create: int) -> int:
        if self.remote:
            n = int(await self._cmd("INCR", key))
            if n == 1:
                await self._cmd("EXPIRE", key, ttl_on_create)
            return n
        n = int(self._alive(key) or 0) + 1
        exp = self._mem.get(key, (None, time.time() + ttl_on_create))[1] if n > 1 else time.time() + ttl_on_create
        self._mem[key] = (n, exp)
        return n

    async def ttl(self, key: str) -> int:
        if self.remote:
            return max(int(await self._cmd("TTL", key)), 0)
        v = self._mem.get(key)
        return max(int(v[1] - time.time()), 0) if v and v[1] else 0

    async def delete(self, key: str) -> None:
        if self.remote:
            await self._cmd("DEL", key)
        else:
            self._mem.pop(key, None)


samples = Samples()
demo_cache = DemoCache()
kv = KV(settings.kv_url, settings.kv_token)
