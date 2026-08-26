# Tooling Setup — ponytail

Verified against the live repo README (github.com/DietrichGebert/ponytail) on 25 Aug 2026, not approximated.

## Claude Code
Two separate prompts, sent in order (won't work combined into one):
```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
Requires `node` on PATH — it runs two small lifecycle hooks. If `node` isn't found, the skills still work; always-on activation just won't fire automatically.

**Uninstall:** `/plugin remove ponytail`, then (before that, if you want config cleaned up too) `node scripts/uninstall.js` from a clone of the ponytail repo.

## OpenCode
Add to your project's `opencode.json`:
```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```
OpenCode also auto-loads `AGENTS.md` from the project root, so the ruleset's *instructions* hold even before the plugin is added — the plugin itself is what adds the `/ponytail` command set and the `lite/full/ultra/off` mode switch on top of that.

## Either host
| Command | What it does |
|---|---|
| `/ponytail [lite\|full\|ultra\|off]` | Set intensity, or report current level with no argument |
| `/ponytail-review` | Review the current diff for over-engineering, hands back a delete-list |
| `/ponytail-audit` | Same, but the whole repo, not just the diff |
| `/ponytail-help` | Quick command reference |

Default mode is `full`. Set a different default via the `PONYTAIL_DEFAULT_MODE` env var (`lite`/`full`/`ultra`/`off`) or `~/.config/ponytail/config.json`.

**What it actually changes:** before writing code, the agent stops at the first rung that holds — does this need to exist → already in the codebase → stdlib → native platform feature → installed dependency → one line → only then, the minimum that works. Never skips validation, error handling, security, or accessibility to get there — that's the "lazy, not negligent" line the maintainer draws explicitly.
