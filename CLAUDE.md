# SAMSTACK AI — Claude Code Notes

Full project context lives in `AGENTS.md` — read that first. This file only adds what's specific to Claude Code as a host; it isn't a second copy of the project brief.

## ponytail
See `TOOLING-SETUP.md` for the exact install. Default mode is `full`. Run `/ponytail-review` before marking any FR-XX done — it flags over-building in the diff, which matters a lot with 22 requirements to get through at a consistent lean standard.

## Skills
Check `.claude/skills/new-fr/SKILL.md` (copy of `new-fr-skill.md`) before starting any new FR — it's the repeatable build sequence, not something to redesign per requirement.

## When something in the FRD is ambiguous
Don't guess and don't silently narrow scope — the FRD's §18 Validation Checklist and §9 Contradictions sections exist precisely because ambiguity got resolved explicitly there. Check those two sections first; if the ambiguity is genuinely new, flag it rather than picking a default.
