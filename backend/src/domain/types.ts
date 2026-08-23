/**
 * GridForge — Core Domain Types
 *
 * These are the canonical TypeScript types for the entire system.
 * Shared across frontend and backend via the types/ directory.
 *
 * CRITICAL: Never invent electrical values. Missing fields → UNVERIFIED.
 */

// ─── Verification & Provenance ────────────────────────────────────────────────

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "PARTIAL";

export interface ScrapedSourceMeta {
  storeName: string;
  originalUrl: string;
  collectorId: string; // Bright Data c_xxx
  scrapeRunId: string;
  scrapedAt: string; // ISO 8601
}

// ─── Base Component ───────────────────────────────────────────────────────────

export type ComponentType = "solar_panel" | "inverter" | "battery";

export interface BaseComponent {
  id: string;
  type: ComponentType;
  manufacturer: string;
  model: string;
  source: ScrapedSourceMeta;
  priceInr: number | null;
  currency: "INR" | "USD" | "EUR";
  availability: "in_stock" | "out_of_stock" | "limited" | "unknown";
  verificationStatus: VerificationStatus;
  scrapedAt: string; // ISO 8601
  imageUrl?: string;
  productUrl: string;
}

// ─── Solar Panel ──────────────────────────────────────────────────────────────

export interface SolarPanel extends BaseComponent {
  type: "solar_panel";
  specs: {
    pmaxW: number | null; // Peak power at STC (W) — CRITICAL
    vocV: number | null; // Open-circuit voltage (V) — CRITICAL for series voltage
    vmpV: number | null; // Voltage at max power (V) — CRITICAL for MPPT
    iscA: number | null; // Short-circuit current (A) — CRITICAL for parallel current
    impA: number | null; // Current at max power (A)
    efficiency?: number | null; // % — optional
    vocTempCoefficientPctPerC?: number | null; // e.g., -0.29 %/°C
    impTempCoefficientPctPerC?: number | null;
    pmaxTempCoefficientPctPerC?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    weightKg?: number | null;
    cellType?: string | null; // e.g., "Mono PERC", "Bifacial"
    frameType?: string | null;
    warrantyYears?: number | null;
  };
}

// ─── Inverter ─────────────────────────────────────────────────────────────────

export interface Inverter extends BaseComponent {
  type: "inverter";
  specs: {
    ratedAcOutputW: number | null; // CRITICAL for peak load check
    nominalBatteryVoltageV: number | null; // CRITICAL for battery compat
    maxPvVoltageV: number | null; // CRITICAL for series voltage ceiling
    mpptMinVoltageV: number | null; // CRITICAL for MPPT operating range
    mpptMaxVoltageV: number | null; // CRITICAL for MPPT operating range
    maxPvCurrentA: number | null; // CRITICAL for parallel current check
    maxPvShortCircuitCurrentA?: number | null;
    maxPvPowerW: number | null; // CRITICAL for total array power
    nominalOutputVoltageV?: number | null; // e.g., 230V AC
    outputFrequencyHz?: number | null; // e.g., 50Hz
    inverterType?: string | null; // e.g., "MPPT", "PWM", "Hybrid"
    chargerCurrentA?: number | null; // Battery charge current
  };
}

// ─── Battery ──────────────────────────────────────────────────────────────────

export interface Battery extends BaseComponent {
  type: "battery";
  specs: {
    nominalVoltageV: number | null; // CRITICAL for inverter compat
    capacityAh: number | null; // Ah rating
    capacityKwh: number | null; // CRITICAL for storage check
    continuousDischargePowerW?: number | null; // or use discharge current
    continuousDischargeCurrentA?: number | null;
    chemistry?: string | null; // e.g., "LiFePO4", "Lead-Acid", "AGM"
    dod?: number | null; // Depth of discharge %, e.g., 80
    cycleLife?: number | null;
  };
}

export type Component = SolarPanel | Inverter | Battery;

// ─── Load Requirement ─────────────────────────────────────────────────────────

export type SystemType = "off_grid" | "on_grid" | "hybrid";

export interface LoadRequirement {
  dailyEnergyKwh: number;
  peakLoadKw: number;
  budgetInr: number;
  systemType: SystemType;
  location?: string;
  temperatureMinC?: number; // For conservative Voc calculation
  autonomyDays?: number; // Days of battery backup required, default 1
  assumptions: string[]; // Displayed to user before compilation
}

// ─── Topology ─────────────────────────────────────────────────────────────────

export interface PvArray {
  panelId: string; // references SolarPanel.id
  panel: SolarPanel;
  seriesCount: number; // panels in series per string
  parallelCount: number; // parallel strings
  totalPanels: number; // seriesCount × parallelCount
  // Computed array characteristics
  arrayVoc: number; // seriesCount × panel.specs.vocV
  arrayVmp: number; // seriesCount × panel.specs.vmpV
  arrayIsc: number; // parallelCount × panel.specs.iscA
  arrayPowerW: number; // totalPanels × panel.specs.pmaxW
}

export interface TopologyMetrics {
  totalCostInr: number;
  dailyEnergyKwh: number;
  peakOutputW: number;
  storedEnergyKwh: number; // usable, accounting for DoD
  autonomyDays: number;
  arrayPowerW: number;
  batteryUnitCount: number;
}

export type ConstraintStatus = "passed" | "failed" | "unverified";

export interface ConstraintResult {
  id: string;
  name: string;
  status: ConstraintStatus;
  reason: string;
  evidenceValues: Record<string, number | string | null>;
}

export interface Topology {
  id: string;
  pvArray: PvArray;
  inverterId: string;
  inverter: Inverter;
  batteryId: string;
  battery: Battery;
  batteryUnitCount: number;
  batteryBankVoltageV: number;
  metrics: TopologyMetrics;
  constraints: ConstraintResult[];
  validationStatus: "VALIDATED" | "FAILED" | "UNVERIFIED" | "PARTIAL";
  compiledAt: string; // ISO 8601
  version: number;
  rejectedCandidates: RejectedCandidate[];
}

export interface RejectedCandidate {
  panelId?: string;
  inverterId?: string;
  batteryId?: string;
  reason: string;
  failedConstraint: string;
}

// ─── Compilation ──────────────────────────────────────────────────────────────

export type CompilationStage =
  | "idle"
  | "parsing_requirement"
  | "fetching_components"
  | "validating_constraints"
  | "compiling_topology"
  | "generating_explanation"
  | "complete"
  | "failed";

export interface CompilationProgress {
  stage: CompilationStage;
  panelsFound: number;
  invertersFound: number;
  batteriesFound: number;
  candidatesEvaluated: number;
  candidatesRejected: number;
  validSystemsFound: number;
  warnings: string[];
  error?: string;
}

export interface CompilationResult {
  id: string;
  requirement: LoadRequirement;
  topology: Topology | null;
  progress: CompilationProgress;
  explanation?: string; // Gemini-generated human explanation
  createdAt: string;
}

// ─── Source Health ────────────────────────────────────────────────────────────

export type SourceHealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "HEALING"
  | "VERIFYING"
  | "RECOVERED"
  | "REAL_WORLD_CHANGE"
  | "FAILED";

export interface SourceHealthMetrics {
  totalProducts: number;
  criticalFieldCoverage: {
    voc: number; // 0–1 ratio
    vmp: number;
    isc: number;
    pmax: number;
    price: number;
  };
  schemaValidationFailureRate: number; // 0–1
  lastCheckedAt: string;
}

export interface SourceHealth {
  sourceId: string;
  collectorId: string; // c_xxx
  storeName: string;
  storeUrl: string;
  state: SourceHealthState;
  metrics: SourceHealthMetrics;
  previousMetrics?: SourceHealthMetrics;
  healingJobId?: string;
  lastSuccessfulScrapeAt?: string;
  stateChangedAt: string;
  events: SourceHealthEvent[];
}

export type SourceEventType =
  | "SCRAPE_COMPLETE"
  | "DEGRADATION_DETECTED"
  | "HEALING_INITIATED"
  | "HEALING_PROGRESS"
  | "HEALING_COMPLETE"
  | "VERIFICATION_STARTED"
  | "VERIFICATION_PASSED"
  | "VERIFICATION_FAILED"
  | "REAL_SUPPLY_CHANGE_DETECTED"
  | "SOURCE_RECOVERED"
  | "SOURCE_FAILED";

export interface SourceHealthEvent {
  id: string;
  sourceId: string;
  type: SourceEventType;
  timestamp: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  userId: string;
  name: string;
  requirement: LoadRequirement;
  latestTopology: Topology | null;
  topologyVersions: TopologyVersion[];
  compilationHistory: CompilationResult[];
  createdAt: string;
  updatedAt: string;
}

export interface TopologyVersion {
  version: number;
  topology: Topology;
  changeReason: string; // "Initial compilation" | "Component stockout" | "Source recovered"
  createdAt: string;
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export type SimulationState = "idle" | "running" | "paused";

export interface SimulateState {
  state: SimulationState;
  pvOutputW: number; // Current simulated PV output
  batteryChargePct: number; // 0–100
  loadDrawW: number;
  batteryFlowW: number; // positive = charging, negative = discharging
  flowEdges: string[]; // edge IDs that are currently "active"
  timeOfDay: number; // 0–24 simulated hours
}
