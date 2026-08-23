<p align="center">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Built_with-Bright_Data-orange.svg" alt="Bright Data" />
  <img src="https://img.shields.io/badge/AI-Gemini-purple.svg" alt="Gemini" />
  <img src="https://img.shields.io/badge/Stack-Next.js_+_Supabase-black.svg" alt="Stack" />
</p>

<h1 align="center">⚡ GridForge</h1>
<p align="center"><strong>Compile physical systems from the live Web.</strong></p>
<p align="center">
  Describe an off-grid energy requirement → collect live component data with Bright Data →
  validate electrical constraints deterministically → render an interactive system topology.
</p>

---

## Why GridForge

Most scraping demos end when JSON appears.

GridForge treats web data as **input to a compiler**. Live panel, inverter, battery, price and availability records become an electrically validated physical-system topology with complete collector/run provenance.

The reliability story has two deliberately different failure modes:

> **When the Web breaks, Bright Data heals the source. When supply changes, GridForge recompiles the system.**

- **DOM drift** → critical-field coverage collapses → Source Guardian marks `DEGRADED` → Bright Data AI self-heals the **same `c_*` collector** → a new scrape must restore coverage before `RECOVERED` is emitted.
- **Real supply change** → scraper/schema remain healthy, but availability changes → `REAL_WORLD_CHANGE` → unavailable inventory is removed → the deterministic compiler searches again.

---

## Current hackathon proof collector

```text
c_mt4wvcs1e2p0phlh1
```

This collector targets the public GridForge demo storefront used for the reproducible DOM-drift and stockout demonstration. Collector IDs are provenance identifiers, not secrets. Bright Data API tokens remain server-side only.

The Scraper Studio implementation is split correctly into:

```text
scraper/gridforge-demo-store.js         # Interaction code
scraper/gridforge-demo-store.parser.js  # Current dual-layout parser (Cheerio)
scraper/gridforge-demo-store.v1-baseline.parser.js # Controlled drift fixture
```

Scraper Studio is **not** a Puppeteer/Node runtime; the interaction file uses Bright Data's `navigate()`, `parse()` and `collect()` functions.

---

## Product flow

```text
Natural-language requirement
          │
          ▼
Gemini parse (language only)
          │
          ▼
Structured requirement
          │
          ▼
Bright Data Scraper Studio (c_*)
          │
          ▼
Flat product records + provenance
          │
          ▼
Normalization / schema validation
          │
          ▼
Deterministic constraint compiler
          │
          ▼
Interactive Single-Line Topology
```

Gemini is never allowed to invent Voc, Vmp, Isc, Imp, Pmax, battery capacity, inverter limits, prices, or availability, and never decides electrical compatibility.

---

## Modes

| Mode | Purpose |
|---|---|
| **Demo Mode** | Instant, clearly labelled deterministic fixtures for judges who want to explore the UX quickly. |
| **Live Mode** | Published Bright Data collector → real collection → normalization → deterministic solver → live topology. Live failures never silently fall back to fixtures. |

The Live result page shows the actual selected topology, collector IDs, scrape-run IDs, component provenance and deterministic constraint evidence.

### Submission-hardening evidence

The production proof path has been exercised without fixture fallback using
collector `c_mt4wvcs1e2p0phlh1` against both storefront layouts. Each layout
returned five products with 100% coverage across every compiler-critical field.
The 6.5 kWh/day requirement compiled to a validated 440 W, 2S×2P baseline.
Changing only inventory values produced `REAL_WORLD_CHANGE` and a new validated
375 W, 3S×2P topology; it did not invoke scraper healing.

A separate controlled run published the V1-only baseline, switched the public
store to V2, and reduced strict critical coverage and verification from 100% to
0%. GridForge invoked Bright Data's real `refactor_template` flow on the same
collector. After the AI repair completed and saved, a new V2 collection returned
five verified products with 100% average and minimum critical coverage and 0%
schema failures, so the strict Guardian emitted `RECOVERED` / `VERIFICATION_PASSED`.

---

## Deterministic engineering checks

For the off-grid hackathon MVP, GridForge evaluates candidates using hard constraints such as:

- cold-temperature corrected panel-string `Voc` below inverter max PV voltage;
- string `Vmp` inside the inverter MPPT operating range;
- parallel-string `Isc` within inverter input-current limit;
- total PV array power within inverter PV-power limit;
- daily generation sizing target;
- battery-bank/inverter voltage compatibility;
- inverter rated AC output ≥ required peak load;
- usable battery storage ≥ requested autonomy;
- total live component cost within budget.

Missing critical scraped specifications do not become guessed defaults. Those components cannot produce a `VALIDATED` live topology.

> GridForge is an engineering/procurement simulation, not a certified installation or wiring plan.

---

## Source Guardian

`/sources` is a real telemetry surface backed by persisted collection runs and health events.

### DOM drift

```text
HEALTHY
  ↓ public store changes HTML
DEGRADED
  ↓ POST /dca/collectors/{c_*}/refactor_template
HEALING
  ↓ repair approval/save when required
VERIFYING
  ↓ rerun SAME c_* collector
RECOVERED (only if coverage is actually restored)
```

### Supply change

```text
HEALTHY SCRAPER
  ↓ availability changes in returned data
REAL_WORLD_CHANGE
  ↓ exclude unavailable component
DETERMINISTIC RECOMPILE
  ↓
NEW VALID TOPOLOGY / honest NO-SOLUTION
```

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                          GridForge                            │
│                                                              │
│  Next.js / Vercel                                            │
│    ├─ UI + live topology canvas                              │
│    └─ server API routes                                      │
│          ├─ Gemini parse/explain                             │
│          ├─ Bright Data trigger/poll/dataset                 │
│          ├─ Source Guardian                                  │
│          └─ deterministic live compiler                      │
│                                                              │
│  Supabase                                                    │
│    ├─ sources + scrape runs + components                     │
│    ├─ health events + compilation runs                       │
│    └─ public demo-store state                                │
│                                                              │
│  Bright Data Scraper Studio                                  │
│    ├─ custom c_* collector                                   │
│    └─ AI refactor_template self-healing                      │
└──────────────────────────────────────────────────────────────┘
```

No persistent Railway worker or Redis service is required for the MVP.

---

## Tech stack

- **Web / server:** Next.js 16 + TypeScript + Vercel
- **Topology UI:** `@xyflow/react` / React Flow
- **Database:** Supabase Postgres
- **Scraping:** Bright Data Scraper Studio
- **AI:** `gemini-3.5-flash-lite` primary, `gemini-3.1-flash-lite` fallback
- **Engineering truth:** deterministic TypeScript constraints
- **Testing:** Vitest + GitHub Actions build verification

---

## Repository structure

```text
GridForge/
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── parse/
│   │   │   ├── compile/
│   │   │   ├── sources/
│   │   │   └── guardian/
│   │   │       ├── assess/
│   │   │       └── heal/
│   │   ├── compile/demo/
│   │   ├── compile/live/
│   │   ├── design/live/[id]/
│   │   └── sources/
│   ├── components/topology/
│   └── lib/
│       ├── catalog.ts
│       ├── gemini.ts
│       ├── live-compiler.ts
│       └── supabase.ts
├── demo-store/
│   ├── app/components/LayoutV1.tsx
│   ├── app/components/LayoutV2.tsx
│   ├── app/api/admin/route.ts
│   └── lib/products.ts
├── backend/
│   └── src/domain/constraints/
├── scraper/
│   ├── gridforge-demo-store.js
│   ├── gridforge-demo-store.parser.js
│   └── gridforge-demo-store.v1-baseline.parser.js
├── .github/workflows/ci.yml
├── SETUP.md
└── LICENSE
```

---

## Quick start

```bash
git clone https://github.com/PrathmeshAdsod/GridForge.git
cd GridForge

cd backend && npm install && npm test && cd ..
cd frontend && npm install && cd ..
cd demo-store && npm install && cd ..
```

Create local ignored environment files using `.env.example`, then run the Supabase migration:

```text
backend/supabase/migrations/001_initial.sql
```

For the exact Bright Data two-editor setup, production environment variables, deployment order and self-healing demo sequence, read **[SETUP.md](./SETUP.md)**.

---

## Recommended judge-demo requirement

```text
Off-grid farmhouse using 6.5 kWh/day, 3 kW peak load, under ₹2.5 lakh in India.
```

The controlled inventory is designed so a real stock-state transition can force the compiler to search a different panel/topology. The demo must always show the **actual solver result** rather than narrating a pre-scripted outcome.

---

## Security / integrity

- `.env*`, `HANDOFF.md`, local deployment scripts/logs and secrets are ignored.
- API tokens and Supabase service-role credentials stay server-side.
- `c_*` Collector IDs may be shown publicly as provenance.
- Live Mode has no silent fixture fallback.
- Demo Mode is visibly labelled.
- Controlled demo-store mutation is authenticated.
- Self-healing proof uses the same collector ID before and after repair.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).

---

<p align="center">
  Built for the <strong>WeMakeDevs × Bright Data “Into the Scrape-Verse”</strong> hackathon.
</p>
