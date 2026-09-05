# SAMSTACK AI — Discovery Survey Analysis (v2, n=24)

**Supersedes:** survey-analysis-v1 (n=16). **Source:** clean HTML table extraction (Google Sheets fetch) — more reliable than the rasterized-PDF visual read used for v1, so this version corrects it where they differ. **Status:** still growing — re-run again as more responses land.

---

## 1. Corrections to the Original 16 (Flagging These, Not Burying Them)

The PDF's scrambled text layer forced a visual read last time. Careful as that was, this cleaner extraction caught two real errors and revealed fuller text on two truncated answers:

| Respondent | What changed | Was → Now |
|---|---|---|
| Solo Pediatrics, 16/08 21:40 | Location | Tier 2 city → **Tier 3 city/town** |
| Solo Ayurveda, 18/08 20:10 | Pharmacy attached | Yes → **No** |
| Solo Ayurveda, 16/08 21:54 | q8 pain point meaning | Full text: *"Case taking is time taking but essential too, **so not frustrating**"* — this respondent explicitly said it's **not** a frustration. v1 miscounted this as a software-addressable pain point from truncated text ("...so not...") — it should be removed from that list. |
| Hospital (15+), 16/08 20:27 | q6c full text | Now complete: *"Bad hospitality, poor hygiene, no rest room separate without security"* |
| Solo Pediatrics, 18/08 21:24 | q6c full text | Now complete — see §5, genuinely more informative than the truncated version |

Net effect on the headline pharmacy-attached number: 69% → drops to 62% once corrected (still consistent with n=24 below).

---

## 2. Updated Core Numbers (n=24)

| Question | Top answers |
|---|---|
| Practice size | Solo 67% · 2–5 doctors 17% · 15+/hospital 8% · 6–15 doctors 8% |
| Specialty | **Dental 25%** · Other 21% · General/Family 17% · Ayurveda/AYUSH 17% |
| Location | Tier 2 42% · Tier 3 33% · Metro 12% · Rural 12% |
| Pharmacy attached | Yes 62% |
| Current tool | Paper register 54% · Dedicated software 25% · WhatsApp only 12% |
| ABDM awareness | Registered 54% · Aware, not registered 29% · No 17% (83% combined awareness) |
| WhatsApp use with patients | Regularly 29% · Sometimes 54% (83% combined) |
| Call opt-in | **33%, up from 25%** |

## 3. The Practice-Size Story Is Moving — Watch This, Don't Conclude Yet

v1 flagged 81% solo as a possible channel-bias artifact. The 8 new responses skew very differently:

| | Solo | 2–5 doctors | 6–15 | 15+/hospital |
|---|---|---|---|---|
| Original 16 | 81% | 6% | 6% | 6% |
| New 8 | 37.5% | 37.5% | 12.5% | 12.5% |

Combined: 67% solo. That's a real move in one batch — leans toward "channel bias" being at least part of the original explanation, not "the market is just mostly solo." Not enough to declare the 2–15-doctor wedge vindicated off 8 responses, but enough to stop treating 81%-solo as settled. Keep watching as more data arrives.

## 4. New Finding: "Unwanted Appointments" — Independently Named Twice

Two respondents in the new batch, independently: *"Patient Management, Unwanted Appointments"* (15+ hospital, Dental) and *"Unwanted appointments"* (Solo, General Medicine, using a paid tool called "Buzy" they call *"too much old to use"*). Not in the original 16 at all. This is new, real signal for **MOD-23 (Pre-Check Form)** — a short pre-visit intake would let a clinic see why someone's booking before confirming the slot, directly addressing "unwanted" bookings. MOD-23 was already the top-priority Fast-Follow item (module-registry-v1.2) — this reinforces that ranking, doesn't change it.

## 5. New Finding: "Fear of Training," Not Just Price

One respondent's reason for not buying software they considered: *"Price, fear of training"* (2–5 doctor practice). Separately, the Pediatrics respondent's now-complete answer is worth reading in full: *"Online software is little slow and yet developing, AI interference by developers ci fronts professionalism of Doctors, Axon is superb."* Read together: the objection isn't only sticker price, it's the perceived time/effort cost of onboarding staff, and a live worry about AI features feeling like they undermine the doctor's own professional judgment. Two concrete implications: (1) onboarding needs to be visibly fast in the pitch itself, not just fast in reality; (2) any Bucket A AI feature (MOD-18) should stay clearly assistive, never positioned as replacing the doctor's judgment — worth keeping in mind when that phase's FRD gets written.

## 6. Worth Watching, Not Acting On Yet: The Dental Cluster

6 of 24 (25%) are Dental, 4 of those 6 from the new batch alone. Two explanations, can't tell which from this data: a dental-specific channel reached this batch (sampling artifact), or dental practices genuinely have an acute version of this problem. Notable because the earlier competitive research found **Cliniify built real traction (2,200+ clinics) by going dental-only** — if this cluster holds up as more data comes in, a dental-vertical angle is worth a real conversation, not something to decide from a coincidence. Flagging, not recommending.

## 7. Leads: 8 Now, Doubled

| Name | Phone | Context |
|---|---|---|
| Dr Deepti Nath | 7869990508 | Solo, unspecified specialty |
| "Call" | 9575311004 | Solo Ayurveda, rural, price-sensitive |
| Dr Ghanshyam Yadav | 7000909957 | Solo Ayurveda, rural, follow-up is their top pain point |
| Ashok Mehta | 9425227454 | Solo Pediatrics, on Axon/TatvaCare, compliance concern |
| Dr. Shubham Lal | 9907418181 | 15+/hospital, Dental, over-pricing + renewal complaint, "unwanted appointments" |
| Chandrahas Thakur | 9981474048 | Solo Dental, pricing-conversation fatigue with patients |
| Dr. S.P. Chandravanshi | 8889972324 | 6–15 doctors, Multi-specialty, payment issue |
| Dr. Ritu Singh | 9165733393 | 2–5 doctors, Dental, rural, pricing objection |

Genuinely worth prioritizing the Dental leads (4 of 8) and the two multi-doctor/hospital leads (Shubham Lal, S.P. Chandravanshi) given §3 and §6 above — they're the two open questions this data can't resolve alone.

## 8. Also Noted, Not Investigated
A new competitor name surfaced: **"Buzy"** (paid tool, one respondent calls it "too much old to use"). Not researched yet — flagging for whenever competitive tracking gets revisited.

## 9. What This Changes Going Forward
- No FRD changes — Phase 1 scope (frd-phase1-v1) already serves Dental/multi-doctor practices fine; specialty templates and multi-doctor nuances are already correctly placed in Fast-Follow (MOD-12) and don't block Phase 1.
- Call script (sharpened-plan-v2 §9): worth adding one open question about the "unwanted appointments" pattern and the training-fear objection when talking to these 8 — not yet written in, since it's not yet clear it's more than two data points.
- Keep re-running this analysis. The practice-size mix moved meaningfully in one batch of 8 — it can move again.
