/**
 * GridForge — Bright Data Adapter
 *
 * Handles all communication with Bright Data Scraper Studio API.
 * Real implementation behind a provider interface so mock/real can be swapped.
 *
 * API Reference (verified August 2026):
 * - Trigger: POST https://api.brightdata.com/dca/trigger?collector=<c_id>
 * - Dataset: GET https://api.brightdata.com/dca/dataset?id=<run_id>
 * - Self-Heal Start: POST /dca/collectors/{id}/refactor_template
 * - Self-Heal Poll: GET /dca/collectors/{id}/refactor_template/progress
 * - Self-Heal Approve: POST /dca/collectors/{id}/resume_automation_job
 */

const BRIGHT_DATA_BASE_URL = "https://api.brightdata.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriggerCollectorOptions {
  collectorId: string;
  inputs?: Record<string, unknown>[];
}

export interface TriggerCollectorResult {
  collectionId: string;
  status: "pending" | "running" | "ready" | "error";
}

export interface DatasetResult<T = Record<string, unknown>> {
  status: "pending" | "ready" | "error";
  data?: T[];
  errorMessage?: string;
}

export type SelfHealStatus =
  | "running"
  | "pending_answer"
  | "approved"
  | "failed";

export interface SelfHealProgress {
  jobId: string;
  status: SelfHealStatus;
  description?: string;
  proposedDiff?: string;
}

export interface BrightDataAdapter {
  triggerCollector(options: TriggerCollectorOptions): Promise<TriggerCollectorResult>;
  getDataset<T = Record<string, unknown>>(collectionId: string): Promise<DatasetResult<T>>;
  triggerSelfHeal(collectorId: string, prompt: string): Promise<{ jobId: string }>;
  getSelfHealProgress(collectorId: string): Promise<SelfHealProgress>;
  approveSelfHeal(collectorId: string): Promise<{ success: boolean }>;
}

// ─── Real Adapter ──────────────────────────────────────────────────────────────

async function brightDataRequest<T>(
  method: "GET" | "POST",
  path: string,
  apiToken: string,
  body?: unknown
): Promise<T> {
  const url = `${BRIGHT_DATA_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Bright Data API error: ${response.status} ${response.statusText} — ${text}`
    );
  }

  return response.json() as Promise<T>;
}

export function createRealBrightDataAdapter(apiToken: string): BrightDataAdapter {
  return {
    async triggerCollector({ collectorId, inputs = [] }) {
      const result = await brightDataRequest<{ collection_id: string }>(
        "POST",
        `/dca/trigger?collector=${collectorId}`,
        apiToken,
        inputs.length > 0 ? inputs : [{}]
      );
      return {
        collectionId: result.collection_id,
        status: "pending",
      };
    },

    async getDataset<T>(collectionId: string) {
      try {
        const result = await brightDataRequest<{ status?: string; data?: T[] } | T[]>(
          "GET",
          `/dca/dataset?id=${encodeURIComponent(collectionId)}&format=json`,
          apiToken
        );

        // API may return array directly or object with status/data
        if (Array.isArray(result)) {
          return { status: "ready" as const, data: result as T[] };
        }

        const r = result as { status?: string; data?: T[] };
        if (r.status === "pending" || r.status === "running") {
          return { status: "pending" as const };
        }
        return { status: "ready" as const, data: r.data ?? [] };
      } catch (err) {
        return {
          status: "error" as const,
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },

    async triggerSelfHeal(collectorId: string, prompt: string) {
      const result = await brightDataRequest<{ job_id?: string }>(
        "POST",
        `/dca/collectors/${collectorId}/refactor_template`,
        apiToken,
        { prompt }
      );
      return { jobId: result.job_id ?? `heal_${Date.now()}` };
    },

    async getSelfHealProgress(collectorId: string) {
      const result = await brightDataRequest<{
        job_id?: string;
        status?: string;
        description?: string;
        diff?: string;
      }>(
        "GET",
        `/dca/collectors/${collectorId}/refactor_template/progress`,
        apiToken
      );

      const rawStatus = result.status ?? "running";
      let status: SelfHealStatus = "running";
      if (rawStatus === "pending_answer") status = "pending_answer";
      else if (rawStatus === "approved" || rawStatus === "complete") status = "approved";
      else if (rawStatus === "failed") status = "failed";

      return {
        jobId: result.job_id ?? collectorId,
        status,
        ...(result.description !== undefined ? { description: result.description } : {}),
        ...(result.diff !== undefined ? { proposedDiff: result.diff } : {}),
      };
    },

    async approveSelfHeal(collectorId: string) {
      await brightDataRequest(
        "POST",
        `/dca/collectors/${collectorId}/resume_automation_job`,
        apiToken,
        {}
      );
      return { success: true };
    },
  };
}

// ─── Mock Adapter (DEV MODE) ──────────────────────────────────────────────────

export function createMockBrightDataAdapter(): BrightDataAdapter {
  // Tracks healing state for each collector
  const healingState: Record<string, { startedAt: number; approved: boolean }> = {};

  return {
    async triggerCollector({ collectorId }) {
      console.log(`[MOCK BrightData] Triggering collector ${collectorId}`);
      await delay(200);
      return {
        collectionId: `mock_run_${collectorId}_${Date.now()}`,
        status: "pending",
      };
    },

    async getDataset<T>(collectionId: string) {
      console.log(`[MOCK BrightData] Getting dataset ${collectionId}`);
      await delay(300);
      // Return mock scraped product data
      return {
        status: "ready" as const,
        data: getMockProducts() as unknown as T[],
      };
    },

    async triggerSelfHeal(collectorId: string, prompt: string) {
      console.log(`[MOCK BrightData] Triggering self-heal for ${collectorId}: ${prompt}`);
      healingState[collectorId] = { startedAt: Date.now(), approved: false };
      return { jobId: `heal_${collectorId}_${Date.now()}` };
    },

    async getSelfHealProgress(collectorId: string) {
      await delay(200);
      const state = healingState[collectorId];
      if (!state) {
        return { jobId: `heal_${collectorId}`, status: "failed" };
      }

      const elapsed = Date.now() - state.startedAt;

      if (elapsed < 3000) {
        return {
          jobId: `heal_${collectorId}`,
          status: "running",
          description: "AI is analyzing DOM structure changes...",
        };
      } else if (!state.approved) {
        return {
          jobId: `heal_${collectorId}`,
          status: "pending_answer",
          description: "Self-healing complete. Proposed fix is ready for approval.",
          proposedDiff:
            '- const voc = $(".product-voc").text();\n+ const voc = $("[data-spec=\\"open-circuit-voltage\\"] strong").text();',
        };
      } else {
        return {
          jobId: `heal_${collectorId}`,
          status: "approved",
          description: "Fix approved and deployed. Collector running with updated selectors.",
        };
      }
    },

    async approveSelfHeal(collectorId: string) {
      console.log(`[MOCK BrightData] Approving self-heal for ${collectorId}`);
      if (healingState[collectorId]) {
        healingState[collectorId].approved = true;
      }
      return { success: true };
    },
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createBrightDataAdapter(): BrightDataAdapter {
  const token = process.env.BRIGHT_DATA_API_TOKEN;
  const mode = process.env.GRIDFORGE_MODE ?? "mock";

  if (mode === "real" && token) {
    console.log("[BrightData] Using REAL adapter");
    return createRealBrightDataAdapter(token);
  }

  console.log("[BrightData] Using MOCK adapter (set GRIDFORGE_MODE=real and BRIGHT_DATA_API_TOKEN)");
  return createMockBrightDataAdapter();
}

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const waitMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[BrightData] Attempt ${attempt} failed. Retrying in ${waitMs}ms...`);
        await delay(waitMs);
      }
    }
  }

  throw lastError ?? new Error("All retry attempts failed");
}

// ─── Poll Until Ready ─────────────────────────────────────────────────────────

export async function pollDatasetUntilReady<T>(
  adapter: BrightDataAdapter,
  collectionId: string,
  options: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<DatasetResult<T>> {
  const { maxAttempts = 30, intervalMs = 5000 } = options;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await adapter.getDataset<T>(collectionId);
    if (result.status === "ready") return result;
    if (result.status === "error") return result;
    await delay(intervalMs);
  }

  return { status: "error", errorMessage: "Dataset polling timed out" };
}

// ─── Poll Self-Heal Until Ready ───────────────────────────────────────────────

export async function pollSelfHealUntilPendingAnswer(
  adapter: BrightDataAdapter,
  collectorId: string,
  options: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<SelfHealProgress> {
  const { maxAttempts = 24, intervalMs = 5000 } = options; // max 2 minutes

  for (let i = 0; i < maxAttempts; i++) {
    const progress = await adapter.getSelfHealProgress(collectorId);
    if (progress.status === "pending_answer" || progress.status === "approved" || progress.status === "failed") {
      return progress;
    }
    await delay(intervalMs);
  }

  return { jobId: collectorId, status: "failed", description: "Self-healing timed out" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mock product data matching expected schema */
function getMockProducts(): Record<string, unknown>[] {
  return [
    {
      productUrl: "https://gridforge-demo.vercel.app/products/panel-440w",
      storeName: "GridForge Demo Store",
      model: "GF-440M-PERC",
      manufacturer: "GridForge Demo",
      priceInr: 11500,
      currency: "INR",
      availability: "in_stock",
      productType: "solar_panel",
      rawSpecs: {
        "Max Power (Pmax)": "440W",
        "Open Circuit Voltage (Voc)": "49.8V",
        "Max Power Voltage (Vmp)": "41.4V",
        "Short Circuit Current (Isc)": "11.40A",
        "Max Power Current (Imp)": "10.65A",
        "Temperature Coefficient (Voc)": "-0.29%/°C",
        "Cell Type": "Mono PERC",
        "Efficiency": "21.3%",
      },
    },
    {
      productUrl: "https://gridforge-demo.vercel.app/products/panel-550w",
      storeName: "GridForge Demo Store",
      model: "GF-550M-BIFACIAL",
      manufacturer: "GridForge Demo",
      priceInr: 14500,
      currency: "INR",
      availability: "in_stock",
      productType: "solar_panel",
      rawSpecs: {
        "Max Power (Pmax)": "550W",
        "Open Circuit Voltage (Voc)": "50.5V",
        "Max Power Voltage (Vmp)": "42.8V",
        "Short Circuit Current (Isc)": "13.50A",
        "Max Power Current (Imp)": "12.85A",
        "Temperature Coefficient (Voc)": "-0.28%/°C",
        "Cell Type": "Bifacial Mono PERC",
        "Efficiency": "21.8%",
      },
    },
    {
      productUrl: "https://gridforge-demo.vercel.app/products/inverter-3500w",
      storeName: "GridForge Demo Store",
      model: "GF-INV-3500-48V",
      manufacturer: "GridForge Demo",
      priceInr: 42000,
      currency: "INR",
      availability: "in_stock",
      productType: "inverter",
      rawSpecs: {
        "Rated AC Output Power": "3000W",
        "Nominal Battery Voltage": "48V",
        "Max PV Input Voltage": "150V",
        "MPPT Voltage Range": "60V - 115V",
        "Max PV Input Current": "25A",
        "Max PV Short Circuit Current": "30A",
        "Max PV Input Power": "4500W",
        "Output Voltage": "230V AC",
        "Output Frequency": "50Hz",
      },
    },
    {
      productUrl: "https://gridforge-demo.vercel.app/products/battery-100ah",
      storeName: "GridForge Demo Store",
      model: "GF-BAT-100AH-12V",
      manufacturer: "GridForge Demo",
      priceInr: 11500,
      currency: "INR",
      availability: "in_stock",
      productType: "battery",
      rawSpecs: {
        "Nominal Voltage": "12V",
        "Capacity": "100Ah / 1.2kWh",
        "Chemistry": "AGM Lead-Acid",
        "Depth of Discharge": "50%",
        "Cycle Life": "500 cycles",
      },
    },
  ];
}
