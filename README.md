# SAMSTACK AI — Final Implementation Package

Everything needed to start Phase 1 tonight. Files at the top level are meant to land directly in your repo root — unzip straight into it and `.claude/` / `.opencode/` skills are already at the right paths for both tools.

## Start here, in order
1. **`samstack-ai-frd-phase1-FINAL.md`** — the spec. Every requirement (FR-01–22) work happens against this.
2. **`AGENTS.md`** — project context, auto-loaded by OpenCode (and several other tools).
3. **`CLAUDE.md`** — Claude Code's entry point, points back to AGENTS.md, no duplicate content.
4. **`TOOLING-SETUP.md`** — install ponytail here, exact commands for whichever tool you land on.
5. **`samstack-implementation-reference.md`** — Razorpay/WhatsApp/JWT/offline-sync specifics, tied directly to FRD sections.
6. **`.claude/skills/new-fr/SKILL.md`** and **`.opencode/skills/new-fr/SKILL.md`** — same content, already placed for both tools. Use this sequence for every FR-XX.

## `docs/` — planning and evidence trail
Not needed to write code tonight, but this is where the "why" lives if a decision in the FRD needs tracing back:
- `samstack-ai-strategy-v0.5.md` — long-term architecture and vision (Phase 1 is one slice of this)
- `samstack-ai-v2-sharpened-plan.md` — the sharpened wedge, True V1 scope, honest re-validation (§8's scorecard, §9's open items)
- `samstack-ai-module-registry-v1.2.md` — every module across all 4 tracks, not just Phase 1
- `samstack-ai-auth-and-ia-v0.1.md` — role/auth detail (page/model counts reflect the *original* Phase 1 scope before the sharpened plan narrowed it — the FRD is the current source of truth on exact scope, this doc is for the auth/role design reasoning)
- `samstack-ai-survey-analysis-v2.md` — 24 real responses, the evidence behind this scope
- `samstack-ai-doctor-discovery-form-v2.md` — the discovery methodology, useful if you run more rounds
- `clinic-operations-study.html` — the actual survey tool, still live

## Left out on purpose
Superseded by what's included above — not deleted, just excluded here since including both versions would add confusion, not value, on implementation night:
- Original idea-validation-report — scores superseded by sharpened-plan-v2 §8's re-score
- survey-analysis-**v1** (n=16) — superseded by v2's n=24 plus two corrections
- doctor-discovery-form **v1** — superseded by v2
- An early stray strategy draft — superseded by v0.5

Say the word if you want the full archive alongside this instead of just the current versions.
