# SAMSTACK AI — Product Requirements Document (PRD)
## Phase 1 — Track 1: CRM + Billing, India Adapter

---

## 1. Document Information

| Field | Value |
|---|---|
| Title | SAMSTACK AI — PRD, Phase 1 |
| Version | 1.0 |
| Date | 26 August 2026 |
| Companion to | samstack-ai-frd-phase1-FINAL.md (what), samstack-ai-trd-phase1-v1.md (how) — this document is why and for whom |

---

## 2. Product Vision & Positioning

One connected system replacing the paper register and disconnected tools running most surveyed practices today — proven with a small paying pilot before any other module, region, or tier is built. Full positioning reasoning: samstack-ai-v2-sharpened-plan §3. Not repeated here.

---

## 3. User Personas

Composite personas built from real patterns in survey-analysis-v2 (n=24) — **anonymized**, not literal respondents. Using an actual respondent's name for a published persona would repurpose data they gave for a research call into something they didn't agree to, which is exactly the kind of purpose-drift the product's own DPDP design (FR-09) exists to prevent.

### Persona 1: "Dr. Priya" — Solo AYUSH Practitioner
- Solo practitioner, Ayurveda/Homeopathy, Tier 2/3 city or rural
- Currently: paper register, no dedicated software
- ABDM-registered already
- Uses WhatsApp with patients sometimes, no formal reminder process
- **Top stated pain:** patient follow-up — patients fall through the cracks between visits
- **What would make her switch:** something that doesn't add front-desk complexity (she often *is* the front desk) and doesn't require real training investment ("fear of training" — survey-analysis-v2 §5)

### Persona 2: "Dr. Arjun" — Growing Multi-Doctor Dental Practice
- 2–5 doctors, Dental, Tier 2 city
- Currently: paper register or an underwhelming dedicated tool
- Named pain: "not getting good software in good prices," time management, "unwanted appointments" (patients booking who aren't a fit)
- **What would make him switch:** clear, predictable pricing and a pre-visit filter on bookings (directly maps to MOD-23, Fast-Follow — not in Phase 1, flagged as his real ask for later)

### Persona 3: "Dr. Kavita" — Larger Practice/Hospital Administrator
- 6–15 doctors or hospital-scale, various specialties
- Currently: either an expensive dedicated tool (₹25,000+/month) or, notably, still on Microsoft Word/paper *despite* scale
- Named pains: facility/hygiene issues (not software-addressable — noted honestly, not stretched into the pitch), staffing shortage, payment issues
- **What would make her switch:** this persona is the least clearly served by Phase 1's Shared-SaaS-only scope — she's the natural Dedicated-Instance/Track-4 buyer later, not a Phase 1 pilot target. Included here so the product doesn't quietly drift toward serving her before it's ready to.

### Persona 4: "Meera" — Receptionist/Front Desk (the daily user, not the buyer)
- Not a doctor, not the buyer — this is the person actually touching the product most hours in a day
- Cares about: speed, not breaking mid-patient-queue, not needing retraining every time something changes
- **Why she matters separately from Personas 1–3:** the idea-validation report flagged buyer≠user as a real risk (§14) — if Meera hates the tool, Dr. Priya's enthusiasm as the buyer doesn't save the pilot. Every FR's UX should be judged against her patience, not just the doctor's feature checklist.

---

## 4. User Journeys

**Journey A — Dr. Priya's Tuesday morning (Personas 1 + 4):** Meera registers a walk-in (FR-06, under 3 required fields) → books into the queue (FR-10/12) → Dr. Priya sees the patient, writes a consult note and prescription (FR-14/15) → Meera generates the invoice and collects cash or a Razorpay UPI payment (FR-17/18) → the patient gets a WhatsApp confirmation automatically (FR-20), and a reminder ahead of their follow-up (FR-21) without anyone having to remember to send it.

**Journey B — Dr. Arjun's front desk during a connectivity drop (Persona 2 + 4):** Meera-equivalent registers a new patient and takes a payment while the clinic's internet drops (a real, evidenced constraint — sharpened-plan-v2 §2) → both actions queue locally (FR-22) → sync automatically once reconnected, no lost record, no double-charge.

**Journey C — Onboarding, day one (all personas):** Dr. Priya invites her one receptionist via FR-04 → sets clinic hours via FR-05 → both are working in the system within, ideally, minutes — this journey is where "fear of training" (survey-analysis-v2 §5) either gets addressed or doesn't, and it's the journey most worth watching closely in the pilot.

---

## 5. Feature Prioritization (Phase 1)

| Priority | Scope |
|---|---|
| **Must Have** | All of FR-01–22. Phase 1 was already cut hard in samstack-ai-v2-sharpened-plan §4 — everything remaining survived that cut specifically because it's essential, not nice-to-have. There is no "Should Have" bucket left inside Phase 1 by design. |
| **Won't Have (this phase)** | Everything in module-registry-v1.2's Fast-Follow and Tracks 2–4 — Pharmacy, Lab, Inventory, Wishlist, Finance Ledger, Speciality Templates, Pre-Check Form, Emergency Queue, Live Tracking, Regulated AI, IPD, international adapter, Dedicated DB/Instance tiers |

No MoSCoW gradient within Phase 1 is a deliberate signal, not an omission — if everything in this list isn't essential, it shouldn't have survived the sharpened-plan-v2 cut in the first place.

---

## 6. Success Metrics & KPIs (Pilot Stage)

| Metric | Target | Why this one |
|---|---|---|
| % of daily patient volume logged in-system vs. still on paper | >80% within 2 weeks per pilot clinic | Direct measure of actual adoption, not just installation |
| WhatsApp delivery success rate | >95% | This is FR-20/21's entire value proposition — if it silently degrades, the product's core promise breaks quietly (TRD §9) |
| Time from staff invite to first completed booking | <30 minutes | Directly tests the "fear of training" objection (survey-analysis-v2 §5) — this is the number that either validates or kills that concern |
| Digital payment (Razorpay) share of total payments | Tracked, no hard target yet — genuinely don't know what's realistic until pilot data exists | Cash will likely dominate early; watch the trend, don't force it |
| Pilot clinics still active at 30/60/90 days | All 3–5 at day 30; retention beyond that is the real signal | Matches sharpened-plan-v2 §4's target directly |
| Qualitative check-in (informal, not a formal NPS survey at this scale) | Every pilot clinic, day 14 and day 45 | Small-n qualitative check catches problems a dashboard won't |

---

## 7. Competitive Positioning (Condensed)

Full detail: samstack-ai-v2-sharpened-plan §2–3. Summary: connected clinical+pharmacy+accounting (nobody else combines all three), Dedicated-Instance option for hospitals (nobody surveyed offers this), and — per the review-mined evidence — actually responsive, locally-reachable support, since unresponsive/wrong-language support was the single most repeated competitor complaint found in research, across every major incumbent checked.

---

## 8. Go-To-Market Summary (Condensed)

Full detail: samstack-ai-v2-sharpened-plan §6. Summary: beachhead in one city/network, founder-led sales to 3–5 design partners, free/discounted pilot in exchange for real feedback and a case study, referral loop through local doctor networks (IMA chapters, informal WhatsApp groups) rather than paid acquisition.

---

## 9. Release Criteria — What "Phase 1 Done" Actually Means

Not just "code shipped." All of the following, before calling Phase 1 complete and starting Phase 2 planning:
- [ ] All FR-01–22 acceptance criteria passing (TRD §8 test strategy)
- [ ] 3–5 pilot clinics onboarded and actively using the system in production
- [ ] The three open hypotheses from sharpened-plan-v2 §9 (segment framing, pharmacy+accounting value, pricing) answered from real pilot behavior, not just survey proxy
- [ ] The MOD-23/24/25 pain-checks (sharpened-plan-v2 §9 items 4–6) run against real pilot clinics, not just the 8 opt-in survey leads
- [ ] No open critical security/compliance gap — audit trail verified working end-to-end, consent capture verified, no unresolved item from FRD §9/§18

**Explicitly not a release criterion:** Phase 2 being planned or spec'd. Per the note at the top of this working session, full Phase 2 detail is deliberately not being built until these criteria are met.

---

## 10. Open Questions Carried Forward

- Which international market for the UAE-style adapter (strategy-v0.5 §3.3) — still open, doesn't block Phase 1
- Rough infra/tooling budget (sharpened-plan-v2 §12 equivalent) — needed before Phase 2 cost planning, not before Phase 1 build
- Whether "Dr. Kavita"-scale practices (Persona 3) need active outreach in this pilot round or should wait for Dedicated-Instance readiness — leaning toward "wait," not yet decided formally
