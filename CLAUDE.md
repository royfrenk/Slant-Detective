# Claude Code Project Guide — Slant Detective

> Start here when working on this project.

---

## Quick Start

1. **Read the project state first:** `docs/PROJECT_STATE.md`
   - File structure, database schema, API endpoints
   - Tech stack, infrastructure, recent changes

2. **Check roadmap:** `docs/roadmap.md`
   - Current sprint tasks
   - Fallback when Linear unavailable

3. **Original design notes:** `docs/!project/slant-detective-PRD.md` (product spec, rubric methodology, architecture). Visual design system: `docs/!project/DESIGN.md`.

---

## Project Overview

Slant Detective is a Chrome extension (Manifest V3) for per-article media-bias analysis. Sibling product to Recap Rabbit. **Not-for-profit, AGPL-3.0: no backend, no operator LLM bill, no data collection.**

- One article at a time — no clustering, no aggregator, no newsletter.
- Layer 1: in-browser signals (BABE lexicon, reporting-verb ladder, hedge counter, headline↔body drift) — runs with zero network.
- Layer 2: full Claude Haiku rubric — only when the user has configured their own Anthropic API key.
- Two experience tiers, **derived automatically from API-key presence** (no mode selector).

See `docs/!project/slant-detective-PRD.md` for the full design document.

---

## Running the Project

> **Status:** Pre-implementation. No code yet. Update this section once Week 1 skeleton (MV3 manifest + side panel shell) lands.

### Extension (planned)
```bash
cd extension
npm install
npm run dev     # Vite dev build
npm run build   # Production bundle for CWS
# Load unpacked: chrome://extensions → Load unpacked → extension/dist
```

### Tests (planned)
```bash
# Extension: vitest + Playwright for E2E
# BABE eval harness: node eval/run.js (not shipped with extension)
```

> **No backend.** There is no server component — killed on 2026-04-18 when the project committed to not-for-profit.

---

## Working with the Workflow

Use `/sprint` for autonomous execution. It handles orchestration directly in the main conversation.

### Workflow
```
USER (request/issue)
    ↓
/sprint — runs the workflow entrypoint inline
    ↓
EXPLORATION — analyzes → creates docs/technical-specs/{ISSUE_ID}.md
    ↓
PLANNING — plans → updates docs/technical-specs/{ISSUE_ID}.md
    ↓
USER (approves plan) ← CHECKPOINT
    ↓
IMPLEMENTATION — reads spec file and makes changes
    ↓
REVIEW — validates before deploy
```

### Key Commands
- **`/sprint`**: Autonomous execution — runs the workflow entrypoint
- **`/iterate`**: Continue fixing bugs after testing on staging

---

## Linear Integration

linear_enabled: false

> **Action required:** Decide whether Slant Detective uses Linear.
> - If yes: create a team (suggested prefix `SD`), get status UUIDs, and fill in the table below. Flip `linear_enabled` to `true`.
> - If no: leave as-is; all task tracking will use `docs/roadmap.md` only.

| Setting | Value |
|---------|-------|
| Issue Prefix | `SD` (proposed) |
| Team | Slant Detective (proposed) |
| Team ID | `<team-uuid>` |
| Technical Specs | `docs/technical-specs/SD-##.md` |

### Status UUIDs (for `mcp_linear_update_issue`)

| Status | UUID |
|--------|------|
| Backlog | `<uuid>` |
| Todo | `<uuid>` |
| In Progress | `<uuid>` |
| In Review | `<uuid>` |
| Done | `<uuid>` |
| Canceled | `<uuid>` |

> **To get UUIDs:** `curl -X POST https://api.linear.app/graphql -H "Authorization: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"query": "{ team(id: \"TEAM_ID\") { states { nodes { id name } } } }"}'`

### Labels

| Label | Purpose |
|-------|---------|
| agent | Applied to ALL issues created by Claude (not human-created) |
| technical | Applied to backend/infra/tech-debt issues Claude inferred or initiated |

Until Linear is enabled, `docs/roadmap.md` is the source of truth.

---

## MCP Configuration

Disable unused MCPs to save context. Project-level settings in `.claude/settings.json`:

```json
{
  "disabledMcpServers": ["slack", "notion", "jira"]
}
```

---

## Deployment

> **Status:** Not yet set up. Fill in once the extension has a staging build and backend has a staging environment.

| Environment | Branch | URL |
|-------------|--------|-----|
| Staging | `develop` | `<staging-url>` |
| Production | `main` | `<production-url>` |

**Git workflow:** `sprint/*` → `develop` → `main`

**Who can push:**
- `develop`: Developer (after Reviewer approval)
- `main`: User only

**Sprint closure rule (ENFORCED):** A sprint file MUST NOT be renamed from `.active.md` to `.done.md` until the sprint branch has been merged into `develop` and pushed. Merge first, rename second. Closing the sprint file before merging leaves `develop` missing all sprint work.

---

## Before You Commit

Checklist:
- [ ] Tests pass
- [ ] No unintended file changes
- [ ] Commit message describes the "why"
- [ ] No secrets, API keys, or user identifiers in code
- [ ] `rubric_version` bumped if prompt changed
