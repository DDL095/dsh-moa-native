# dsh-moa-native

[中文](README.md) · **English**

Native Mixture-of-Agents for DeepSeek Harness — **generation-time fusion**: reference models advise in parallel every turn; the acting model executes with their guidance.

## What it solves

A single model has blind spots. In long sessions you want a few models reviewing the situation behind every reply — without switching tools, copy-pasting, or giving up tool use. dsh-moa-native internalizes that loop: **picking one model entry runs the whole MoA pipeline for the session**.

```
user message ──► refs consulted in parallel (private advisories, mutually unaware)
                      │
                      ▼
               guidance injected as a trailing message (never pollutes session history,
               never breaks KV prefix caching)
                      │
                      ▼
               aggregator (acting model) executes with full tooling ──► reply
```

## Install

```bash
dsh plugin --profile web add dsh-moa-native
```

Restart the instance and refresh the browser.

## Quick start

1. Settings → **MoA-Native console**: pick 3-4 reference routes (flash tiers work well — fast and cheap) and one aggregator (the model you want to keep). **This step is mandatory on first install** — the factory lineup is only an example and must point at your own configured providers/models. Since references are framed as the aggregator's own pre-run drafts, you can skip a ref that shares the aggregator's model (saves one route).
2. Save (hot-reloads), then select a **moa-native** entry in the session model picker — `default` or any recipe you saved.
3. Chat normally. Fusion happens every turn; `/moaR` `/moaF` temporarily switch the **reference view** (R trimmed / F full mirror — lineup, aggregator, and cadence stay with the current entry; under `user_turn` cadence a slash turn acts as a manual forced fan-out. The console's *slash preview* shows the actual combination live). Subagent sessions stream straight through the aggregator by default (zero fanout) — switch via the console's *subagent gating* dropdown (7 tiers: 3/5/8/10/15/20/30).

## Highlights

**Config as model** — `default` and every recipe appear as model entries on the provider page; a recipe is a full preset (lineup, mode, cadence, params).

**Three-level model picker** (identical to the session UI) — provider → model → effort for every route, over all your configured providers.

**Injection modules** (v15) — each route's trailing note is a **visible, editable** text module: built-in default (Hermes-style, revised without behavioral prohibitions), blank (zero injection), or any number of custom ones (one-line persona to a whole domain document). No hidden personas, no output-length contracts — everything explicit.

**Two reference modes**:
- **F · full mirror** — references see exactly what the acting model sees (system prompt and tool surface included); trailing injection keeps KV prefix cache hit rates above 90%
- **R · trimmed view** — Hermes-style tool-result trimming with input budgets

**Run traces** (v13/v14) — four-level drill-down: sessions (workspace filter / pin / sort) → turns (`turnInSession`) → per-model cards → full advisory text. Cold-start backfill from archives; cumulative counter; per-route stats; optional cost estimation via a `prices` table.

**Workspace isolation** — traces filter by workspace server-side; members never see each other's records.

**Storage discipline** — daily zstd archives (`~/.dsh/moa-native-traces/`, atomic writes). **Inputs are never persisted** — outputs and metrics only.

**Fail-loud** — a failing reference route is reported as-is, never silently replaced; tool-call attempts by references are textualized into the advisory (recorded as model preference, never dropped).

## Configuration

`~/.dsh/profiles/web/moa-native.config.json` (panel saves hot-reload):

```jsonc
{
  "refs": [                                        // direct lineup; or use named recipes
    "provider-a/model-flash@high",                 // string = default injection
    { "model": "provider-b/model-x@max", "injection": "critic" } // object = named module
  ],
  "aggregator": "provider-c/main-model@max",
  "mode": "F",                                     // F mirror | R trimmed | omit = per-recipe
  "cadence": "user_turn",                          // user_turn | per_iteration | {every_n: 2}
  "injections": {                                  // custom injection modules
    "critic": "Your first duty is to scrutinize errors, risks and omissions..."
  },
  "recipes": { "my-lineup": { "refs": ["..."], "aggregator": "...", "mode": "F" } },
  "prices": { "provider-a/model-flash": { "in": 0.2, "out": 0.8 } }, // optional $/Mtok
  "trace": true
}
```

## HTTP endpoints

| Endpoint | Purpose |
|---|---|
| `GET /moa-native/panel.json` | config + model catalog |
| `GET /moa-native/trace.json?limit=&ws=` | run traces (workspace gate, session grouping, stats) |
| `GET /moa-native/trace-archive.json?date=YYYYMMDD` | daily archive (zstd) |
| `GET /moa-native/efforts.json?provider=&model=` | lazy effort-tier lookup |

## Design boundaries

- Guidance is **request-scoped**: it never enters session history — not seeing reference text in the session UI is expected (check the trace panel).
- References are advisors only: no tool execution; the acting model decides what to adopt.
- Complementary to "proposals-then-judge" MoA variants: this plugin targets **continuous per-turn quality**, not one-shot artifact selection.

## License

MIT
