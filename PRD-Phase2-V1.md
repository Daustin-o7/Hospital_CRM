# SAMSTACK AI — Product Requirements Document (PRD)
## Phase 2 — Track 1 Fast-Follow

---

## 1. Document Information

| Field | Value |
|---|---|
| Title | SAMSTACK AI — PRD, Phase 2 |
| Version | 1.0 |
| Date | 27 August 2026 |
| Extends | samstack-ai-prd-phase1-v1.md — same personas, not replaced |
| Companion to | samstack-ai-frd-phase2-FINAL.md, samstack-ai-trd-phase2-v1.md |

---

## 2. Product Vision Extension

Phase 1 proved (per its own release criteria) that the core connected system works for a real pilot. Phase 2 is where the product starts answering the *specific* frustrations named in real data rather than the general ones — "unwanted appointments," specialty-specific documentation friction, stock visibility — each module below traces to a named finding, not an assumed roadmap.

---

## 3. Personas — Reused, Not Reinvented

Same four personas as PRD_Phase1 §3 (Dr. Priya, Dr. Arjun, Dr. Kavita, Meera). Phase 2's job is connecting modules to *their* specific pain points:

| Persona | Phase 2 module that answers their named pain |
|---|---|
| Dr. Arjun (growing Dental practice) | MOD-23 — his own words were "unwanted appointments"; MOD-12's Dental template ships first because his specialty is 25% of respondents |
| Dr. Priya (solo AYUSH) | MOD-12's Ayurveda template (17% of respondents); MOD-13 eventually generalizes the follow-up reminder she already named as her top pain in Phase 1 |
| Meera (receptionist) | MOD-24/25 reduce the manual "who's actually next" chaos during a busy walk-in morning — a front-desk problem, not a doctor problem, which is exactly why Persona 4 exists separately in PRD_Phase1 |
| Dr. Kavita (larger practice/hospital) | MOD-14 exists for her tier specifically — but she remains out of active pilot scope until Tier 2 tenancy activates, same note as PRD_Phase1 §3 |

---

## 4. User Journeys (Phase 2 Additions)

**Journey D — Dr. Arjun's "unwanted appointment" problem, resolved:** Patient books → MOD-23's pre-check link goes out with the confirmation → patient explains why they're coming → Dr. Arjun (or Meera) sees the pre-check before the visit and can flag/redirect a clear mismatch *before* the slot is wasted — the actual mechanism behind fixing the pain he named.

**Journey E — Meera's chaotic Monday morning:** A walk-in with a clearly urgent issue arrives → Meera flags it (FR-24-01) → the queue re-sorts → waiting patients checking MOD-25's live status page see their position update automatically, instead of asking her directly why the wait suddenly changed — this is the "how do other patients find out" question from the original MOD-24 pain-check, now answered structurally instead of by Meera explaining it verbally, repeatedly.

**Journey F — Dr. Priya's specialty template:** Opens a consult, Ayurveda template pre-fills the structure she already writes by hand every time, edits per patient, saves faster than starting blank — directly targets her Phase 1-named pain (case documentation taking real time), without touching the "not frustrating, just time-consuming" nuance survey-analysis-v2 corrected (§1 of that document) — the fix is speed, not implying she was complaining.

---

## 5. Feature Prioritization (MoSCoW — Now Possible With Real Evidence)

Phase 1 had no MoSCoW gradient by design (PRD_Phase1 §5 — everything survived the cut because everything was essential). Phase 2 has 9 modules with genuinely different evidence strength, so gradation is honest here in a way it wasn't for Phase 1:

| Priority | Modules | Why |
|---|---|---|
| **Must Have** | MOD-23 | Doubly validated — "unwanted appointments" named independently by two separate respondents (survey-analysis-v2 §4), not inferred |
| **Should Have** | MOD-24 + MOD-25, MOD-12 | Real named pains, but lower frequency (MOD-24/25) or informed-but-not-directly-requested (MOD-12's exact template ordering is data-driven, but no respondent asked for "templates" by name) |
| **Could Have** | MOD-09, MOD-08, MOD-13 | Genuinely useful, no strong evidence of urgency yet — outline's own "validate first" questions for MOD-09/MOD-08 haven't been answered by real pilot use |
| **Won't Have (this round)** | MOD-10, MOD-11, MOD-14 | MOD-10: lowest evidenced urgency, cheapest to defer. MOD-11: higher risk (accounting correctness) needs accountant input not yet gathered. MOD-14: gated by a business milestone (Tier 2 activation), not a demand question at all |

---

## 6. Success Metrics (Phase 2 Additions)

| Metric | Target | Why |
|---|---|---|
| % of appointments with a pre-check submission completed (MOD-23) | Track from day 1, no target set yet — first real data point | Directly tests whether patients actually engage with the tokenized link pattern outside the discovery-survey context it was proven in |
| Emergency-flag frequency in real pilot data (MOD-24) | Track, unblocks the outline's explicit open question | Answers "how often does this actually happen in general OPD" — this number, once real, should feed back into re-validating MOD-24's priority |
| Specialty template adoption rate by specialty (MOD-12) | Track per-specialty | Confirms or corrects the Dental/General/Ayurveda ordering decision |

## 7. Release Criteria — Phase 2 → Phase 3 (Voice Agent)

Mirroring PRD_Phase1 §9's discipline, not loosening it for Phase 2:
- [ ] Must Have and Should Have modules (MOD-23, MOD-24/25, MOD-12) live with pilot clinics, real usage data collected
- [ ] MOD-24's "how often does this happen" question answered from real data, not assumption
- [ ] Phase 1's WhatsApp-only reminder performance (from Phase 1's own release criteria) compared against whatever MOD-13 improves it to, *before* deciding Voice Agent (Phase 3) is worth its regulatory and engineering cost
- [ ] Explicitly **not** a criterion: Could-Have or Won't-Have modules being built — Phase 3 planning can start once Must/Should Have prove out, it doesn't need to wait for all 9

## 8. Open Questions Carried Forward
- MOD-11's export format — needs a real accountant conversation, not another doctor interview
- MOD-09's three-tier stock framing — needs direct pilot-clinic validation
- Whether MOD-14's Tier 2 tenancy milestone is even on the near-term roadmap, or whether Phase 2 pilots will stay single-tenant for a while yet — not decided, doesn't block anything above it
