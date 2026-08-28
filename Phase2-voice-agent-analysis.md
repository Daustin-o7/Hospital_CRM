# SAMSTACK AI — Phase 2 Addition Analysis: AI Voice Call Agent

**Date:** 27 August 2026 · **Status:** Planning only, per instruction — no implementation started · **Baseline respected:** FRD_FINAL.md, PRD_Phase1.md, TRD_Phase1.md, Phase2_V1_Outline.md — nothing here rewrites or contradicts those; conflicts found are flagged, not silently resolved.

---

## 1. Executive Decision

**BUILD WITH CONDITIONS.**

The pain is real (survey-analysis-v2: 38% of respondents have no follow-up process at all; no-show tracking is itself absent for half of respondents). But three things must be true before this is anything more than a plan: Phase 1 must have shipped and be running with real pilot clinics (per PRD_Phase1 §9's release criteria — this document does not change that gate), DLT registration must be complete *before* a single outbound call is placed (legal precondition, not a nice-to-have), and the MVP must be far narrower than "AI voice agent" implies — see §7. The single biggest condition: **start with DTMF (keypress) confirmation, not conversational AI**, and only add speech/LLM once that's proven insufficient. This isn't a hedge — it's what "reliability > novelty" actually means once you look at what a reminder-confirmation call needs to accomplish.

---

## 2. Research Findings

**Voice orchestration (searched: Pipecat, LiveKit Agents, Vapi, Retell, Bolna):** Pipecat (open-source, Python, 13k+ GitHub stars) and LiveKit Agents (open-source, WebRTC-native, reached 1.0 in 2025) are the two dominant self-hostable frameworks; both are pipeline/plugin architectures, not finished agents — you still assemble STT/LLM/TTS/telephony yourself [thinnest.ai, techsy.io, evalgent.com — all checked 27 Aug 2026]. **Bolna** (open-source, India-focused) is the more directly relevant finding: it ships Twilio/Plivo/Exotel telephony and Sarvam AI (Indian-language STT/TTS/LLM) integrations *out of the box*, self-hostable, with a managed option at ~₹5.52/min if you skip self-hosting entirely [caller.digital, bolna.ai, GitHub bolna-ai/bolna — checked 27 Aug 2026]. Vapi/Retell are managed, pay-per-minute, fastest to a working demo, least control, U.S.-centric pricing.

**Indian telephony:** Exotel — credit-based prepaid billing, per-minute voice rates found at ₹0.40–0.80/min depending on plan and call type, plans starting roughly ₹9,999+ or $139–200/6 months, ₹500 free trial credit [caller.digital integration page, cloudtalk.io, bonvoice.com — checked 27 Aug 2026, note: primary sources reviewed were third-party comparison sites, not Exotel's own current price card — **flagged for direct confirmation**, see §14].

**STT/TTS Hindi/Hinglish quality:** Sarvam AI's Bulbul TTS and STT are built specifically for Indian languages, explicitly marketed for code-switching (Hinglish/Tanglish) and Indian-accent robustness, integrated directly into Bolna [bolna.ai integration docs, checked 27 Aug 2026]. Independent comparison: commercial STT claims of 92–95% accuracy on clean Hindi/Indian English are common but largely *unpublished WER statistics* — treat as vendor claims, not benchmarked fact; Google is cited as generally leading on Hindi/Tamil/Telugu accent robustness, Deepgram cited as stronger on noisy-call audio specifically [blog.dograh.com, checked 27 Aug 2026].

**LLM:** Gemini's free tier is genuinely generous for this scale — 1,500 requests/day, up to 1M TPM on Flash-tier models, no credit card, function calling included [tokenmix.ai, pecollective.com — checked 27 Aug 2026]. **The disqualifying catch for this specific product:** on the free tier, Google's terms permit using API inputs/outputs to improve their models — explicitly flagged by the source itself as "a blocker" for sensitive-data processing [tokenmix.ai, checked 27 Aug 2026]. Patient name, phone number, and appointment detail is personal data under DPDP regardless of how administrative the call sounds — this rules out the Gemini free tier for any call that touches real patient data, full stop.

**Background jobs:** not separately searched — Hangfire (.NET, free/open-source, mature, actively maintained) is the established fit for reminder scheduling/retry/queueing inside an existing .NET monolith, and reusing it rather than adding new infrastructure is the ponytail-consistent choice. Flagged as high-confidence from established engineering practice rather than a fresh 2026 citation, since this is a stable, non-fast-moving area.

---

## 3. Zero-Cost Reality Check

| Layer | Reality |
|---|---|
| **A. Genuinely ₹0** | Bolna (self-hosted, open-source) · Pipecat/LiveKit if used instead · Hangfire · the .NET/React code itself · using existing `notification_log`/`appointments` schema |
| **B. Free-tier, capped** | Gemini API rate limits (1,500 req/day) — **but excluded from use on real patient data**, see §2. Exotel's ₹500 trial credit. Sarvam API likely has a free/trial tier — **not confirmed**, needs direct provider check |
| **C. Unavoidably paid, no way around it** | Telephony per-minute (Exotel ~₹0.40–0.80/min, confirm live), phone number rental, DLT registration (has a real fee, amount not found in this research pass — **needs provider confirmation**), an LLM tier with acceptable data-privacy terms (either a paid API tier or the compute to self-host an open model) |
| **D. Paid production fallback** | Once past free-tier LLM volume, or once Sarvam's free tier (if any) is exhausted, or once Bolna's self-hosted compute needs to scale past a single small instance |

**Straight answer:** the *software* layer can be genuinely ₹0 (Bolna, self-hosted). The *telecom* layer cannot — you are paying per minute and for a number, no way around it, and pretending otherwise would be dishonest. The realistic floor is: telephony minutes + DLT registration fee + (a small paid LLM tier or self-hosting compute) + existing hosting capacity you already pay for.

---

## 4. Architecture Options

| Factor | A: Max Open Source | B: Hybrid (Recommended) | C: Managed (Vapi/Retell-style) |
|---|---|---|---|
| Software cost | ₹0 | ₹0 (Bolna self-hosted) | Platform fee + per-min |
| Telecom cost | Unavoidable (Asterisk/FreeSWITCH still needs a SIP trunk to reach real phones) | Unavoidable (Exotel per-min) | Bundled into per-min |
| AI cost | ₹0 if fully self-hosted LLM/STT/TTS | Sarvam APIs (cost TBD) or self-hosted for the patient-data-sensitive parts | Bundled, no visibility/control |
| Engineering effort | **Very high** — raw SIP/PJSIP telecom engineering is a distinct discipline neither founder has evidenced | Moderate — Bolna's existing Exotel/Sarvam integrations remove most glue code | Lowest |
| Reliability | Depends entirely on your own ops maturity | Bolna is production-used per research (Awign, Hyreo, GoKwik cited as users) [bolna.ai, checked 27 Aug 2026] | Vendor's problem, but you can't fix it either |
| Hindi/Hinglish | Whatever you wire up yourself | Sarvam, purpose-built for this | Varies by vendor, often weaker on Indian languages specifically |
| Data privacy | Best — full control | Good — self-hosted orchestration, chosen AI providers | Weakest — data flows through a third party's full stack |
| Vendor lock-in | None | Low — Bolna's adapter pattern keeps providers swappable | High |
| Production readiness | Slow to get there for a 2-person team | Realistic in weeks, not months | Fast, but see reliability/lock-in |
| 2-founder suitability | **Poor** — telecom engineering is its own specialty | **Good** | Good short-term, bad long-term (cost scales linearly with usage forever) |

**Chosen: Architecture B.** Architecture A's "self-host everything" doesn't actually reach ₹0 — it just moves the cost from money (which is measurable) to founder time (which is scarcer for two people already building a CRM), and raw SIP telecom engineering is a real, separate discipline. Architecture C is the right *benchmark* for how simple this could be, exactly as the brief asked, but its cost scales forever and the data leaves your control. Architecture B — self-hosted Bolna, Exotel telephony, Sarvam for language, a data-privacy-safe LLM tier — gets real cost control without pretending telecom is free.

---

## 5. Recommended Architecture

```text
SAMSTACK React 19 PWA (unchanged)
       ↓
YARP API Gateway (unchanged)
       ↓
.NET 10 Core Monolith (unchanged)
       ↓
Appointment Service (existing FR-10/11/13 logic — unchanged, still sole source of truth)
       ↓
Notification Orchestrator (evolved from Phase 1's Notification Handler — see §11)
       ├── WhatsApp Adapter (existing, FR-20/21 — unchanged)
       └── Voice Adapter (NEW)
                 ↓
          Bolna (self-hosted voice runtime)
          ├── STT: Sarvam (Hindi/Hinglish) or Deepgram (noisy-call fallback)
          ├── LLM: bounded-domain, paid-tier or self-hosted (NOT Gemini free tier — §2)
          └── TTS: Sarvam Bulbul
                 ↓
             Exotel (telephony, PSTN termination)
```

The Voice Adapter calls the **same internal appointment services** FR-10 through FR-13 already use — it is a new caller of existing logic, not a new appointment system. This is the direct answer to §"Appointment source-of-truth conflict": the voice agent has no scheduling logic of its own.

---

## 6. Conflict & Risk Matrix

| Area | Existing (Phase 1) | New Voice Agent | Conflict | Resolution |
|---|---|---|---|---|
| Notification architecture | `AppointmentConfirmed → Notification Handler → WhatsApp` | Needs a voice channel too | Handler was built single-channel | Evolve to a Notification **Orchestrator** with a channel interface (§11) — extends the existing FR-20/21 abstraction, doesn't replace it |
| Appointment source of truth | FR-10/11/13, DB-level slot-conflict protection | Agent must never invent availability | High risk if built wrong | Voice Adapter calls existing appointment services only — no parallel scheduling logic, no cached availability |
| Booking race condition | `UNIQUE(doctor_id, date, time_slot)` constraint | An LLM must not "check then create" without the same guarantee | Real risk if the agent does its own check-then-write | Route every write through the existing constrained endpoint — the DB constraint that already protects FR-10 protects voice bookings identically, for free |
| Consent | FR-09, purpose-specific, DPDP-aligned | Voice recording/transcription is a *new* purpose | FR-09's existing purpose ("care delivery and appointment/billing records") doesn't cover voice processing | New consent purpose required — see §10, `VoiceCallConsent` |
| Patient privacy | Full record available to Doctor/Clinic Admin roles | Agent should see far less | Over-exposure risk | Minimum data to the model: patient name, phone, upcoming appointment date/time/doctor, clinic hours — nothing clinical |
| Clinical-data boundary | Consultations/prescriptions are Doctor-only (§8 FRD) | Voice agent must never receive these | High risk if scoped carelessly | Voice Adapter's internal API surface literally cannot query `consultations`/`prescriptions` tables — enforced by which service methods it's given access to, not by prompt instruction |
| RBAC | 3 roles (Clinic Admin, Doctor, Receptionist) | Who controls the agent? | Undefined | Clinic Admin: enable/disable, configure. Receptionist: view status, manual retry, take over. Doctor: no new permissions needed — this is an administrative tool |
| Audit | Append-only audit log, DB-role-enforced | Every voice-triggered state change must be logged identically | None if done right | Voice-initiated appointment changes write to the *same* `appointment_history` table FR-13 already writes to — tagged with a `voice_agent` actor, not a new audit system |
| Notification spam | Single WhatsApp flow (FR-20/21) | Voice reminder could double up with WhatsApp | Real UX risk | Orchestrator rule: voice reminder only fires if WhatsApp wasn't confirmed within a defined window — see §"Appointment Reminder Policy" below |
| Offline architecture | FR-22, offline-tolerant registration/billing | A call cannot proceed if the backend is unreachable | Must never create an uncertain booking | If the appointment service is unreachable mid-call, the agent says so plainly and offers a human callback — it does not queue an "offline" booking the way FR-22 queues registration, because a booking needs live conflict-checking that offline mode cannot provide |
| Multi-tenancy | `tenant_id` dormant, present everywhere | New tables need it too | None if built correctly | Every new table (§10) includes `tenant_id` from day one, same discipline as Phase 1 |
| Phase 2 scope | Provisional, pilot-informed | Risk of dragging every other Phase 2 module into scope | Real risk given this feature's size | This document changes only where Voice sits in the priority list (§17) — it does not expand MOD-08/09/10/11/12/13/14/23/24/25's own scope |

---

## 7. Phase 2 MVP Definition

Ranked by engineering effort, cost, business value, risk, reliability, pilot usefulness, regulatory complexity:

| Option | Effort | Cost | Value | Risk | Regulatory complexity |
|---|---|---|---|---|---|
| A. Outbound reminder only | Low | Low | Medium | Low | Lower (Transactional/Service category, not Promotional) |
| B. Outbound + confirm/cancel/reschedule | Medium | Medium | High | Medium | Same as A |
| C. Inbound scheduling + outbound reminders | High | High | High | High | Higher (inbound adds identity verification, more consent surface) |
| D. Full inbound/outbound receptionist | Very High | Very High | Highest (eventually) | Very High | Highest |

**Recommendation: a revised Option A, split in two steps, not Option B/C/D as first cut:**

**Step 1 (true MVP): DTMF-only outbound confirmation.** No STT, no LLM. A TTS or pre-recorded message states the appointment, asks the patient to press 1 to confirm, 2 to cancel, 3 to reschedule (routes to a human callback for 3, not an AI conversation). This needs Bolna/telephony for the call itself, but **zero AI inference** — it's deterministic call-flow logic. This satisfies the *actual* stated goal (reduce missed appointments) with almost none of the risk (no misrecognition, no hallucination, no prompt injection surface, trivial to audit) and is a fraction of Option A's assumed complexity.

**Step 2, only after Step 1 proves the channel works: add STT/LLM for natural speech** ("yes," "cancel please," "can we move it to Friday") as a richer alternative to keypresses, still outbound-only, still confirm/cancel/reschedule — this is closer to the brief's Option B, but arrives *after* the deterministic version, not instead of it.

**Inbound calling (Option C/D) is not recommended for Phase 2 at all** — it multiplies regulatory surface (identity verification over the phone, more consent complexity) and engineering complexity for a capability the survey data doesn't clearly demand yet (no respondent asked for phone-based self-service booking specifically). Revisit after Step 2 is running and pilot clinics ask for it.

---

## 8. User Flows

**Outbound reminder (Step 1, DTMF):** Scheduled job (Hangfire) finds tomorrow's confirmed appointments not yet confirmed via WhatsApp → Voice Adapter places call via Exotel/Bolna → plays appointment details → patient presses 1/2/3 → DTMF result written to `appointments` via the existing FR-13 reschedule/cancel endpoint or a new lightweight confirm endpoint → `notification_log`-equivalent voice record updated → human callback triggered for "3" or no-answer/voicemail.

**Confirmation (Step 2, speech):** Same trigger → agent asks openly → STT transcribes → bounded-intent classification (confirm/cancel/reschedule/unclear) → unclear after 2 retries escalates to human, does not guess.

**Reschedule:** Patient requests a new time → agent calls `get_available_slots()` (existing service, read-only) → offers 2–3 options → patient picks → write goes through the *same* constrained create/update endpoint FR-13 uses, so the unique-constraint protection applies identically to a voice-originated reschedule as a receptionist-originated one.

**Cancellation:** Direct call to the existing FR-13 cancel path, no new logic.

**Inbound booking:** Explicitly out of scope for this Phase 2 addition (§7) — no flow defined yet, by design.

**Human handoff:** Any of the triggers in §"Human Handoff" below → call transfers to the clinic's configured receptionist number via Exotel's transfer capability, with context (patient name, reason) passed if technically feasible, logged either way.

---

## 9. AI Guardrails

Hard boundaries, enforced architecturally, not just by prompt instruction:
- The agent's tool set (§ below) contains **no medical/clinical functions** — it cannot query `consultations` or `prescriptions` even if asked, because those service methods are never exposed to it.
- Any utterance classified as a medical question, symptom description, or request for clinical advice → immediate human escalation, no attempted answer, ever.
- The agent identifies itself as automated at call start — not because it's confirmed mandatory yet (§14 marks AI-disclosure as "Likely," trending toward required, not yet finalized), but because pretending to be human is both a bad-faith pattern this project shouldn't build regardless of the letter of the law, and a real trust risk in a market where "AI interference... professionalism of doctors" was an actual, named patient-facing concern (survey-analysis-v2 §5).
- LLM intent output is never itself an authorization to write data — every write goes through the same validated backend service and constraint layer a human-initiated request would.

---

## 10. Data Model Changes

Evaluated each candidate against "why can't this reuse an existing table":

| Entity | Needed? | Why / why not reuse existing |
|---|---|---|
| `VoiceCallConsent` | **Yes** | FR-09's `patient_consent` covers "care delivery and appointment/billing" — voice recording/processing is a materially different purpose under DPDP's specific-purpose standard (§2's research finding on "free, specific, informed" consent). Cannot be silently folded into the existing table without weakening what that table already correctly does. |
| `VoiceCall` | **Yes** | Call-level record (patient, appointment, outcome, duration, channel used) — genuinely new information, no existing table holds it. `tenant_id` present, retention tied to consent purpose. |
| `VoiceCallEvent` | **Yes, but minimal** | State-machine transitions (§ below) for debugging/audit — but reuses the *pattern* of `notification_log`, doesn't need to be a heavyweight event-sourcing table for a 3–5 clinic pilot. |
| `VoiceCallAttempt` | **No, not separately** | Retry/attempt tracking folds into `VoiceCall` as a count + timestamps — a separate table is over-normalization for this scale (ponytail: does this need to exist as its own table, or is a column enough?). |
| `VoiceCallTranscript` | **Conditional — see §"Call Recording" below** | Only if Mode 2/3 (transcript/audio) is chosen; not created at all if Mode 1 (no recording) is the MVP choice, which is the recommendation. |
| `VoiceAgentConfig` | **Yes, minimal** | Clinic Admin's enable/disable, timing, escalation number — reuses the `clinics` table's pattern (FR-05) rather than inventing a new config paradigm. |
| `PatientCommunicationPreference` | **No, not yet** | Interesting future idea (patient prefers WhatsApp over voice) but nothing in current evidence demands it for MVP — flagged as a Fast-Follow-within-this-feature idea, not built now. |
| `VoiceCallOutcome` | **No, not separately** | An outcome (confirmed/cancelled/rescheduled/no-answer) is a status field on `VoiceCall`, not its own table. |

**Net new tables: 4** (`VoiceCallConsent`, `VoiceCall`, `VoiceCallEvent`, `VoiceAgentConfig`), not the 8 candidates originally listed — half were either unnecessary or over-normalized for this scale.

---

## 11. API/Event Changes

**Minimum new API surface:**
```
POST /api/v1/voice/config          (Clinic Admin only — enable/disable, timing, escalation number)
GET  /api/v1/voice/calls           (list, filterable — for Receptionist/Clinic Admin views)
POST /api/v1/voice/webhooks        (Bolna/Exotel callback — call status updates)
```
That's it for direct new endpoints — booking/cancel/reschedule actions route through FR-10/13's *existing* endpoints, not new voice-specific ones, per the explicit "don't duplicate appointment logic" instruction.

**Event evolution:** yes, `AppointmentConfirmed` alone isn't enough once a second channel exists. Minimal addition:
```
AppointmentReminderDue   (new — the trigger both WhatsApp and Voice react to)
VoiceCallCompleted       (new — outcome for the Orchestrator's spam-prevention logic, §"Reminder Policy")
```
Not adding `AppointmentRescheduled`/`AppointmentCancelled` as new events — FR-13 already handles those synchronously; they don't need an event unless something new needs to react to them asynchronously, and nothing does yet.

---

## 12. Tech Stack

| Component | Choice | Why |
|---|---|---|
| Orchestration | Bolna (self-hosted) | Built-in Exotel + Sarvam integration removes the glue code Pipecat/LiveKit would require you to write yourself |
| Telephony | Exotel | India-first, DLT/TRAI-aware ecosystem, real pricing found (~₹0.40–0.80/min, confirm live) |
| STT | Sarvam (primary), Deepgram (noisy-call fallback if quality demands it later) | Purpose-built for Hindi/Hinglish/Indian accents |
| TTS | Sarvam Bulbul | Same reasoning, natural-sounding Indian-language voices per research |
| LLM (Step 2 only — Step 1 needs none) | A paid tier with acceptable data-privacy terms, or a self-hosted small open model (e.g., via Ollama) for the bounded confirm/cancel/reschedule intent set | Gemini free tier explicitly excluded — §2 |
| Background jobs | Hangfire (.NET) | Already the natural fit inside the existing monolith — no new infrastructure |
| Hosting | Existing Azure Container Apps | Reuse, don't add a new hosting paradigm for one feature |

---

## 13. Cost Model

**Assumptions stated explicitly, not hidden:** average call 60–90 seconds for Step 1 (DTMF, short), 2–3 minutes for Step 2 (conversational). Figures below use the ₹0.40–0.80/min Exotel range found in research — **confirm exact current rate before committing**, this is not a verified live quote.

| Calls/month | Telecom (Step 1, ~1 min avg) | STT/TTS (Step 2 only) | LLM (Step 2 only, paid tier) | Hosting/Storage | Total (Step 1 / Step 2) |
|---|---|---|---|---|---|
| 100 | ₹40–80 | ₹0 (Step 1) / small | ₹0 (Step 1) / small | ₹0 (existing capacity) | **~₹50–100** / ~₹300–600 |
| 500 | ₹200–400 | — / moderate | — / moderate | ₹0–small | **~₹250–500** / ~₹1,500–3,000 |
| 1,000 | ₹400–800 | — / moderate | — / moderate | small | **~₹500–1,000** / ~₹3,000–6,000 |
| 5,000 | ₹2,000–4,000 | — / real cost now | — / real cost now | small–moderate | **~₹2,500–5,000** / ~₹15,000–30,000 |
| 10,000 | ₹4,000–8,000 | — / real cost | — / real cost | moderate | **~₹5,000–10,000** / ~₹30,000–60,000+ |

Sarvam/LLM per-call figures for Step 2 are **estimates, not verified quotes** — flagged explicitly rather than presented as confirmed pricing, since Sarvam's exact API pricing wasn't found in this research pass (§14 marks this "Needs Provider Confirmation"). Step 1's numbers are far more trustworthy since they're telecom-only, and telecom pricing was actually found.

**Cost per successful appointment interaction (Step 1):** roughly ₹1–3 at pilot scale (telecom cost, since Step 1 has no AI cost at all). **Cost per booked/rescheduled appointment (Step 2):** meaningfully higher once LLM/STT are in the loop — real number depends on Sarvam's actual pricing, not calculable responsibly without that confirmation.

---

## 14. Compliance

| Item | Classification | Note |
|---|---|---|
| DLT registration mandatory before any commercial outbound call | **Confirmed** | TCCCPR 2018 + Feb 2025 amendment, multiple independent sources, full enforcement by 10 March 2026 |
| Appointment reminders to existing patients likely classify as Service/Transactional, not Promotional | **Likely** | Favorable if correct — Service/Transactional calls have looser DND restrictions than Promotional. Depends on the call containing zero promotional content — must be verified against the exact TRAI category definitions with the telecom provider at registration time |
| 140-series for promotional / 1600(or 160)-series for service calls | **Needs Provider Confirmation** | Sources gave slightly inconsistent series numbers (1600 vs 160) — resolve with Exotel/DLT registration directly, don't guess |
| DND registry doesn't block Service-category calls to opted-in existing customers | **Likely** | Consistent across sources, but "opted-in" must trace to a real, DPDP-grade consent record — see next row |
| Existing FR-09 patient consent covers voice communication | **Needs Legal Review** | Almost certainly **no** as currently scoped ("care delivery and appointment/billing records") — voice-specific consent purpose likely required, see §10 `VoiceCallConsent` |
| Recording a call without announcing it is legal (one-party consent) | **Confirmed** | R.M. Malkani v Maharashtra, 1973 — legal to record. This is a *recording-legality* answer, not a DPDP-*data-processing* answer — the two are separate, per research |
| Recording/processing that audio still needs DPDP-compliant, purpose-specific consent | **Confirmed** | Explicit in research: TRAI consent ≠ DPDPA consent — different questions entirely |
| AI voice disclosure mandatory | **Needs Legal Review** | Circulating draft rules point this direction; not confirmed as finalized law as of this research. Recommend disclosing regardless (§9), independent of the legal question |
| Exact DLT registration fee and timeline | **Needs Provider Confirmation** | Not found in this research pass |
| Calling-hours restriction (9 AM–9 PM) | **Confirmed** | Consistent across sources |
| DPDP's full substantive obligations (Phase 3) timeline | **Confirmed** | Notified Rules put this at May 2027 — meaning the stricter mechanics are still phasing in, not yet fully live, though the underlying 2023 Act's principles already apply as law now |
| Healthcare-sector-specific retention rules overriding general guidance | **Needs Legal Review** | Multiple sources note sector-specific minimums can override general 90-day-style norms — healthcare specifically flagged as a case needing its own check |

---

## 15. Security & Privacy

- **Voice Adapter is an untrusted client of the core monolith** — same trust model as any external caller. It authenticates via a service-to-service credential (not a user JWT), scoped to only the tool functions in §"Voice Agent Tooling" — no direct database access, ever.
- **Tool-level permission, not blanket API access:** `get_patient_by_phone`, `get_upcoming_appointments`, `get_available_slots`, `create_appointment`, `reschedule_appointment`, `cancel_appointment`, `confirm_appointment`, `get_clinic_hours`, `transfer_to_human`, `end_call` — implemented as internal application service calls (same layer FR-10–13 already use), not raw REST exposed to the model, and not MCP for this MVP (MCP adds a protocol layer this small a tool set doesn't need yet — ponytail discipline again).
- **Least privilege on data exposed to the model:** patient name, phone, upcoming appointment date/time/doctor, clinic hours. Nothing else — explicitly not diagnosis, prescriptions, or billing history.
- **Prompt-injection resistance:** the model's tool outputs are validated by the same backend rules a human-originated request hits (the unique-constraint on appointments doesn't care who or what is asking) — this is the actual defense, not prompt engineering alone. LLM intent is a *request*, the backend is the *authority*, exactly as the brief's final principle states.
- **Rate limiting/replay protection:** webhook endpoints (`/voice/webhooks`) validate provider signatures (same pattern as FR-18's Razorpay webhook handling) before trusting any payload.
- **Secrets:** Sarvam/Exotel/Bolna credentials in Key Vault, consistent with TRD_Phase1 §5's existing secrets pattern — no new secrets paradigm introduced.

---

## 16. Testing Strategy

Extends TRD_Phase1 §8 rather than replacing it:
- **Unit:** DTMF/intent-to-action mapping, reminder-policy timing logic (§"Reminder Policy"), retry/backoff logic
- **Integration:** real Postgres, real concurrency test — a voice-originated reschedule racing a receptionist-originated one on the same slot, confirming the existing unique constraint resolves it correctly regardless of origin
- **Voice simulation:** English, Hindi, Hinglish, background noise, silence, mid-sentence interruption — required before Step 2 (STT/LLM) ships, not needed for Step 1 (DTMF has no recognition to test)
- **E2E (Step 1):** reminder → confirm, reminder → cancel via keypress, reminder → reschedule-request routes to human, no-answer, voicemail, busy
- **E2E (Step 2, later):** the same set via natural speech, plus duplicate-booking race, human handoff, backend-unavailable-mid-call

---

## 17. Revised Phase 2 Priority

| # | Module | Note |
|---|---|---|
| 1 | MOD-23 Pre-Check Form | Unchanged — already validated (survey-analysis-v2 §4), reuses proven pattern |
| **2** | **Voice Agent Step 1 (DTMF outbound confirmation)** | **New, inserted here** — directly addresses the highest-frequency named pain (no follow-up process, 38% of respondents) with the lowest-risk version of this feature, cheaper and faster to ship than MOD-24/25 |
| 3 | MOD-24 + MOD-25 Emergency Queue + Live Tracking | Unchanged position, still paired |
| 4 | MOD-12 Speciality Templates | Unchanged |
| 5 | MOD-09 Inventory | Unchanged |
| 6 | MOD-08 Lab Records | Unchanged |
| 7 | MOD-13 Notification Rules Engine | **Now explicitly sequenced with Voice Step 2** — see §18 relationship decision below |
| 8 | Voice Agent Step 2 (speech/LLM) | New — only after Step 1 validates and MOD-13's rules engine exists to host it properly |
| 9 | MOD-10 Wishlist | Unchanged |
| 10 | MOD-11 Finance Ledger | Unchanged |
| 11 | MOD-14 Platform Admin | Unchanged |

**Why Voice Step 1 jumps ahead of MOD-24/25/12/09/08:** it's cheaper (§13), lower-risk (deterministic, no AI failure modes), and answers a pain point already validated at higher frequency (follow-up/reminder failure, 38%) than the pain points those modules answer. Voice Step 2 stays *behind* MOD-13 deliberately — see §18.

---

## 18. Updated Phase 2 Plan — Addition to Phase2_V1_Outline.md

*(Proposed addition only — not a rewrite of existing module entries)*

> ## MOD-27 — AI Voice Call Agent (Administrative, Outbound-First)
> **Purpose:** Reduce missed appointments via automated outbound calls — reminder, confirm, cancel, reschedule. Administrative only; never diagnoses, advises, or makes clinical decisions.
> **Two internal steps, not one monolithic build:**
> - **27a (DTMF):** No STT/LLM. Keypress confirm/cancel/reschedule-to-human. Ships second in priority order, right after MOD-23.
> - **27b (Speech):** Adds Sarvam STT/TTS + a data-privacy-safe LLM tier for natural-language confirm/cancel/reschedule. Ships after MOD-13 (Notification Rules Engine) exists, since 27b's reminder timing logic is naturally an extension of that engine, not a parallel system.
> **Explicitly out of scope for this module, indefinitely pending pilot evidence:** inbound calling, general-purpose conversation, anything beyond scheduling administration.
> **Depends on:** MOD-07 (existing notification foundation), FR-10/12/13 (appointment services, reused not duplicated), MOD-13 (for 27b specifically).
> **New tables:** `VoiceCallConsent`, `VoiceCall`, `VoiceCallEvent`, `VoiceAgentConfig` — see full Phase 2 Voice Agent Analysis document for schema detail.
> **Regulatory precondition, not just a task:** DLT registration and a DPDP-compliant voice-specific consent flow must both be complete before 27a goes live — this is a launch blocker, not a parallel workstream.

---

## 19. Recommended Implementation Sequence

```text
Phase 2A — Foundation (shared with MOD-23)
  DLT registration started immediately (weeks-long process, start early)
  Voice-specific consent flow (VoiceCallConsent) added to registration UX
  Bolna self-hosted, Exotel account provisioned, test calls in sandbox

Phase 2B — Voice Step 1 (MOD-27a): DTMF reminder MVP
  No STT/LLM. Ship, measure, validate against real pilot no-show/confirm data.

Phase 2C — MOD-13 Notification Rules Engine
  Built with Voice Step 2 as a known future consumer, not bolted on after.

Phase 2D — Voice Step 2 (MOD-27b): Speech-based confirm/cancel/reschedule
  Only if 2B's data shows keypress friction is a real limiter, not assumed upfront.

Phase 2E — Optimization
  Only relevant once real call volume exists to optimize against.
```
No stage here is included speculatively — each is justified by a specific finding above, not a generic "AI project" template.

---

## 20. Final CTO Verdict

**Build now?** No — not before Phase 1 ships and its release criteria (PRD_Phase1 §9) are met. This document is planning, per the brief's own instruction, and that gate doesn't move.

**Build after pilot?** Yes, and specifically Step 1 (DTMF) first — it's cheap, deterministic, and answers the highest-frequency validated pain point in the whole survey dataset.

**What must be validated first?** Whether Phase 1's WhatsApp reminders alone move the no-show/follow-up numbers meaningfully — if they do, Voice Step 1 might be lower priority than currently ranked; if WhatsApp confirmation rates stay low, that's the direct evidence Voice Step 1 is worth building next.

**Single biggest risk:** Regulatory, not technical — DLT/TRAI/DPDP compliance for voice is a genuinely moving target through 2026–2027 (§14's "Needs Legal Review" rows aren't hedging, they're real open items), and getting this wrong risks the clinic's own number being blacklisted across carriers, not just a fine.

**Single biggest upside:** MOD-27a is one of the cheapest, lowest-risk Phase 2 items on the entire list — deterministic DTMF logic, no AI failure modes, answers a pain point already proven in real data — while everyone else building "AI voice agents" is reaching straight for the expensive, riskier conversational version this analysis explicitly recommends *not* starting with.
