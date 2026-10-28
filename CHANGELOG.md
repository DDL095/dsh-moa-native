# Changelog

## 4.3.4 (2026-10-28)

Follow-up to the first npm release (`dsh-moa-native@4.3.3`): front-page fixes now ship in the published tarball.

- **Live npm badge**: the static `version-4.3.x` badge is replaced by the dynamic `img.shields.io/npm/v/dsh-moa-native` badge; the Chinese README gains the badge row.
- **LICENSE link fix**: `blob/main` → `blob/master` (the repository's default branch is `master`).

## 4.3.3 (2026-10-28)

Repository front-page pass (community aesthetics + awesome-dsh-plugin submission prep).

- **English-first homepage with bilingual switch**: `README.md` is English (community convention, like the awesome list itself), `README.zh.md` carries the full Chinese version; both open with a language-switch line and the shared banner.
- **Banner** (`docs/banner.svg`): refs→guidance→aggregator→reply pipeline strip rendered on the homepage.
- **PNG tile** (`docs/assets/icon-180.png`) for the awesome-dsh-plugin market card.
- README badges (MIT / DSH-Plugin / Node / version) in flat-square style.

## 4.3.2 (2026-10-28)

Repository front page, diagrams, and privacy history pass.

- **Chinese-first README homepage**: `README.md` is now the Chinese front page (GitHub renders it first); English lives in `README.en.md`, with language-switch links on both.
- **Recommended-mode diagram** (`docs/recommended-mode.svg`): one-glance guide to the recommended combo — F mirror + 3-4 heterogeneous blank-injection refs + a single aggregator with the `agg_forrefsblank` parallel-plan discipline. The factory `default` stays Hermes-aligned (review-style refs with the default injection); the recommended combo is the advanced tier.
- `architecture.svg` layout fix (parameter-card overflow in the bottom-right corner).
- Repository history was squashed into a single clean import commit; working-tree and full-history scans confirm zero machine-local traces (usernames, local paths, session ids).

## 4.3.1 (2026-10-28)

Console and documentation calibration.

- **Slash preview block** (console workbench): live display of the actual `/moaR` / `/moaF` combination — lineup, aggregator, and effective cadence of the current edit target — so R/F fitness (small-window refs → R; 1M-window refs → F) can be verified at a glance.
- **Slash semantics calibrated across docs**: a slash overrides **only the reference view** (R trimmed / F full mirror). Lineup, aggregator, and cadence stay with the session's resident entry. Under `user_turn` cadence a slash turn is a guaranteed cache miss — effectively a manual forced fan-out for that turn.
- Gating dropdown tiers widened to 3/5/8/10/15/20/30 with a precise hint: subagents run every step (straight through the aggregator); every N-th step upgrades to a full MoA fan-out, the 1st always does.

## 4.3.0 (2026-10-28)

Subagent gating, pre-run framing, and release-pipeline repair.

### Subagent gating (new)
- MoA now applies to the **main session by default**. Subagent sessions (detected via session header `origin: 'subagent'` / `delegationDepth > 0`) bypass the reference fanout and stream directly through the aggregator's real route — one aggregator call, zero reference cost.
- `subagent_policy` config (also a console dropdown): `"passthrough"` (default) / `{ "every_n": N }` (every N-th intercepted request runs full MoA; the 1st always does) / `"full"` (legacy equal treatment). Purpose calls (compaction/session-title) never consume the counter.

### Pre-run framing (guidance mechanism text)
- The mechanism header now frames references as **your own advance drafts**: each ref ran the same situation before you and produced a draft judgment; you are the sole executor — treat them as your own drafts to verify and surpass. This makes a reference sharing the aggregator's own model largely redundant: dropping the agg-model ref from the lineup saves one route at near-zero quality cost.

### Release pipeline (dev-side)
- `release-export.mjs` v2: retargeted to the v25.1 dynamic-import anchor (bare `@deepseek-ai/dsh-typert-protocol` in the published bundle), strips the private usage-ledger tagging hooks, syncs the dev version into the published package.json, and asserts a matching CHANGELOG section.

## 0.15.0 (2026-10-25)

First public release. Native Mixture-of-Agents for DeepSeek Harness as a config-as-model plugin.

### Core (generation-time fusion)
- Route any session through MoA by selecting the `moa-native` pseudo-provider — reference models are consulted in parallel every turn, their private advisories are injected as a trailing message, and the acting model (aggregator) executes with full tooling.
- Two reference modes: **F** (full mirror — references see exactly what the acting model sees, best KV-cache reuse) and **R** (trimmed view, Hermes-style).
- Cadence control: `user_turn` (once per turn, cache-reused across tool steps with STALE annotation) / `per_iteration` / `every_n`.
- Fail-loud references: a failing route is reported as-is, never silently replaced.

### Config-as-model
- Every configuration is a model entry: `default` plus any number of named recipes appear in the provider page; picking one makes the session run that lineup.
- Three-level model picker identical to the session UI: provider → model → effort.

### Injection modules (v15)
- Per-reference trailing note is a **visible, editable text module** — built-in default (Hermes-style, revised without behavioral prohibitions), blank (zero injection), or any number of user modules.
- No hidden persona, no output-length contract, no cross-turn memory injection — everything explicit.
- Tool-call attempts by reference models are captured and textualized into the advisory (recorded as model preference, never dropped).

### Run traces (v13/v14)
- Four-level drill-down panel: sessions (workspace filter, pin, sort) → turns (`turnInSession`, recipe, status) → per-model cards → full advisory text.
- Cold-start backfill from the last 3 days of zstd archives; cumulative turn counter; per-route stats and optional cost estimation via a `prices` config table.
- Workspace isolation: `?ws=` server-side filter; members only see their own workspace.

### Storage
- Daily zstd archives at `~/.dsh/moa-native-traces/trace-YYYYMMDD.jsonl.zstd` (atomic single-frame rewrite). Inputs are never persisted — outputs and metrics only.
