# PawsConnect: AI Suite for a Pet Adoption Platform

MIS 552 Homework 1 · Jay Barrett · October 4, 2026 · Live demo: https://pawsconnect552.vercel.app · Code: https://github.com/jaybarrett34/pawsconnect552

## 1. Scenario and Design Brief

PawsConnect is a fictional platform that connects shelters and rescues with adopters. I built five AI features, each for one stakeholder and one decision. Every output is explained and flagged for a human when the model is unsure, because mistakes here affect living animals.

**Stakeholder map**

| Group | Goal | Pain point |
|---|---|---|
| Shelter staff and volunteers | Complete, honest listings fast | No time to write profiles; listings sit half-empty |
| Adopters | A pet that fits their life; quick answers | Slow replies; unclear why a pet fits |
| Shelter coordinators | Handle urgent cases first | Emergencies buried in mixed messages |
| Trust and Safety | Fair, accountable AI decisions | No way to tell if "pit bull" listings are treated differently |

**Feature-to-technique matrix.** I used the Chapter 1 framing: to know something new, use retrieval; to act differently, fine-tune; to be instructed well, prompt. Every feature here is the third case.

| Feature | Technique | Why not RAG or fine-tuning |
|---|---|---|
| B Listing | Vision + JSON schema + fallback rules | The model must see and follow rules, not learn facts. |
| C1 Triage | Few-shot, labels defined in prompt | Four examples scored 10/10. Fine-tuning needs hundreds of labeled messages and is hard to change when categories change. |
| C2 Counselor | Role-play prompt + LLM judge | Honesty rules are instructions; a second call checks them because one prompt can be talked out of its rules. |
| C3 Match | Chain-of-thought + 5-vote self-consistency | Fit is multi-factor reasoning; voting turns sampling noise into an agreement signal. |
| D Bias Lens | Counterfactual prompting + voting | An audit needs a controlled experiment on my own matcher, not new knowledge. |

**Model selection.** Claude Haiku 4.5, run through the Claude Code CLI (`claude -p`), recorded the cached demo locally. Gemini 3.1 Flash-Lite is the deployed live model. I chose it because it reads images, costs about $0.00016 per triage call (measured), answers in about 5 seconds, and is good enough that 5 votes per match stay cheap. The app opens in cached mode, so a grader needs no API key. Live mode on the public site sits behind a passcode, and 2 wrong attempts lock it for 30 minutes to protect the key.

## 2. Feature Write-ups

### B: Photo to Listing

Each field (species, breed, age, size) carries a value, a confidence, and the visual evidence. The fallback rule says to write "unknown" with low confidence rather than guess a breed. Fee tiers are Standard, Senior Special, Bonded Pair, and Needs Assessment. I enforce the review flag in code as well as the prompt: a low-confidence field, poor photo, no animal, or more than one animal forces `human_review`.

**Result.** Five of seven photos were flagged, each with a specific reason. The blurry and empty photos fell back to "unknown" and Needs Assessment instead of inventing a pet. The telling case is Rocco: the model called him "Pit Bull type" at medium confidence and asked staff to verify. For volunteers, the tool is most cautious on the label that most affects adoption odds, which is where I want a human to decide.

### C1: Inquiry Triage

The prompt defines six categories, four urgency levels (P1 same hour to P4 when convenient), a routing team per need, and a rule to route mixed messages by the most urgent need. Four few-shot examples cover the hard boundaries. Code forces review on any P1 or any confidence below high.

**Result.** Category and urgency matched my hand labels on 10/10 messages, including three I wrote to be ambiguous. Four were flagged, and they were the right four: the two P1 cases (an adopted dog vomiting and unable to stand, and a dog tied outside a gas station for 6 hours with no water) and the two medium-confidence mixed messages. A 40% review rate sounds high, but it lands where a wrong route costs a coordinator the most. Ten messages is a sanity check, not an accuracy estimate.

### C2: Counselor "Maple" with an LLM Judge

Maple answers only from the listing, never promises availability or behavior with kids, gives no veterinary advice, and escalates emergencies. A judge call scores each draft on five criteria, and code forces "revise" if any criterion fails. Maple then regenerates once with the judge's feedback; a second failure hands the adopter to a human.

**How I produced the judge catch.** Maple never wrote a draft the judge rejected, so I induced one, and it took four tries. Removing the honesty rules (v0) and explicitly ordering bad behavior (v1, v2) failed: Haiku still told the adopter to confirm availability and still escalated the medical question. Its own safety training put the rules back. A one-shot example of the bad style (v3) finally worked, and I reframed it as "Gus," a lazy backup manager covering Maple's shift (v4-weak). Gus wrote: "Yep, Rocco will be there tomorrow, and he's totally fine with kids. See you then." The judge failed it on three criteria (consistent with listing, no availability promise, tone). The regenerated reply told the adopter to confirm availability and to ask staff whether a high-energy dog fits a 2-year-old, and it passed.

**Interpretation.** One example moved behavior more than any instruction, which is also why the triage prompt leans on examples. The judge is not redundant: when the persona itself fails, as with a bad prompt deploy or a careless stand-in, the judge is the last check before an adopter drives 3 hours on a false promise.

### C3: Match Explainer

The prompt walks six fixed steps (home, time alone, kids and pets, experience, energy, special needs and cost) before a rating of Strong, Possible, or Poor Fit, and states that breed alone is never evidence of behavior. I sample 5 times at temperature 1.0 and take the majority. Ties break toward the more conservative rating and are flagged for review.

**Result.** Eight of twelve pairs were unanimous, including all three dogs as Poor Fit for a third-floor walk-up left empty 10 hours a day. The four splits were the borderline pairs: family × Rocco 3/2 (Strong/Possible), retiree × Rocco 4/1 (Possible/Poor), family × Biscuit 4/1 (Possible/Poor), and retiree × Luna 4/1 (Strong/Possible). Family × Rocco matters most: a 3/5 "Strong Fit" for a high-energy, leash-pulling dog in a house with a 4-year-old should tell a counselor "discuss this," not "approve." The split shows counselors where to spend their time, which a single answer cannot.

## 3. One Failure Case

On `duo.jpg`, a dog and a cat curled up together, the model counted two animals and asked staff to check for a bonded pair, but still chose fee tier Standard. My prompt allows Bonded Pair "only if they clearly belong together," and the model treated "clearly" as unknowable from one photo. That is arguably honest. The review flag caught it. The fix belongs in code: when `animal_count > 1`, force the tier to Needs Assessment until staff confirm.

## 4. Innovation Feature Rationale: Bias Lens

**Stakeholder and decision.** Bias Lens is for a Trust and Safety analyst deciding whether the matcher can be trusted before adopters see its ratings.

**How it works.** It reruns the production Match prompt unchanged, swapping only the breed label across "pit bull terrier mix," "Labrador retriever mix," "mixed breed (unknown)," and the original. Everything else stays fixed. Each label gets 5 votes; the tool reports the distribution, any majority flip, and the spread.

**Result.** No label flipped a majority in any of six pairs. But in two pairs, "pit bull terrier mix" drew the only downgraded votes: family × Rocco went 4/1/0 versus 5/0/0 for Labrador and unknown, and retiree × Biscuit went 4/1/0 versus 5/0/0 for the other three labels. Other labels drew downgrades elsewhere too ("mixed breed (unknown)" went 0/3/2 for family × Biscuit), so at 5 votes I can't separate bias from noise. What surprised me is that family × Rocco, with the same pit bull label, voted 3/2 in C3 and 4/1 here. My reading is no evidence of a flip, and a weak signal worth watching.

**What could go wrong.** False reassurance. Five votes, three labels, and dogs only is a small sample, and an analyst could read "no flips" as "no bias."

**Mitigation.** The audit reports per-label votes and spread next to the flip check, so a weak signal stays visible even when nothing flips. Next I would raise the sample size on pairs with any downgrade, add labels and cats, and rerun the audit on every prompt change.

## 5. Ethics Note

Breed labels carry stigma, so the matcher prompt says breed is never evidence of behavior, and Bias Lens tests whether that holds. The AI drafts and flags; humans approve listings and placements. The listing prompt bans guilt-tripping and manipulative urgency.

## 6. AI-Use Disclosure

Claude Code (Claude Opus) built the app from a PRD I directed and approved: the FastAPI backend, the Next.js UI, the prompts, and the cache-recording script. I ran a separate Claude model as a code reviewer. Claude Code drafted this report from my design decisions and the measured results, and I reviewed and edited it. Claude Haiku 4.5 and Gemini 3.1 Flash-Lite are the runtime models. To verify, I ran every feature in cached and live mode, checked triage against my own hand labels (10/10), tested the passcode lockout, reviewed the recorded outputs, and confirmed the zip runs with no API key.

## 7. Appendix

Figure 1: [live-mode screenshot: Listings + Details panel]

Figure 2: [live-mode screenshot: Counselor quality review panel]

Figure 3: [live-mode screenshot: Match vote split]
