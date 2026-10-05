"""Record live responses for every bundled input into api/paws/data/cache/*.json (the cached demo mode).

usage: uv run scripts/warm.py [--provider claude|gemini] [--only listing,triage,...] [--force]
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

from paws import features as F  # noqa: E402
from paws.features.triage import TriageItem  # noqa: E402
from paws.schemas import BiasRequest, ChatRequest, ListingRequest, MatchRequest  # noqa: E402
from paws.store import demo_cache, samples  # noqa: E402


def jobs():
    yield from ((F.listing, ListingRequest(photo_id=p)) for p in samples.photos)
    yield from ((F.triage, TriageItem(message_id=m)) for m in samples.messages)
    yield from ((F.counselor, ChatRequest(scenario_id=s)) for s in samples.scenarios)
    yield from ((F.match, MatchRequest(profile_id=pr, pet_id=pe)) for pr in samples.profiles for pe in samples.pets)
    yield from ((F.bias, BiasRequest(profile_id=pr, pet_id=pe)) for pr in samples.profiles for pe in samples.raw["bias_pets"])


async def main(provider: str, only: set[str] | None, force: bool):
    todo = [
        (f, r) for f, r in jobs() if (not only or f.name in only) and (force or demo_cache.get(f.name, f.cache_key(r)) is None)
    ]
    print(f"{len(todo)} jobs via {provider}")
    sem = asyncio.Semaphore(4)

    async def run(f, r):
        async with sem:
            t0 = time.time()
            try:
                env = await f.run(r, provider)
            except Exception as e:  # keep warming the rest
                print(f"  FAIL {f.name}:{f.cache_key(r)} {str(e)[:160]}")
                return
            demo_cache.put(f.name, f.cache_key(r), {"data": env.data, "calls": [c.model_dump() for c in env.calls]})
            print(f"  ok   {f.name}:{f.cache_key(r)} ({time.time() - t0:.0f}s)")

    await asyncio.gather(*(run(f, r) for f, r in todo))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="claude", choices=["claude", "gemini"])
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(a.provider, set(filter(None, a.only.split(","))), a.force))
