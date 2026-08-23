# GridForge — Setup Guide

This guide reproduces the real GridForge demo and Live Mode using only free-tier infrastructure.

## Stack

| Service | Role |
|---|---|
| Vercel Hobby | Main Next.js app + public demo store |
| Supabase Free | Postgres state/provenance + auth-ready persistence |
| Bright Data Scraper Studio | Live collection + AI self-healing |
| Gemini API | Natural-language parsing + explanations only |

No Railway/Redis worker is required for the hackathon MVP.

---

## 1. Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `backend/supabase/migrations/001_initial.sql`.
4. Copy the project URL, anon key and service-role key into local/Vercel environment variables.

Never expose or commit the service-role key.

---

## 2. Gemini

Create a Gemini API key in Google AI Studio and set:

```env
GEMINI_API_KEY=...
```

GridForge currently uses:

```text
gemini-3.5-flash-lite   # primary
gemini-3.1-flash-lite   # fallback
```

Gemini is deliberately outside the engineering truth path. It parses user language and explains a finished topology; it never invents electrical component specifications or decides compatibility.

---

## 3. Deploy the demo store

The demo store must be public before Bright Data can scrape it.

```bash
cd demo-store
npm install
npx vercel --prod
```

Production URL used by GridForge:

```text
https://gridforge-demo-store.vercel.app
```

The store is server-rendered from Supabase state and exposes genuinely different Layout V1 and Layout V2 HTML.

---

## 4. Bright Data Scraper Studio

### Important: Scraper Studio is NOT a Node/Puppeteer runtime

Do **not** use:

```js
require('puppeteer')
puppeteer.launch()
page.goto()
```

Scraper Studio provides its own interaction functions (`navigate`, `parse`, `collect`) and a separate Cheerio-based **Parser code** editor.

### Current GridForge collector

```text
c_mt4wvcs1e2p0phlh1
```

Collector IDs are provenance identifiers, not API secrets. The API token is secret and must remain only in local/Vercel environment variables.

### Configure the collector

Open the `gridforge-demo-store` scraper in Bright Data Scraper Studio.

#### A. Interaction code

Open **Interaction code** and paste the complete contents of:

```text
scraper/gridforge-demo-store.js
```

It should look conceptually like:

```js
const targetUrl = input?.url || 'https://gridforge-demo-store.vercel.app';
navigate(targetUrl);
const products = parse();
for (const product of products) collect(product);
```

#### B. Parser code

Open **Parser code** in the left-side stage tree and paste the complete contents of:

```text
scraper/gridforge-demo-store.parser.js
```

The parser uses Scraper Studio's Cheerio `$` object to read product cards and returns one flat record per component.

#### C. Test it

In the **Input** panel set:

```text
url = https://gridforge-demo-store.vercel.app
```

Then:

1. Click **Play / Preview**.
2. Confirm output rows include `solar_panel`, `inverter`, and `battery` records.
3. Confirm panel rows contain `pmax`, `voc`, `vmp`, `isc`, `imp` and `voc_temp_coeff`.
4. Confirm inverter rows contain `ac_output_w`, `battery_voltage_v`, `max_pv_v`, `mppt_range`, `max_pv_a`, `max_pv_w`.
5. Confirm battery rows contain `voltage_v`, `capacity_ah`, `energy_kwh`, `dod_pct`.
6. Click **Finish editing** / save to production.
7. Keep the same collector ID `c_mt4wvcs1e2p0phlh1` throughout the self-healing demo.

---

## 5. Environment variables

### Main frontend / Vercel project

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

GEMINI_API_KEY=...

BRIGHT_DATA_API_TOKEN=...
BRIGHT_DATA_DEMO_STORE_COLLECTOR_ID=c_mt4wvcs1e2p0phlh1
DEMO_STORE_URL=https://gridforge-demo-store.vercel.app
```

Optional later source:

```env
BRIGHT_DATA_LOOM_SOLAR_COLLECTOR_ID=c_...
```

### Demo-store Vercel project

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
DEMO_ADMIN_TOKEN=...
```

Never commit `.env`, `.env.local`, HANDOFF.md, API tokens, service-role keys, deployment logs, or screenshots containing credentials.

---

## 6. Run locally

```bash
# terminal 1
cd demo-store
npm install
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

---

## 7. Recommended judge-demo requirement

Use this requirement for the controlled supply-change demonstration:

```text
Off-grid farmhouse using 6.5 kWh/day, 3 kW peak load, under ₹2.5 lakh in India.
```

Why this requirement is useful:

- baseline inventory can validate a 440 W panel topology;
- the controlled stockout removes that panel;
- a previously unavailable 375 W substitute becomes available;
- the deterministic solver can change the PV arrangement from **2S×2P** to **3S×2P** rather than merely changing a label.

Always trust the solver's actual result at runtime; do not narrate a topology change that did not occur.

---

## 8. Real demo sequence

### Baseline

1. Reset demo-store state to Layout V1.
2. Run **Live compile**.
3. Verify the response/UI shows:
   - `dataSource = live`
   - collector `c_mt4wvcs1e2p0phlh1`
   - real Bright Data snapshot/run provenance
   - panel + inverter + battery
   - deterministic constraint evidence.
4. Open **Source Guardian** and assess the latest run.

### DOM drift / self-heal

1. Change the public demo store to Layout V2 using the authenticated admin endpoint.
2. Run Live compile again so the same collector sees the changed HTML.
3. Assess the run. Critical electrical-field coverage should fall and Source Guardian should classify **DEGRADED**.
4. Click **Heal same collector**.
5. GridForge calls Bright Data's real `refactor_template` AI self-healing flow on `c_mt4wvcs1e2p0phlh1`.
6. The controlled demo-store approval gate may be auto-approved/saved.
7. Rerun Live compile using the **same collector ID**.
8. Assess that new run. Only restored field coverage may produce **RECOVERED**.

Do not manually switch back to V1 as a substitute for self-healing during the recorded proof. The website should remain Layout V2 while Bright Data repairs the collector.

### Real supply change

1. Return to a healthy scraper state.
2. Trigger the demo-store `out_of_stock` action.
3. The HTML/schema remains healthy; availability changes are real data.
4. Run Live compile again.
5. Source Guardian should classify **REAL_WORLD_CHANGE**, not DEGRADED.
6. GridForge excludes unavailable inventory and reruns the deterministic compiler.
7. Show the before/after topology if it genuinely changed.

Core demo line:

> **When the Web breaks, Bright Data heals the source. When supply changes, GridForge recompiles the system.**

---

## 9. Demo-store admin API

Use the production demo-store URL and your private `DEMO_ADMIN_TOKEN`.

```bash
# Reset baseline: V1, 440W + 550W available, 375W unavailable
curl -X POST https://gridforge-demo-store.vercel.app/api/admin \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"reset"}'

# Simulate website redesign / DOM drift
curl -X POST https://gridforge-demo-store.vercel.app/api/admin \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"layout_v2"}'

# Simulate a real supply change
curl -X POST https://gridforge-demo-store.vercel.app/api/admin \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"out_of_stock"}'
```

---

## 10. Verification before submission

Run:

```bash
cd backend && npm install && npm test
cd ../frontend && npm install && npm run build
cd ../demo-store && npm install && npm run build
```

Then verify the live application itself. HTTP 200 is not sufficient: a successful Live Mode result must contain a non-empty topology, panel/inverter/battery provenance, real `c_*` collector ID, real scrape run/snapshot ID, and constraint evidence.

If Live Mode fails, show the real failure. Never silently use demo fixtures.
