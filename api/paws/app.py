"""FastAPI app. Swagger UI at /api/docs."""
from __future__ import annotations

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware

from . import features as F
from .config import settings
from .prompts import ALL as PROMPTS
from .schemas import (BiasRequest, ChatRequest, Envelope, ListingRequest, MatchRequest, TriageRequest,
                      UnlockRequest)
from .security import BotGuard, gate
from .store import kv, samples

app = FastAPI(
    title="PawsConnect AI API",
    version="1.0.0",
    description="MIS 552 HW1: AI suite for a pet-adoption platform. `mode=cached` replays recorded responses; "
                "`claude`/`gemini` call a live model (gated by passcode when configured).",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(BotGuard, store=kv)

meta = APIRouter(prefix="/api", tags=["meta"])
auth = APIRouter(prefix="/api/auth", tags=["live-mode gate"])
ai = APIRouter(prefix="/api/ai", tags=["features"])


@meta.get("/health")
async def health():
    return {"ok": True}


@meta.get("/config")
async def config(request: Request):
    return {"providers": settings.providers, "default_mode": settings.default_mode,
            "on_vercel": settings.on_vercel, **await gate.status(request)}


@meta.get("/samples")
async def get_samples():
    return samples.raw


@meta.get("/prompts")
async def get_prompts():
    return [{"name": p.name, "version": p.version, "system": p.system} for p in PROMPTS]


@auth.get("/status")
async def auth_status(request: Request):
    return await gate.status(request)


@auth.post("/unlock")
async def unlock(body: UnlockRequest, request: Request, response: Response):
    return await gate.unlock(request, response, body.passcode, body.turnstile_token)


@ai.post("/listing", response_model=Envelope, summary="Part B: photo -> listing")
async def listing(body: ListingRequest, request: Request):
    gate.require(request, body.mode)
    return await F.listing.run(body, body.mode)


@ai.post("/triage", response_model=list[Envelope], summary="Part C1: inquiry triage")
async def triage(body: TriageRequest, request: Request):
    gate.require(request, body.mode)
    return await F.triage.run_many(body.message_ids or list(samples.messages), body.text, body.mode)


@ai.post("/counselor", response_model=Envelope, summary="Part C2: counselor + LLM judge")
async def counselor(body: ChatRequest, request: Request):
    gate.require(request, body.mode)
    return await F.counselor.run(body, body.mode)


@ai.post("/match", response_model=Envelope, summary="Part C3: match explainer + self-consistency")
async def match(body: MatchRequest, request: Request):
    gate.require(request, body.mode)
    return await F.match.run(body, body.mode)


@ai.post("/bias", response_model=Envelope, summary="Part D: Bias Lens counterfactual audit")
async def bias(body: BiasRequest, request: Request):
    gate.require(request, body.mode)
    return await F.bias.run(body, body.mode)


for r in (meta, auth, ai):
    app.include_router(r)

__all__ = ["app"]
