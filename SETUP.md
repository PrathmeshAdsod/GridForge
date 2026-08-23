# GridForge — Setup Guide

Complete setup for local development and production deployment.

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 18+ | Frontend & demo store |
| npm | 9+ | Package management |
| Git | Any | Clone repo |
| Supabase account | Free | Database |
| Bright Data account | Free trial / Paid | Live scraping |
| Google AI Studio key | Free | Gemini NL parsing |
| Vercel account | Hobby (free) | Deployment |

---

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste contents of `backend/supabase/migrations/001_initial.sql` → Run
3. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Google Gemini API Key

1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Copy it → `GEMINI_API_KEY`

---

## 3. Bright Data Setup (for Live Mode)

### Get API Token
1. Sign up at [brightdata.com](https://brightdata.com)
2. Go to **Settings → Account** → copy your API token → `BRIGHT_DATA_API_TOKEN`

### Create the Demo Store Collector
1. In the Bright Data dashboard, click **Scrapers** in the sidebar
2. Click **New** → **Develop a web scraper** → **Open IDE** → **Start from scratch**
3. Rename the scraper to `gridforge-demo-store`
4. Copy the contents of `scraper/gridforge-demo-store.js` into the code editor
5. Click **Save** / **Finish editing**
6. Note the **Collector ID** from the URL (format: `c_XXXXXXXXXX`)
7. Click **Publish to production**
8. Copy the Collector ID → `BRIGHT_DATA_DEMO_STORE_COLLECTOR_ID`

### After Deploying Demo Store
Update the collector's target URL from `localhost:3001` to your Vercel demo store URL.

---

## 4. Environment Variables

Copy the template:
```bash
cp .env.example frontend/.env.local
cp .env.example demo-store/.env.local  # only needs Supabase + DEMO_ADMIN_TOKEN
```

### `frontend/.env.local`
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Gemini
GEMINI_API_KEY=AIza...

# Bright Data (Live Mode — optional for demo-only use)
BRIGHT_DATA_API_TOKEN=your-token-here
BRIGHT_DATA_DEMO_STORE_COLLECTOR_ID=c_xxxxxxxxxx
BRIGHT_DATA_LOOM_SOLAR_COLLECTOR_ID=c_xxxxxxxxxx  # optional

# Demo store
DEMO_STORE_URL=https://gridforge-demo-store.vercel.app
DEMO_ADMIN_TOKEN=choose-a-secure-random-string
```

### `demo-store/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DEMO_ADMIN_TOKEN=same-value-as-above
```

---

## 5. Local Development

```bash
# Terminal 1 — Demo Store (Bright Data scraper target)
cd demo-store
npm install
npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Verify everything works:

```bash
# Test Gemini parse
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"nl":"Off-grid farmhouse, 8 kWh/day, 3 kW peak, budget 2 lakh rupees"}'

# Test demo compile
curl -X POST http://localhost:3000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"mode":"demo","requirement":{"systemType":"off_grid","dailyEnergyKwh":8,"peakLoadKw":3,"budgetInr":200000,"location":"India","rawNl":"test","parsedBy":"gemini","confidence":"high"}}'

# Check demo store state
curl http://localhost:3001/api/admin
```

---

## 6. Deploy to Vercel

### Deploy Demo Store first

```bash
cd demo-store
npx vercel --prod
```

Add environment variables in Vercel Dashboard → Project Settings → Environment Variables (see section 4 above, `demo-store/.env.local` values).

Get the URL (e.g. `https://gridforge-demo-store.vercel.app`).

### Deploy Frontend

```bash
cd frontend
npx vercel --prod
```

Add all `frontend/.env.local` values as Vercel environment variables. Set `DEMO_STORE_URL` to the demo store URL from above.

---

## 7. Post-Deployment

1. **Update collector URL** — In Bright Data Scraper Studio, change the target URL from `localhost:3001` to your demo store Vercel URL
2. **Test live compile** — Visit your frontend Vercel URL → enter a requirement → click "Live compile"
3. **Test self-healing** — Switch demo store to V2 layout → run a live compile → watch Source Guardian flag DEGRADED → trigger heal

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` env var errors | Make sure you're using the `service_role` key, not the `anon` key |
| `live_pipeline_not_configured` | Add `BRIGHT_DATA_DEMO_STORE_COLLECTOR_ID` to `.env.local` |
| Demo store not updating on admin API | Check `DEMO_ADMIN_TOKEN` matches in both apps |
| Gemini parse fails | Verify `GEMINI_API_KEY` is valid and has quota |
| Supabase tables missing | Re-run `001_initial.sql` in Supabase SQL Editor |
