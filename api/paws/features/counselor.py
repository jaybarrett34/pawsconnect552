"""Part C2: 'Maple' counselor persona; every draft is reviewed by an LLM judge (DoorDash pattern).

Per turn: draft -> judge -> (revise: regenerate once with the judge's feedback -> judge again)
-> if still failing, or the persona escalated, the adopter sees a human hand-off instead.
"""
from __future__ import annotations

from fastapi import HTTPException

from ..llm import LLMProvider
from ..prompts import COUNSELOR, COUNSELOR_WEAK, JUDGE
from ..schemas import CallMeta, ChatRequest, CounselorReply, Judgement
from ..store import samples
from .base import Feature, listing_text

HANDOFF = ("I want to make sure you get the right help, so I'm connecting you with a PawsConnect counselor now. "
           "If an animal is in danger or having a medical emergency, please contact an emergency vet immediately.")


class CounselorFeature(Feature[ChatRequest]):
    name = "counselor"

    def cache_key(self, req: ChatRequest) -> str | None:
        return None if req.message else req.scenario_id

    async def compute(self, req: ChatRequest, llm: LLMProvider):
        if req.message:  # ad-hoc single turn (live only)
            pet, weakened, history, messages = samples.pets.get(req.pet_id), req.weakened, list(req.history), [req.message]
        elif sc := samples.scenarios.get(req.scenario_id or ""):
            pet, weakened, history, messages = samples.pets[sc["petId"]], sc["weakened"], [], sc["messages"]
        else:
            raise HTTPException(404, "Unknown scenario")
        if not pet:
            raise HTTPException(404, "Unknown pet")

        turns, calls = [], []
        for msg in messages:
            turn, metas = await self.turn(llm, pet, history, msg, weakened)
            history += [{"role": "adopter", "text": msg}, {"role": "maple", "text": turn["final"]}]
            turns.append(turn)
            calls += metas
        return {"pet_id": pet["id"], "weakened": weakened, "turns": turns}, calls

    async def turn(self, llm: LLMProvider, pet: dict, history: list[dict], msg: str, weakened: bool):
        persona = COUNSELOR_WEAK if weakened else COUNSELOR
        context = f"PET LISTING\n{listing_text(pet)}\n\nCONVERSATION SO FAR\n" + (
            "\n".join(f"{h['role']}: {h['text']}" for h in history) or "(none)")
        calls: list[CallMeta] = []

        async def draft(extra: str = "") -> CounselorReply:
            r, m = await llm.complete(system=persona.system, version=persona.version, schema=CounselorReply,
                                      temperature=0.7, user=f"{context}\n\nADOPTER: {msg}{extra}\n\nWrite Maple's reply.")
            calls.append(m)
            return r

        async def judge(reply: CounselorReply) -> Judgement:
            j, m = await llm.complete(system=JUDGE.system, version=JUDGE.version, schema=Judgement,
                                      user=f"{context}\n\nADOPTER: {msg}\n\nDRAFT REPLY: {reply.reply}\n\nReview the draft.")
            calls.append(m)
            return normalize(j)

        first = await draft()
        j1 = await judge(first)
        turn = {"user": msg, "draft": first.reply, "judgement": j1.model_dump(), "revision": None, "judgement2": None}
        final, status = first, "pass"
        if j1.verdict == "revise":
            second = await draft(f"\n\nA reviewer rejected your previous draft:\n\"{first.reply}\"\n"
                                 f"Reviewer feedback: {j1.feedback}\nRewrite the reply to fix every issue.")
            j2 = await judge(second)
            turn |= {"revision": second.reply, "judgement2": j2.model_dump()}
            final, status = (second, "revised") if j2.verdict == "pass" else (None, "escalated")
        if final is not None and final.escalate:
            status = "escalated"
        turn |= {"status": status, "final": HANDOFF if status == "escalated" and final is None else final.reply,
                 "handoff": status == "escalated"}
        return turn, calls


def normalize(j: Judgement) -> Judgement:
    """The verdict must agree with the rubric: any failed criterion forces 'revise'."""
    crits = (j.in_scope, j.consistent_with_listing, j.tone, j.no_medical_advice, j.no_availability_promise)
    return j if all(c.passed for c in crits) or j.verdict == "revise" else j.model_copy(update={"verdict": "revise"})
