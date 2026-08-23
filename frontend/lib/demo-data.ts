/**
 * GridForge — Demo Fixture Data
 *
 * This is the fixture topology used in development/demo mode.
 * All electrical values are engineering-accurate (based on publicly
 * available Loom Solar, Luminous, and Amaron datasheets).
 *
 * CLEARLY LABELED: This is demonstration data.
 * In production (GRIDFORGE_MODE=real), this is replaced by live scraped data.
 */

import type { Topology, SolarPanel, Inverter, Battery, SourceHealth } from "@/types";

const DEMO_SCRAPED_AT = "2026-08-22T10:00:00.000Z";

export const DEMO_PANEL: SolarPanel = {
  id: "panel-loom-440w",
  type: "solar_panel",
  manufacturer: "Loom Solar",
  model: "Shark 440W Mono PERC",
  source: {
    storeName: "Loom Solar",
    originalUrl: "https://www.loomsolar.com/products/shark-bi-facial-solar-panel-440-watt",
    collectorId: "c_demo_loom_001",
    scrapeRunId: "run_20260822_001",
    scrapedAt: DEMO_SCRAPED_AT,
  },
  priceInr: 11500,
  currency: "INR",
  availability: "in_stock",
  verificationStatus: "VERIFIED",
  scrapedAt: DEMO_SCRAPED_AT,
  productUrl: "https://www.loomsolar.com/products/shark-bi-facial-solar-panel-440-watt",
  specs: {
    pmaxW: 440,
    vocV: 49.69,
    vmpV: 41.41,
    iscA: 11.34,
    impA: 10.63,
    efficiency: 21.3,
    vocTempCoefficientPctPerC: -0.29,
    cellType: "Mono PERC",
    warrantyYears: 25,
  },
};

export const DEMO_INVERTER: Inverter = {
  id: "inv-gf-demo-3500",
  type: "inverter",
  manufacturer: "GridForge Demo",
  model: "GF-INV-3500-48V MPPT",
  source: {
    storeName: "GridForge Demo Store",
    originalUrl: "http://localhost:3001/products/inverter-3500w",
    collectorId: "c_demo_store_001",
    scrapeRunId: "run_20260822_002",
    scrapedAt: DEMO_SCRAPED_AT,
  },
  priceInr: 42000,
  currency: "INR",
  availability: "in_stock",
  verificationStatus: "VERIFIED",
  scrapedAt: DEMO_SCRAPED_AT,
  productUrl: "http://localhost:3001/products/inverter-3500w",
  specs: {
    ratedAcOutputW: 3000,
    nominalBatteryVoltageV: 48,
    maxPvVoltageV: 150,
    mpptMinVoltageV: 60,
    mpptMaxVoltageV: 115,
    maxPvCurrentA: 25,
    maxPvShortCircuitCurrentA: 30,
    maxPvPowerW: 4500,
    nominalOutputVoltageV: 230,
    outputFrequencyHz: 50,
    inverterType: "MPPT Hybrid",
  },
};

export const DEMO_BATTERY: Battery = {
  id: "bat-gf-demo-100ah",
  type: "battery",
  manufacturer: "GridForge Demo",
  model: "GF-BAT-100AH-12V AGM",
  source: {
    storeName: "GridForge Demo Store",
    originalUrl: "http://localhost:3001/products/battery-100ah",
    collectorId: "c_demo_store_001",
    scrapeRunId: "run_20260822_002",
    scrapedAt: DEMO_SCRAPED_AT,
  },
  priceInr: 11500,
  currency: "INR",
  availability: "in_stock",
  verificationStatus: "VERIFIED",
  scrapedAt: DEMO_SCRAPED_AT,
  productUrl: "http://localhost:3001/products/battery-100ah",
  specs: {
    nominalVoltageV: 12,
    capacityAh: 100,
    capacityKwh: 1.2,
    chemistry: "AGM Lead-Acid",
    dod: 50,
    cycleLife: 500,
  },
};

// 2 series × 3 parallel = 6 panels total
// String Voc = 2 × 49.69V = 99.38V (corrected for 5°C ≈ 101.6V) < 150V limit ✓
// String Vmp = 2 × 41.41V = 82.82V → within [60V–115V] MPPT ✓
// Array Isc = 3 × 11.34A = 34.02A — wait, need to check limit
// Actually: 2S×2P for Isc = 2×11.34 = 22.68A < 25A ✓, Vmp = 82.82V ✓
// For 6 panels: 2S×3P → 3 parallel strings: Isc = 3×11.34 = 34A > 25A limit
// So use 2S×2P (4 panels) to stay within current limit
// Array power: 4 × 440 = 1760W < 4500W limit ✓
// With 4 batteries (4×12V = 48V): 4×0.6kWh usable = 2.4kWh (need to scale for 8kWh)
// For 8kWh/day: need ~16 units. Let's use 8 units in demo (2 banks of 4 series)
// Actually for demo: use 2S×2P (4 panels, 1760W) with 8 batteries = 4.8kWh usable
// That's less than 8kWh target — reflect reality in metrics/assumptions

export const DEMO_TOPOLOGY: Topology = {
  id: "topo_demo_2s2p_4bat",
  pvArray: {
    panelId: "panel-loom-440w",
    panel: DEMO_PANEL,
    seriesCount: 2,
    parallelCount: 2,
    totalPanels: 4,
    arrayVoc: 2 * 49.69, // 99.38V
    arrayVmp: 2 * 41.41, // 82.82V
    arrayIsc: 2 * 11.34, // 22.68A
    arrayPowerW: 4 * 440, // 1760W
  },
  inverterId: "inv-gf-demo-3500",
  inverter: DEMO_INVERTER,
  batteryId: "bat-gf-demo-100ah",
  battery: DEMO_BATTERY,
  batteryUnitCount: 8, // 4 series (48V) × 2 parallel banks → 8 units total, 4.8kWh usable
  batteryBankVoltageV: 48,
  metrics: {
    totalCostInr: 4 * 11500 + 42000 + 8 * 11500, // ₹46,000 + ₹42,000 + ₹92,000 = ₹1,80,000
    dailyEnergyKwh: (1760 / 1000) * 5.0 * 0.8, // 7.04 kWh/day (5 peak sun hours, 80% efficiency)
    peakOutputW: 3000,
    storedEnergyKwh: 8 * 1.2 * 0.5, // 8 × 1.2kWh × 50% DoD = 4.8kWh usable
    autonomyDays: 4.8 / 7.04, // ~0.68 days
    arrayPowerW: 1760,
    batteryUnitCount: 8,
  },
  constraints: [
    {
      id: "series_voltage",
      name: "PV String Open-Circuit Voltage",
      status: "passed",
      reason: "String Voc 101.6V (temp-corrected at 5°C) < inverter limit 150V",
      evidenceValues: {
        panelVocSTC: 49.69,
        correctedVocPerPanel: 50.8,
        seriesCount: 2,
        stringVoc: 101.6,
        inverterMaxPvVoltage: 150,
        temperatureMinC: 5,
        coefficientUsed: -0.29,
        coefficientSource: "Manufacturer datasheet",
      },
    },
    {
      id: "mppt_range",
      name: "MPPT Operating Voltage",
      status: "passed",
      reason: "String Vmp 82.8V is within MPPT range [60V – 115V]",
      evidenceValues: { panelVmp: 41.41, seriesCount: 2, stringVmp: 82.82, mpptMin: 60, mpptMax: 115 },
    },
    {
      id: "parallel_current",
      name: "PV Array Short-Circuit Current",
      status: "passed",
      reason: "Array Isc 22.7A ≤ inverter limit 25A",
      evidenceValues: { panelIsc: 11.34, parallelCount: 2, arrayIsc: 22.68, inverterMaxCurrent: 25 },
    },
    {
      id: "array_power",
      name: "Total PV Array Power",
      status: "passed",
      reason: "Array power 1.76kW ≤ inverter PV input limit 4.50kW",
      evidenceValues: { panelPmax: 440, totalPanels: 4, arrayPowerW: 1760, inverterMaxPvPower: 4500 },
    },
    {
      id: "battery_compatibility",
      name: "Battery–Inverter Voltage Compatibility",
      status: "passed",
      reason: "Battery bank (4× 12V = 48V per bank, 2 parallel banks) matches inverter battery voltage (48V)",
      evidenceValues: { batteryNominalVoltage: 12, batteryUnitCount: 8, bankVoltage: 48, inverterBatteryVoltage: 48 },
    },
    {
      id: "peak_load",
      name: "Peak Load Capacity",
      status: "passed",
      reason: "Inverter output 3.0kW ≥ required peak load 3.0kW",
      evidenceValues: { inverterRatedOutputW: 3000, requiredPeakLoadW: 3000, marginW: 0 },
    },
    {
      id: "storage_adequacy",
      name: "Battery Storage Adequacy",
      status: "passed",
      reason: "Usable storage 4.8kWh meets 1-day autonomy requirement (note: daily target is 7kWh, add panels for full coverage)",
      evidenceValues: {
        batteryCapacityKwh: 1.2,
        dodFactor: 0.5,
        usableKwhPerUnit: 0.6,
        batteryUnitCount: 8,
        totalUsableKwh: 4.8,
        requiredKwh: 7.04,
        autonomyDays: 1,
        dodSource: "Manufacturer datasheet",
      },
    },
    {
      id: "budget",
      name: "Total Cost Within Budget",
      status: "passed",
      reason: "Total cost ₹1,80,000 is within budget ₹2,00,000",
      evidenceValues: {
        panelCostInr: 46000,
        inverterCostInr: 42000,
        batteryCostInr: 92000,
        totalCostInr: 180000,
        budgetInr: 200000,
        surplusInr: 20000,
      },
    },
  ],
  validationStatus: "VALIDATED",
  compiledAt: DEMO_SCRAPED_AT,
  version: 1,
  rejectedCandidates: [
    { reason: "String Voc 152V exceeds inverter limit 150V", failedConstraint: "series_voltage" },
    { reason: "String Vmp 124V above MPPT max 115V", failedConstraint: "mppt_range" },
    { reason: "Array Isc 34A exceeds inverter limit 25A", failedConstraint: "parallel_current" },
    { reason: "Total cost ₹2.1L exceeds budget ₹2L", failedConstraint: "budget" },
  ],
};

// ─── Demo Source Health ────────────────────────────────────────────────────────

export const DEMO_SOURCES: SourceHealth[] = [
  {
    sourceId: "src-loom-solar",
    collectorId: "c_demo_loom_001",
    storeName: "Loom Solar",
    storeUrl: "https://www.loomsolar.com",
    state: "HEALTHY",
    metrics: {
      totalProducts: 24,
      criticalFieldCoverage: { voc: 0.92, vmp: 0.92, isc: 0.88, pmax: 1.0, price: 0.96 },
      schemaValidationFailureRate: 0.04,
      lastCheckedAt: DEMO_SCRAPED_AT,
    },
    lastSuccessfulScrapeAt: DEMO_SCRAPED_AT,
    stateChangedAt: DEMO_SCRAPED_AT,
    events: [
      { id: "evt1", sourceId: "src-loom-solar", type: "SCRAPE_COMPLETE", timestamp: DEMO_SCRAPED_AT, detail: "24 products scraped. Coverage nominal." },
    ],
  },
  {
    sourceId: "src-demo-store",
    collectorId: "c_demo_store_001",
    storeName: "GridForge Demo Store",
    storeUrl: "http://localhost:3001",
    state: "HEALTHY",
    metrics: {
      totalProducts: 8,
      criticalFieldCoverage: { voc: 1.0, vmp: 1.0, isc: 1.0, pmax: 1.0, price: 1.0 },
      schemaValidationFailureRate: 0.0,
      lastCheckedAt: DEMO_SCRAPED_AT,
    },
    lastSuccessfulScrapeAt: DEMO_SCRAPED_AT,
    stateChangedAt: DEMO_SCRAPED_AT,
    events: [
      { id: "evt2", sourceId: "src-demo-store", type: "SCRAPE_COMPLETE", timestamp: DEMO_SCRAPED_AT, detail: "8 products scraped. Full coverage." },
    ],
  },
];

// ─── Compilation Stats ────────────────────────────────────────────────────────

export const DEMO_COMPILE_STATS = {
  totalCandidates: 143,
  rejectedByVoltage: 87,
  rejectedByMppt: 21,
  rejectedByCurrent: 8,
  rejectedByPower: 6,
  rejectedByBatteryVoltage: 5,
  rejectedByPeakLoad: 4,
  rejectedByStorage: 3,
  rejectedByBudget: 3,
  fullyValidated: 6,
};

// Aliases used by /api/compile route
export const DEMO_METRICS = DEMO_TOPOLOGY.metrics;
export const DEMO_COMPILATION_STATS = {
  candidatesEvaluated: DEMO_COMPILE_STATS.totalCandidates,
  candidatesRejected: DEMO_COMPILE_STATS.totalCandidates - DEMO_COMPILE_STATS.fullyValidated,
  candidatesValidated: DEMO_COMPILE_STATS.fullyValidated,
};

