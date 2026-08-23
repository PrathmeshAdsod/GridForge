-- GridForge Supabase Schema
-- Run in Supabase SQL Editor: https://upyouwbyfiiwepkwxqht.supabase.co

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── demo_store_state ─────────────────────────────────────────────────────────
-- Controls what the publicly deployed demo store renders server-side
create table if not exists public.demo_store_state (
  id integer primary key default 1 check (id = 1), -- singleton row
  layout_version text not null default 'v1' check (layout_version in ('v1', 'v2')),
  panel_440w_in_stock boolean not null default true,
  panel_550w_in_stock boolean not null default true,
  panel_375w_in_stock boolean not null default false, -- starts out of stock
  updated_at timestamptz not null default now()
);

-- Seed the singleton
insert into public.demo_store_state (id, layout_version, panel_440w_in_stock, panel_550w_in_stock, panel_375w_in_stock)
values (1, 'v1', true, true, false)
on conflict (id) do nothing;

-- ─── sources ──────────────────────────────────────────────────────────────────
create table if not exists public.sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                            -- "GridForge Demo Store", "Loom Solar"
  url text not null,
  collector_id text,                             -- "c_..." bright data collector ID
  source_type text not null default 'custom',   -- "demo_store" | "real_source" | "custom"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── scrape_runs ──────────────────────────────────────────────────────────────
create table if not exists public.scrape_runs (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references public.sources(id),
  collector_id text not null,
  bright_data_run_id text,                       -- the dataset/snapshot ID from BD
  status text not null default 'triggered',      -- triggered | running | complete | failed
  products_total integer,
  products_verified integer,
  field_coverage jsonb,                          -- { voc: 0.91, vmp: 0.91, ... }
  schema_failure_rate numeric(5,4),
  raw_result_url text,                           -- link to BD dataset if applicable
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_detail text
);

-- ─── source_health_events ─────────────────────────────────────────────────────
create table if not exists public.source_health_events (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references public.sources(id),
  collector_id text not null,
  event_type text not null,                      -- SCRAPE_COMPLETE | DEGRADATION_DETECTED | HEALING_INITIATED | HEALING_COMPLETE | VERIFICATION_PASSED | REAL_SUPPLY_CHANGE_DETECTED | SOURCE_RECOVERED | FAILED
  health_state text not null,                   -- HEALTHY | DEGRADED | HEALING | VERIFYING | RECOVERED | REAL_WORLD_CHANGE | FAILED
  detail text,
  metadata jsonb,
  scrape_run_id uuid references public.scrape_runs(id),
  created_at timestamptz not null default now()
);

-- ─── components ───────────────────────────────────────────────────────────────
create table if not exists public.components (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references public.sources(id),
  scrape_run_id uuid references public.scrape_runs(id),
  external_product_id text,                     -- data-product-id from demo store
  component_type text not null,                 -- solar_panel | inverter | battery
  manufacturer text,
  model text,
  -- electrical specs (null = scraper could not find/parse)
  pmax_w numeric,
  voc_v numeric,
  vmp_v numeric,
  isc_a numeric,
  imp_a numeric,
  voc_temp_coeff_pct_per_c numeric,
  efficiency_pct numeric,
  cell_type text,
  ac_output_w numeric,
  battery_voltage_v numeric,
  max_pv_voltage_v numeric,
  mppt_min_v numeric,
  mppt_max_v numeric,
  max_pv_current_a numeric,
  max_pv_power_w numeric,
  nominal_voltage_v numeric,
  capacity_ah numeric,
  capacity_kwh numeric,
  dod_pct numeric,
  chemistry text,
  cycle_life integer,
  -- pricing / availability
  price_inr numeric,
  availability text,                            -- in_stock | out_of_stock | limited
  original_url text,
  -- verification
  verification_status text not null default 'UNVERIFIED', -- VERIFIED | PARTIAL | UNVERIFIED
  scraped_at timestamptz not null default now(),
  is_active boolean not null default true
);

-- ─── compilation_runs ─────────────────────────────────────────────────────────
create table if not exists public.compilation_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,                                 -- null for guest
  requirement_nl text,                          -- original NL input
  requirement_structured jsonb,                 -- parsed requirement
  data_source text not null,                    -- "live" | "demo"
  status text not null default 'running',       -- running | complete | failed | no_solution
  topology_result jsonb,                        -- full topology JSON
  metrics jsonb,
  candidates_evaluated integer,
  candidates_rejected integer,
  candidates_validated integer,
  collector_ids text[],
  scrape_run_ids uuid[],
  error_detail text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ─── projects (auth-gated) ────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  requirement_nl text,
  requirement_structured jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── designs ──────────────────────────────────────────────────────────────────
create table if not exists public.designs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  compilation_run_id uuid references public.compilation_runs(id),
  version integer not null default 1,
  is_current boolean not null default true,
  topology jsonb not null,                      -- full topology snapshot
  metrics jsonb,
  change_reason text,                           -- "stockout_recompile" | "manual" | "initial"
  created_at timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

-- demo_store_state: readable by all (public demo), writable only via service role
alter table public.demo_store_state enable row level security;
create policy "demo_store_state_public_read" on public.demo_store_state for select using (true);
create policy "demo_store_state_service_write" on public.demo_store_state for update using (auth.role() = 'service_role');

-- sources: readable by all
alter table public.sources enable row level security;
create policy "sources_public_read" on public.sources for select using (true);
create policy "sources_service_write" on public.sources for all using (auth.role() = 'service_role');

-- scrape_runs: readable by all
alter table public.scrape_runs enable row level security;
create policy "scrape_runs_public_read" on public.scrape_runs for select using (true);
create policy "scrape_runs_service_write" on public.scrape_runs for all using (auth.role() = 'service_role');

-- source_health_events: readable by all
alter table public.source_health_events enable row level security;
create policy "source_health_events_public_read" on public.source_health_events for select using (true);
create policy "source_health_events_service_write" on public.source_health_events for all using (auth.role() = 'service_role');

-- components: readable by all
alter table public.components enable row level security;
create policy "components_public_read" on public.components for select using (true);
create policy "components_service_write" on public.components for all using (auth.role() = 'service_role');

-- compilation_runs: readable by all (contains no PII)
alter table public.compilation_runs enable row level security;
create policy "compilation_runs_public_read" on public.compilation_runs for select using (true);
create policy "compilation_runs_service_write" on public.compilation_runs for all using (auth.role() = 'service_role');

-- projects: owner-only
alter table public.projects enable row level security;
create policy "projects_owner_all" on public.projects for all using (auth.uid() = user_id);

-- designs: owner-only
alter table public.designs enable row level security;
create policy "designs_owner_all" on public.designs for all using (auth.uid() = user_id);

-- ─── Seed sources ─────────────────────────────────────────────────────────────
-- (collector_id will be filled after Bright Data collectors are created)
insert into public.sources (name, url, source_type)
values
  ('GridForge Demo Store', 'https://gridforge-demo-store.vercel.app', 'demo_store'),
  ('Loom Solar', 'https://www.loomsolar.com/collections/solar-panels', 'real_source')
on conflict do nothing;
