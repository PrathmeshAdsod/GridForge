# GridForge

**Compile physical systems from the live Web.**

GridForge turns live component inventory into electrically validated system designs. The hackathon implementation focuses on off-grid solar, where panels, inverters and batteries must satisfy real electrical constraints before they can become part of a system.

[Live application](https://gridforge-app.vercel.app/) | [Video Demo](https://youtu.be/B1N7L4Nb6Mo) | [Source integrity](https://gridforge-app.vercel.app/sources) | [Public demo store](https://gridforge-demo-store.vercel.app/) | [GitHub Actions](https://github.com/PrathmeshAdsod/GridForge/actions)

Built for the WeMakeDevs and Bright Data **Into the Scrape-Verse** hackathon.


## The problem

Designing a physical system from web inventory is harder than finding products.

A component can be available today and gone tomorrow. The page that exposes its specifications can change structure. Different listings use different labels for the same electrical field. Even when the data is collected correctly, the components still need to work together as a system.

Most scraping workflows stop after extraction. GridForge continues from structured web data to a constrained engineering decision.

For the off-grid solar MVP, that means answering questions such as:

- Which currently available panel, inverter and battery combination can satisfy the requested load?
- Does the PV string stay inside the inverter voltage and MPPT limits?
- Is the array current safe for the selected inverter?
- Does the battery bank match the inverter voltage and requested storage?
- Does the selected system stay inside the user's budget?
- Did the source page break, or did the real market state actually change?

GridForge treats those as separate problems and keeps the evidence visible.

## What GridForge does

A user describes an off-grid requirement in plain language, for example:

```text
Off-grid farmhouse using 6.5 kWh/day, 3 kW peak load, under ₹2.5 lakh in India.
```

GridForge then:

1. Parses the requirement into structured constraints.
2. Triggers a published Bright Data Scraper Studio collector.
3. Normalizes the returned panel, inverter and battery records.
4. Rejects components that are missing compiler-critical specifications.
5. Searches possible electrical combinations with a deterministic constraint engine.
6. Selects a valid topology and renders it as an interactive Single-Line Diagram.
7. Keeps collector ID, scrape-run ID, price, availability and source provenance attached to the selected components.
8. Monitors source quality so DOM drift is not confused with a real stock change.

The current implementation starts with off-grid solar. The underlying architecture is organized around components, constraints, sources and topology so the same approach can be extended to other constrained physical systems later.

## Try the working live path

Open [gridforge-app.vercel.app](https://gridforge-app.vercel.app/) and use:

```text
Off-grid farmhouse using 6.5 kWh/day, 3 kW peak load, under ₹2.5 lakh in India.
```

Choose **Compile live**.

The verified hackathon run uses Bright Data collector:

```text
c_mt4wvcs1e2p0phlh1
```

The current proof collector targets the public GridForge demo storefront at [gridforge-demo-store.vercel.app](https://gridforge-demo-store.vercel.app/). The store exists so DOM changes and stock changes can be reproduced during judging without relying on a third-party site changing at the right moment. It is a controlled public web source, not a commercial retailer.

Collector IDs are provenance identifiers and are safe to display. Bright Data API credentials remain server-side.

## Why Bright Data is central

Bright Data is not a decorative integration in GridForge. The live compiler depends on the structured records returned by Scraper Studio.

The production path is:

```text
Public web page
    -> Bright Data Scraper Studio collector
    -> collection result
    -> normalization and field verification
    -> deterministic electrical compiler
    -> topology with source provenance
```

The Scraper Studio implementation is split into the two parts expected by the product:

```text
scraper/gridforge-demo-store.js
scraper/gridforge-demo-store.parser.js
```

The interaction code uses Bright Data's `navigate()`, `parse()` and `collect()` workflow. The parser extracts a flat record for each product so the backend can verify critical fields before the component reaches the solver.

Live Mode calls the Bright Data trigger, poll and dataset flow from server-side Next.js routes. It never substitutes fixture data when the live collection fails.

## Two kinds of change

A core design decision in GridForge is that a broken source and a changed market are not the same event.

### 1. The website changes

A layout change can remove the selectors that previously exposed fields such as `Voc`, `Vmp`, `Isc` and `Pmax`.

GridForge records field coverage for each collection. If the page still returns products but compiler-critical coverage collapses, Source Guardian classifies the source as `DEGRADED`.

The recovery path is:

```text
HEALTHY
  -> critical field coverage drops
DEGRADED
  -> Bright Data self-healing starts on the same collector
HEALING
  -> repaired collector is saved when approval is required
VERIFYING
  -> the same c_* collector runs again
RECOVERED
  -> emitted only after critical coverage is restored
```

The collector ID does not change during this flow.

For the verified hackathon run, the controlled V2 layout reduced strict compiler-critical coverage from **100% to 0%**. GridForge invoked Bright Data's real self-healing flow on `c_mt4wvcs1e2p0phlh1`. A new collection from the same collector returned five verified products, restored critical coverage to **100%**, and produced zero schema failures before Source Guardian emitted `RECOVERED`.

### 2. Supply changes

A product going out of stock is not a scraper failure.

If the schema and electrical fields are still healthy but availability changes, GridForge classifies the event as `REAL_WORLD_CHANGE`. It excludes unavailable components and runs the deterministic compiler again.

In the verified stockout test:

```text
Before
SPX-440M
4 panels
2S x 2P
₹220,000
9 / 9 constraints passed

After stockout
SPX-375P
6 panels
3S x 2P
₹229,200
9 / 9 constraints passed
```

No scraper healing is triggered for this event because the scraper is healthy. The market changed, so the system is recompiled.

This is the product story in one sentence:

> **When the Web breaks, Bright Data heals the source. When supply changes, GridForge recompiles the system.**

## Verified live result

The recommended farmhouse requirement has been exercised end to end in production without fixture fallback.

| Result | Verified value |
| --- | --- |
| Bright Data collector | `c_mt4wvcs1e2p0phlh1` |
| Products returned | 5 |
| Products verified | 5 / 5 |
| Minimum critical-field coverage | 100% |
| Selected panel | SPX-440M |
| PV configuration | 4 panels, 2S x 2P |
| Selected inverter | NXG-4KVA-48V |
| Battery bank | 8 x TuffE-150AH-12V |
| Total component cost | ₹220,000 |
| Constraint result | 9 / 9 passed |

The interactive result page also shows the scrape-run IDs, selected component provenance and the evidence behind each engineering check.

## Engineering model

Electrical compatibility is deterministic. Gemini does not decide whether a component is safe or compatible.

The solver evaluates hard constraints including:

- cold-temperature corrected string `Voc` below inverter maximum PV voltage
- string `Vmp` inside the inverter MPPT operating range
- parallel-string current inside the inverter input-current limit
- total PV array power inside the inverter PV-power limit
- daily generation target under the stated sizing assumptions
- battery-bank voltage compatibility
- inverter rated AC output against required peak load
- usable battery storage against the requested autonomy target
- total live component cost against budget

Every constraint returns an explicit result and evidence. There is no opaque compatibility score.

If a compiler-critical scraped specification is missing, the component is marked `UNVERIFIED` and cannot produce a validated live topology. GridForge does not ask Gemini to fill missing electrical values.

## Gemini's role

Gemini is intentionally limited to language tasks:

- convert the user's natural-language request into structured requirements
- normalize ambiguous seller terminology when needed
- explain a solver decision using already-computed evidence

Engineering truth comes from the deterministic constraint engine. Web truth comes from Bright Data.

## Live Mode and Demo Mode

GridForge exposes two paths on purpose.

| Mode | What it uses | Why it exists |
| --- | --- | --- |
| **Live Mode** | Bright Data Scraper Studio, current public web data, deterministic solver | Proves the real sponsor integration and live compilation path |
| **Demo Mode** | Clearly labelled validated fixtures | Gives judges a fast, deterministic way to explore the UX without depending on a network collection |

Demo Mode never claims to be live. Live Mode never silently falls back to Demo Mode.

## Source Guardian

The [Source integrity](https://gridforge-app.vercel.app/sources) page is backed by persisted collection runs and health events.

It shows:

- active source and collector ID
- Bright Data snapshot or run ID
- products returned and verified
- field coverage for critical attributes
- source state
- recent recovery events

The state machine distinguishes `HEALTHY`, `DEGRADED`, `HEALING`, `VERIFYING`, `RECOVERED`, `REAL_WORLD_CHANGE` and `FAILED`.

Recovery is evidence-based. GridForge does not mark a source as recovered until a fresh collection restores the required field coverage.

## Architecture

```text
User requirement
    -> Next.js server API
        -> Gemini requirement parser
        -> Bright Data Scraper Studio
            -> collector trigger
            -> collection polling
            -> structured dataset
        -> normalization and verification
        -> deterministic constraint compiler
        -> topology JSON
    -> interactive React Flow topology

Supabase
    -> source configuration
    -> scrape runs
    -> normalized components
    -> Source Guardian events
    -> compilation history
    -> controlled demo-store state
```

Long Bright Data operations are handled as resumable API work rather than a permanently running worker. The MVP therefore does not need Railway, Redis or a separate background-server deployment.

## Tech stack

- **Frontend and server:** Next.js 16, TypeScript, Vercel
- **Topology:** `@xyflow/react` / React Flow
- **Web data:** Bright Data Scraper Studio
- **Database and state:** Supabase Postgres
- **Language parsing:** Gemini Flash Lite models
- **Engineering logic:** deterministic TypeScript constraint engine
- **Testing:** Vitest and GitHub Actions

## Repository layout

```text
GridForge/
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── parse/
│   │   │   ├── compile/
│   │   │   ├── sources/
│   │   │   └── guardian/
│   │   ├── compile/demo/
│   │   ├── compile/live/
│   │   ├── design/live/[id]/
│   │   └── sources/
│   ├── components/topology/
│   └── lib/
├── backend/
│   ├── src/domain/constraints/
│   └── supabase/migrations/
├── demo-store/
│   ├── app/components/LayoutV1.tsx
│   ├── app/components/LayoutV2.tsx
│   └── app/api/admin/route.ts
├── scraper/
│   ├── gridforge-demo-store.js
│   ├── gridforge-demo-store.parser.js
│   └── gridforge-demo-store.v1-baseline.parser.js
├── .github/workflows/ci.yml
├── SETUP.md
└── LICENSE
```

## Run locally

```bash
git clone https://github.com/PrathmeshAdsod/GridForge.git
cd GridForge

cd backend
npm install
npm test
cd ..

cd frontend
npm install
cd ..

cd demo-store
npm install
cd ..
```

Create local ignored environment files from `.env.example`, then apply:

```text
backend/supabase/migrations/001_initial.sql
```

The complete environment-variable list, Scraper Studio two-editor setup, deployment order and recovery-demo procedure are documented in [SETUP.md](./SETUP.md).

## Deployment

| Surface | URL |
| --- | --- |
| GridForge | https://gridforge-app.vercel.app/ |
| Source integrity | https://gridforge-app.vercel.app/sources |
| Controlled public demo store | https://gridforge-demo-store.vercel.app/ |
| Repository | https://github.com/PrathmeshAdsod/GridForge |
| CI | https://github.com/PrathmeshAdsod/GridForge/actions |

## Scope and safety

GridForge is a procurement-aware engineering simulation, not a certified installation or wiring plan.

The current hackathon implementation is intentionally scoped to off-grid solar. It does not calculate structural mounting, protection-device sizing, conductor sizing, permitting or installer-specific requirements.

The project uses public web data only. API tokens, Supabase service-role credentials and demo-store admin credentials remain server-side and are excluded from the repository.

## Submission checklist

The core judge path currently has:

- real published Bright Data collector
- live trigger, poll and dataset flow
- 5 / 5 verified components in the proof inventory
- deterministic topology compilation
- visible collector and run provenance
- genuine same-collector Bright Data self-healing
- strict post-heal verification
- real stock-state change classification
- topology recompilation after stockout
- deterministic Demo Mode fallback
- passing CI on the validated production build

The final media commit will add the demo video link and selected screenshots at the top of this README.

## License

Apache 2.0. See [LICENSE](./LICENSE).
