<p align="center">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Built_with-Bright_Data-orange.svg" alt="Bright Data" />
  <img src="https://img.shields.io/badge/AI-Gemini-purple.svg" alt="Gemini" />
  <img src="https://img.shields.io/badge/Stack-Next.js_+_Supabase-black.svg" alt="Stack" />
</p>

<h1 align="center">⚡ GridForge</h1>
<p align="center"><strong>Compile physical systems from the live Web.</strong></p>
<p align="center">
  Describe your energy need in plain English → GridForge scrapes real component data from the web,
  validates every electrical constraint, and produces an engineered off-grid solar system design.
</p>

---

## What it does

GridForge is a **web-scraping-powered engineering compiler** for off-grid solar systems.

1. **Parse** — Describe your requirement in natural language. Gemini extracts structured parameters (daily kWh, peak load, budget, location).
2. **Scrape** — Bright Data collectors pull live product data from real solar component stores.
3. **Validate** — Every candidate is checked against 6 electrical constraints (string Voc, MPPT range, current limits, battery bank sizing, peak load, autonomy).
4. **Compile** — The solver picks the optimal panel/inverter/battery combination that passes all constraints within budget.
5. **Explain** — Gemini generates a human-readable explanation of the resulting topology.

### Source Guardian

GridForge includes a self-healing data layer:
- **DEGRADED** — when a scraper's DOM selectors break (website redesign), the system detects coverage drops and triggers Bright Data's AI self-healing.
- **REAL_WORLD_CHANGE** — when schema is intact but product availability/price changes, the system recompiles — it's a real supply event, not a scraper bug.

---

## Demo

| Mode | Description |
|------|-------------|
| **Demo Mode** | Instant compilation from validated fixtures. Full UI experience with real Gemini explanations. |
| **Live Mode** | Real Bright Data scrape → real electrical specs → real constraint solver. Requires collector configuration. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GridForge                            │
│                                                         │
│  NL Input → [Gemini Parse] → StructuredRequirement      │
│                                                         │
│  Demo Mode: fixtures → Gemini explain → Topology        │
│                                                         │
│  Live Mode: [Bright Data Collector]                     │
│               → normalize → validate                    │
│               → [Constraint Solver]                     │
│               → [Gemini explain]                        │
│               → Topology + Provenance                   │
│                                                         │
│  Source Guardian: HEALTHY / DEGRADED / REAL_WORLD_CHANGE│
│  Self-Heal: Bright Data AI selector repair              │
└─────────────────────────────────────────────────────────┘
```

**Stack:**
- **Frontend** — Next.js 15, TypeScript, Framer Motion
- **AI** — Google Gemini (`gemini-2.5-flash-lite`)
- **Scraping** — Bright Data Scraper Studio (custom collectors)
- **Database** — Supabase (PostgreSQL)
- **Demo Target** — Next.js server-rendered store (V1/V2 layouts for self-healing demo)
- **Deploy** — Vercel Hobby (free tier)

---

## Repo Structure

```
GridForge/
├── frontend/          # Main Next.js app (compiler UI, API routes)
│   ├── app/
│   │   ├── api/
│   │   │   ├── parse/       # POST /api/parse — Gemini NL parsing
│   │   │   ├── compile/     # POST /api/compile — demo or live
│   │   │   ├── guardian/
│   │   │   │   ├── assess/  # Source Guardian classification
│   │   │   │   └── heal/    # Self-heal trigger
│   │   ├── compile/
│   │   │   ├── demo/        # Demo mode entry
│   │   │   └── live/        # Live mode entry (real Bright Data)
│   │   ├── sources/         # Source Guardian dashboard
│   │   └── page.tsx         # Landing + NL composer
│   └── lib/
│       ├── gemini.ts        # Gemini client (parse + explain)
│       ├── catalog.ts       # Bright Data pipeline (trigger → poll → normalize)
│       └── supabase.ts      # Supabase client factory
│
├── demo-store/        # Server-rendered scraper target (Next.js)
│   ├── app/
│   │   ├── page.tsx         # Reads Supabase state → renders V1 or V2
│   │   ├── api/admin/       # POST /api/admin — layout/stock control
│   │   └── components/
│   │       ├── LayoutV1.tsx # Has data-spec attributes → collector works
│   │       └── LayoutV2.tsx # data-spec REMOVED → triggers DEGRADED state
│   └── lib/supabase.ts
│
├── backend/           # Constraint solver (TypeScript)
│   └── src/domain/constraints/
│
├── scraper/           # Bright Data collector scripts
│   └── gridforge-demo-store.js
│
└── .env.example       # Required environment variables
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) account (free)
- [Bright Data](https://brightdata.com) account (for Live Mode)
- [Google AI Studio](https://makersuite.google.com/app/apikey) API key

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/gridforge.git
cd gridforge

# Install frontend
cd frontend && npm install && cd ..

# Install demo store
cd demo-store && npm install && cd ..
```

### 2. Configure Environment

Copy `.env.example` to `frontend/.env.local` and fill in your keys:

```bash
cp .env.example frontend/.env.local
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
```

For Live Mode (optional):
```env
BRIGHT_DATA_API_TOKEN=your-token
BRIGHT_DATA_DEMO_STORE_COLLECTOR_ID=c_xxxxxxxx
```

### 3. Run Database Migration

```bash
# Using Supabase dashboard: paste contents of backend/supabase/migrations/001_initial.sql
# Or using psql:
psql "postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
  -f backend/supabase/migrations/001_initial.sql
```

### 4. Start Local Development

```bash
# Terminal 1 — Demo Store (scraper target)
cd demo-store && npm run dev   # http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev     # http://localhost:3000
```

### 5. Configure Bright Data (for Live Mode)

See [`SETUP.md`](./SETUP.md) for step-by-step instructions to create a Scraper Studio collector.

---

## Demo Store Admin

The demo store exposes an admin API to control its state for demonstrating self-healing:

```bash
# Switch to V2 layout (breaks scraper — triggers DEGRADED)
curl -X POST http://localhost:3001/api/admin \
  -H "Authorization: Bearer YOUR_DEMO_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"layout_v2"}'

# Reset to V1 (restores scraper — triggers RECOVERED)
curl -X POST http://localhost:3001/api/admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DEMO_ADMIN_TOKEN" \
  -d '{"action":"reset"}'

# Trigger stockout (real-world supply change — REAL_WORLD_CHANGE)
curl -X POST http://localhost:3001/api/admin \
  -H "Authorization: Bearer YOUR_DEMO_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"out_of_stock"}'
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Parse natural language requirement with Gemini |
| `/api/compile` | POST | Compile system in `demo` or `live` mode |
| `/api/guardian/assess` | POST | Classify scrape health for a source |
| `/api/guardian/heal` | POST | Trigger Bright Data self-heal on a degraded source |

---

## Deployment

Deploy both apps to Vercel:

```bash
# Deploy demo store first (get URL for collector config)
cd demo-store && npx vercel --prod

# Deploy frontend
cd frontend && npx vercel --prod
```

Add environment variables in Vercel Dashboard for each project (see `.env.example`).

---

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE)

---

<p align="center">
  Built for the <strong>WeMakeDevs × Bright Data "Into the Scrape-Verse"</strong> hackathon
</p>
