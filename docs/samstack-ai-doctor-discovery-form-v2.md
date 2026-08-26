# Doctor Discovery Form — v2 (Optimized for Speed)

**Supersedes:** samstack-ai-doctor-discovery-form.md's question set (channels/methodology from that doc still apply). **Target time: under 90 seconds.** Same info density as before, delivered mostly through grid/select questions instead of open text — open text is where all the lost time goes.

---

## The Framing (real, not fabricated)

**Form title:** *"Quick survey: why does clinic software adoption stay so low in India?"*

**Intro line:** *"Independent research — under 15% of small Indian clinics use any clinic-management software (NASSCOM, 2025). We're trying to understand why. 90 seconds, nothing to buy, no sales call unless you opt in at the end."*

This is true, specific, and gives respondents a real reason to care — which also makes them answer more honestly than a vague "operations research" framing would.

---

## The Form

**Section 1 — Fast facts** *(3 taps, ~15 sec)*
1. Practice type: *Solo / 2–5 doctors / 6–15 doctors / 15+ or hospital*
2. Pharmacy attached? *Yes / No*
3. Current system: *Paper / Excel or Sheets / WhatsApp only / Named software / Combination of these*

**Section 2 — One grid, six data points** *(~30–45 sec — this replaces three separate open questions from v1)*
*"How much of a problem is each of these day-to-day?"* — grid, one tap per row: **Not a problem / Minor annoyance / Major problem**
- Tracking patient follow-ups
- No-shows / last-minute cancellations
- Billing & payment collection
- Medicine/consumable stock management
- Pharmacy billing *(skip via branching if Q2 = No)*
- Keeping treatment history/records organized

This single grid is the highest-value addition — it ranks every pain point the product actually targets, without ever naming the product, in about the time one typed sentence takes.

**Section 3 — Real behavior, not hypotheticals** *(~20 sec)*
4. Ever paid for or seriously looked into clinic software? *Currently paying / Tried & stopped / Looked, didn't buy / Never considered*
5. *(Branch: only if "Currently paying" or "Tried & stopped")* Roughly how much per month? *<₹2K / ₹2–8K / ₹8–20K / ₹20K+ / It was free*

**Section 4 — One more behavior signal** *(~10 sec)*
6. How do reminders/follow-ups currently get handled? *I call personally / Staff calls or WhatsApps / SMS / Software does it automatically / Doesn't happen*

**Section 5 — The actual point of the form** *(~10 sec)*
7. Open to a 10–15 min call about how your practice runs? *Yes, here's my contact: ___ / No thanks*
8. *(Optional, not required — so it costs nothing for people who skip it)* Anything else about running the practice you'd fix if you could? *[open text]*

---

## Google Forms Build Notes

- **Q2's grid** → use Forms' built-in "Multiple choice grid" question type, not six separate questions — this is what keeps the time down while keeping the data.
- **Section branching** → use "Go to section based on answer": Q2 = No skips the pharmacy-billing grid row's relevance (leave the row, just don't over-weight it in analysis); Q4 = "Never considered"/"Looked, didn't buy" skips Q5 entirely via section jump.
- **Only Q7's contact field and Q8 are open text** — everything else is tap-to-answer, which is both faster and produces cleaner, directly-comparable data across respondents than free text would.
- Keep Q8 genuinely optional (not "required") — a mandatory open question is the single biggest thing that makes people abandon a form partway through.

## What Each Section Buys You

- **Section 1:** segment-fits-target-wedge check (2–15 doctors, pharmacy attached) — same as before, just faster
- **Section 2:** a ranked pain-point signal across every area the product touches, in one interaction — this is the new leverage
- **Section 3:** real pricing/competitor intel from behavior, not opinion
- **Section 4:** direct signal on the specific pain the WhatsApp-automation feature targets, without ever mentioning WhatsApp automation
- **Section 5:** the funnel into the real validation — the 10–15 min calls are still where the decision-grade insight comes from, same as the original sharpened plan's §9
