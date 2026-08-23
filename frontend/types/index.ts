/**
 * GridForge — Frontend Types
 * Mirror of backend domain types for use in React components.
 * Kept in sync manually; will be shared via package in production.
 */

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "PARTIAL";
export type ComponentType = "solar_panel" | "inverter" | "battery";
export type ConstraintStatus = "passed" | "failed" | "unverified";
export type SourceHealthState =
  | "HEALTHY" | "DEGRADED" | "HEALING" | "VERIFYING"
  | "RECOVERED" | "REAL_WORLD_CHANGE" | "FAILED";

export interface ScrapedSourceMeta {
  storeName: string;
  originalUrl: string;
  collectorId: string;
  scrapeRunId: string;
  scrapedAt: string;
}

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
  scrapedAt: string;
  imageUrl?: string;
  productUrl: string;
}

export interface SolarPanel extends BaseComponent {
  type: "solar_panel";
  specs: {
    pmaxW: number | null;
    vocV: number | null;
    vmpV: number | null;
    iscA: number | null;
    impA: number | null;
    efficiency?: number | null;
    vocTempCoefficientPctPerC?: number | null;
    cellType?: string | null;
    warrantyYears?: number | null;
  };
}

export interface Inverter extends BaseComponent {
  type: "inverter";
  specs: {
    ratedAcOutputW: number | null;
    nominalBatteryVoltageV: number | null;
    maxPvVoltageV: number | null;
    mpptMinVoltageV: number | null;
    mpptMaxVoltageV: number | null;
    maxPvCurrentA: number | null;
    maxPvShortCircuitCurrentA?: number | null;
    maxPvPowerW: number | null;
    nominalOutputVoltageV?: number | null;
    outputFrequencyHz?: number | null;
    inverterType?: string | null;
  };
}

export interface Battery extends BaseComponent {
  type: "battery";
  specs: {
    nominalVoltageV: number | null;
    capacityAh: number | null;
    capacityKwh: number | null;
    continuousDischargePowerW?: number | null;
    chemistry?: string | null;
    dod?: number | null;
    cycleLife?: number | null;
  };
}

export type Component = SolarPanel | Inverter | Battery;

export interface ConstraintResult {
  id: string;
  name: string;
  status: ConstraintStatus;
  reason: string;
  evidenceValues: Record<string, number | string | null>;
}

export interface PvArray {
  panelId: string;
  panel: SolarPanel;
  seriesCount: number;
  parallelCount: number;
  totalPanels: number;
  arrayVoc: number;
  arrayVmp: number;
  arrayIsc: number;
  arrayPowerW: number;
}

export interface TopologyMetrics {
  totalCostInr: number;
  dailyEnergyKwh: number;
  peakOutputW: number;
  storedEnergyKwh: number;
  autonomyDays: number;
  arrayPowerW: number;
  batteryUnitCount: number;
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
  compiledAt: string;
  version: number;
  rejectedCandidates: Array<{ panelId?: string; inverterId?: string; batteryId?: string; reason: string; failedConstraint: string }>;
}

export interface SourceHealthEvent {
  id: string;
  sourceId: string;
  type: string;
  timestamp: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface SourceHealth {
  sourceId: string;
  collectorId: string;
  storeName: string;
  storeUrl: string;
  state: SourceHealthState;
  metrics: {
    totalProducts: number;
    criticalFieldCoverage: { voc: number; vmp: number; isc: number; pmax: number; price: number };
    schemaValidationFailureRate: number;
    lastCheckedAt: string;
  };
  lastSuccessfulScrapeAt?: string;
  stateChangedAt: string;
  events: SourceHealthEvent[];
}

export type SimulationState = "idle" | "running" | "paused";

export interface SimulateState {
  state: SimulationState;
  pvOutputW: number;
  batteryChargePct: number;
  loadDrawW: number;
  batteryFlowW: number;
  flowEdges: string[];
  timeOfDay: number;
}
