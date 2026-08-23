/**
 * GridForge — Electrical Constraint Solver Unit Tests
 *
 * Tests are written with real-world component spec values.
 * All test data is engineering-accurate (not invented for tests).
 */

import { describe, it, expect } from "vitest";
import {
  checkSeriesVoltage,
  checkMpptRange,
  checkParallelCurrent,
  checkArrayPower,
  checkBatteryCompatibility,
  checkPeakLoad,
  checkStorage,
  checkBudget,
  runAllConstraints,
  calculateCorrectedVoc,
} from "../solar-constraints";
import type { SolarPanel, Inverter, Battery, LoadRequirement } from "../../types";

// ─── Test Fixtures ─────────────────────────────────────────────────────────────
// Using realistic but labeled test data.
// Specs inspired by publicly available datasheets (Loom Solar / Luminous / Amaron).

const makePanel = (overrides: Partial<SolarPanel["specs"]> = {}): SolarPanel => ({
  id: "panel-test-440w",
  type: "solar_panel",
  manufacturer: "Loom Solar",
  model: "Shark 440W",
  source: {
    storeName: "Loom Solar",
    originalUrl: "https://www.loomsolar.com/products/shark-440",
    collectorId: "c_test001",
    scrapeRunId: "run_001",
    scrapedAt: new Date().toISOString(),
  },
  priceInr: 12000,
  currency: "INR",
  availability: "in_stock",
  verificationStatus: "VERIFIED",
  scrapedAt: new Date().toISOString(),
  productUrl: "https://www.loomsolar.com/products/shark-440",
  specs: {
    pmaxW: 440,
    vocV: 49.69,
    vmpV: 41.41,
    iscA: 11.34,
    impA: 10.63,
    vocTempCoefficientPctPerC: -0.29,
    ...overrides,
  },
});

const makeInverter = (overrides: Partial<Inverter["specs"]> = {}): Inverter => ({
  id: "inv-test-3kw",
  type: "inverter",
  manufacturer: "Luminous",
  model: "NXG+ 3.5kVA/48V",
  source: {
    storeName: "Demo Store",
    originalUrl: "https://gridforge-demo.vercel.app/products/luminous-nxg-3500",
    collectorId: "c_demo001",
    scrapeRunId: "run_002",
    scrapedAt: new Date().toISOString(),
  },
  priceInr: 45000,
  currency: "INR",
  availability: "in_stock",
  verificationStatus: "VERIFIED",
  scrapedAt: new Date().toISOString(),
  productUrl: "https://gridforge-demo.vercel.app/products/luminous-nxg-3500",
  specs: {
    ratedAcOutputW: 3000,
    nominalBatteryVoltageV: 48,
    maxPvVoltageV: 150,
    mpptMinVoltageV: 60,
    mpptMaxVoltageV: 115,
    maxPvCurrentA: 25,
    maxPvShortCircuitCurrentA: 30,
    maxPvPowerW: 4500,
    ...overrides,
  },
});

const makeBattery = (overrides: Partial<Battery["specs"]> = {}): Battery => ({
  id: "bat-test-100ah-12v",
  type: "battery",
  manufacturer: "Amaron",
  model: "AAM-CR-0100AH",
  source: {
    storeName: "Demo Store",
    originalUrl: "https://gridforge-demo.vercel.app/products/amaron-100ah",
    collectorId: "c_demo001",
    scrapeRunId: "run_002",
    scrapedAt: new Date().toISOString(),
  },
  priceInr: 12000,
  currency: "INR",
  availability: "in_stock",
  verificationStatus: "VERIFIED",
  scrapedAt: new Date().toISOString(),
  productUrl: "https://gridforge-demo.vercel.app/products/amaron-100ah",
  specs: {
    nominalVoltageV: 12,
    capacityAh: 100,
    capacityKwh: 1.2,
    chemistry: "Lead-Acid AGM",
    dod: 50,
    ...overrides,
  },
});

const makeRequirement = (overrides: Partial<LoadRequirement> = {}): LoadRequirement => ({
  dailyEnergyKwh: 8,
  peakLoadKw: 3,
  budgetInr: 200000,
  systemType: "off_grid",
  location: "India",
  temperatureMinC: 5,
  autonomyDays: 1,
  assumptions: [],
  ...overrides,
});

// ─── calculateCorrectedVoc ────────────────────────────────────────────────────

describe("calculateCorrectedVoc", () => {
  it("increases Voc in cold temperatures when coefficient is negative", () => {
    const panel = makePanel();
    const result = calculateCorrectedVoc(panel, 5); // 5°C min temp
    expect(result).not.toBeNull();
    expect(result!.correctedVocV).toBeGreaterThan(panel.specs.vocV!);
  });

  it("returns null when panel Voc is missing", () => {
    const panel = makePanel({ vocV: null });
    const result = calculateCorrectedVoc(panel, 5);
    expect(result).toBeNull();
  });

  it("uses conservative assumption when coefficient is missing", () => {
    const panel = makePanel({ vocTempCoefficientPctPerC: null });
    const result = calculateCorrectedVoc(panel, 5);
    expect(result).not.toBeNull();
    expect(result!.wasAssumed).toBe(true);
    expect(result!.usedCoefficient).toBe(-0.29);
  });

  it("applies correct formula: Voc_corrected = Voc × (1 + coeff/100 × ΔT)", () => {
    const panel = makePanel({ vocV: 50, vocTempCoefficientPctPerC: -0.3 });
    const result = calculateCorrectedVoc(panel, 5); // ΔT = 5 - 25 = -20
    // expected: 50 × (1 + (-0.3/100) × (-20)) = 50 × (1 + 0.06) = 53
    expect(result!.correctedVocV).toBeCloseTo(53, 1);
  });
});

// ─── checkSeriesVoltage ───────────────────────────────────────────────────────

describe("checkSeriesVoltage", () => {
  it("passes when string voltage is safely below inverter limit", () => {
    const panel = makePanel();
    const inverter = makeInverter({ maxPvVoltageV: 150 });
    // 2 panels: corrected Voc ≈ 50.7V each → string ≈ 101.4V < 150V
    const result = checkSeriesVoltage(panel, inverter, 2, 5);
    expect(result.status).toBe("passed");
  });

  it("fails when string voltage exceeds inverter max PV voltage", () => {
    const panel = makePanel({ vocV: 49.69 });
    const inverter = makeInverter({ maxPvVoltageV: 100 });
    // 3 panels: corrected Voc ≈ 50.7V each → string ≈ 152.1V > 100V
    const result = checkSeriesVoltage(panel, inverter, 3, 5);
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("exceeds");
  });

  it("returns unverified when panel Voc is null", () => {
    const panel = makePanel({ vocV: null });
    const inverter = makeInverter();
    const result = checkSeriesVoltage(panel, inverter, 2, 5);
    expect(result.status).toBe("unverified");
  });

  it("returns unverified when inverter max PV voltage is null", () => {
    const panel = makePanel();
    const inverter = makeInverter({ maxPvVoltageV: null });
    const result = checkSeriesVoltage(panel, inverter, 2, 5);
    expect(result.status).toBe("unverified");
  });

  it("includes evidence values in the result", () => {
    const panel = makePanel();
    const inverter = makeInverter();
    const result = checkSeriesVoltage(panel, inverter, 2, 5);
    expect(result.evidenceValues).toHaveProperty("panelVocSTC");
    expect(result.evidenceValues).toHaveProperty("stringVoc");
    expect(result.evidenceValues).toHaveProperty("inverterMaxPvVoltage");
    expect(result.evidenceValues).toHaveProperty("coefficientSource");
  });
});

// ─── checkMpptRange ───────────────────────────────────────────────────────────

describe("checkMpptRange", () => {
  it("passes when string Vmp is within MPPT range", () => {
    const panel = makePanel({ vmpV: 41.41 });
    const inverter = makeInverter({ mpptMinVoltageV: 60, mpptMaxVoltageV: 115 });
    // 2 panels: Vmp = 82.82V, within [60, 115]
    const result = checkMpptRange(panel, inverter, 2);
    expect(result.status).toBe("passed");
  });

  it("fails when string Vmp is below MPPT minimum", () => {
    const panel = makePanel({ vmpV: 20 });
    const inverter = makeInverter({ mpptMinVoltageV: 60, mpptMaxVoltageV: 115 });
    // 2 panels: Vmp = 40V < 60V minimum
    const result = checkMpptRange(panel, inverter, 2);
    expect(result.status).toBe("failed");
  });

  it("fails when string Vmp is above MPPT maximum", () => {
    const panel = makePanel({ vmpV: 41.41 });
    const inverter = makeInverter({ mpptMinVoltageV: 60, mpptMaxVoltageV: 115 });
    // 3 panels: Vmp = 124.23V > 115V max
    const result = checkMpptRange(panel, inverter, 3);
    expect(result.status).toBe("failed");
  });

  it("returns unverified when Vmp is null", () => {
    const panel = makePanel({ vmpV: null });
    const inverter = makeInverter();
    const result = checkMpptRange(panel, inverter, 2);
    expect(result.status).toBe("unverified");
  });
});

// ─── checkParallelCurrent ─────────────────────────────────────────────────────

describe("checkParallelCurrent", () => {
  it("passes when parallel Isc is within inverter current limit", () => {
    const panel = makePanel({ iscA: 11.34 });
    const inverter = makeInverter({ maxPvCurrentA: 25 });
    // 2 parallel: Isc = 22.68A < 25A
    const result = checkParallelCurrent(panel, inverter, 2);
    expect(result.status).toBe("passed");
  });

  it("fails when parallel Isc exceeds inverter limit", () => {
    const panel = makePanel({ iscA: 11.34 });
    const inverter = makeInverter({ maxPvCurrentA: 20 });
    // 2 parallel: Isc = 22.68A > 20A
    const result = checkParallelCurrent(panel, inverter, 2);
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("exceeds");
  });

  it("returns unverified when Isc is null", () => {
    const panel = makePanel({ iscA: null });
    const inverter = makeInverter();
    const result = checkParallelCurrent(panel, inverter, 2);
    expect(result.status).toBe("unverified");
  });
});

// ─── checkArrayPower ──────────────────────────────────────────────────────────

describe("checkArrayPower", () => {
  it("passes when array power is within inverter PV input limit", () => {
    const panel = makePanel({ pmaxW: 440 });
    const inverter = makeInverter({ maxPvPowerW: 4500 });
    // 6 panels: 2640W < 4500W
    const result = checkArrayPower(panel, inverter, 6);
    expect(result.status).toBe("passed");
  });

  it("fails when array power exceeds inverter limit", () => {
    const panel = makePanel({ pmaxW: 440 });
    const inverter = makeInverter({ maxPvPowerW: 2000 });
    // 6 panels: 2640W > 2000W
    const result = checkArrayPower(panel, inverter, 6);
    expect(result.status).toBe("failed");
  });
});

// ─── checkBatteryCompatibility ────────────────────────────────────────────────

describe("checkBatteryCompatibility", () => {
  it("passes when battery bank voltage matches inverter battery voltage", () => {
    const battery = makeBattery({ nominalVoltageV: 12 });
    const inverter = makeInverter({ nominalBatteryVoltageV: 48 });
    // 4 × 12V batteries = 48V
    const result = checkBatteryCompatibility(battery, inverter, 4);
    expect(result.status).toBe("passed");
  });

  it("fails when battery bank voltage does not match", () => {
    const battery = makeBattery({ nominalVoltageV: 12 });
    const inverter = makeInverter({ nominalBatteryVoltageV: 48 });
    // 3 × 12V = 36V ≠ 48V
    const result = checkBatteryCompatibility(battery, inverter, 3);
    expect(result.status).toBe("failed");
  });

  it("passes for 48V battery with 48V inverter (1 unit)", () => {
    const battery = makeBattery({ nominalVoltageV: 48 });
    const inverter = makeInverter({ nominalBatteryVoltageV: 48 });
    const result = checkBatteryCompatibility(battery, inverter, 1);
    expect(result.status).toBe("passed");
  });
});

// ─── checkPeakLoad ────────────────────────────────────────────────────────────

describe("checkPeakLoad", () => {
  it("passes when inverter output meets peak load requirement", () => {
    const inverter = makeInverter({ ratedAcOutputW: 3000 });
    const req = makeRequirement({ peakLoadKw: 2.5 });
    const result = checkPeakLoad(inverter, req);
    expect(result.status).toBe("passed");
  });

  it("fails when inverter output is insufficient", () => {
    const inverter = makeInverter({ ratedAcOutputW: 2000 });
    const req = makeRequirement({ peakLoadKw: 3 });
    const result = checkPeakLoad(inverter, req);
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("insufficient");
  });

  it("returns unverified when inverter rated output is null", () => {
    const inverter = makeInverter({ ratedAcOutputW: null });
    const req = makeRequirement();
    const result = checkPeakLoad(inverter, req);
    expect(result.status).toBe("unverified");
  });
});

// ─── checkStorage ─────────────────────────────────────────────────────────────

describe("checkStorage", () => {
  it("passes when usable battery storage meets daily energy requirement", () => {
    const battery = makeBattery({ capacityKwh: 1.2, dod: 50 });
    const req = makeRequirement({ dailyEnergyKwh: 8, autonomyDays: 1 });
    // 4 units × 12V × 100Ah × 0.8 system eff = 0.6kWh usable each
    // Need: 4 × 0.6 = 2.4kWh < 8kWh → should fail with 4 units
    // With 16 units: 9.6kWh ≥ 8kWh → pass
    const result = checkStorage(battery, 16, req);
    expect(result.status).toBe("passed");
  });

  it("fails when battery storage is insufficient", () => {
    const battery = makeBattery({ capacityKwh: 1.2, dod: 50 });
    const req = makeRequirement({ dailyEnergyKwh: 8, autonomyDays: 1 });
    // 2 units × 0.6kWh = 1.2kWh < 8kWh
    const result = checkStorage(battery, 2, req);
    expect(result.status).toBe("failed");
  });

  it("returns unverified when battery capacity is null", () => {
    const battery = makeBattery({ capacityKwh: null });
    const req = makeRequirement();
    const result = checkStorage(battery, 4, req);
    expect(result.status).toBe("unverified");
  });

  it("uses 80% DoD assumption when dod field is null", () => {
    const battery = makeBattery({ capacityKwh: 2.0, dod: null });
    const req = makeRequirement({ dailyEnergyKwh: 1.5, autonomyDays: 1 });
    // usable = 2.0 × 0.8 = 1.6kWh ≥ 1.5kWh
    const result = checkStorage(battery, 1, req);
    expect(result.status).toBe("passed");
    expect(result.evidenceValues.dodSource).toContain("Assumed");
  });
});

// ─── checkBudget ──────────────────────────────────────────────────────────────

describe("checkBudget", () => {
  it("passes when total cost is within budget", () => {
    const panel = makePanel();    // ₹12,000 each
    const inverter = makeInverter(); // ₹45,000
    const battery = makeBattery(); // ₹12,000 each
    const req = makeRequirement({ budgetInr: 200000 });
    // 6 panels + 1 inverter + 4 batteries = 72,000 + 45,000 + 48,000 = ₹165,000 < ₹200,000
    const result = checkBudget(panel, inverter, battery, 6, 4, req);
    expect(result.status).toBe("passed");
  });

  it("fails when total cost exceeds budget", () => {
    const panel = makePanel();
    const inverter = makeInverter();
    const battery = makeBattery();
    const req = makeRequirement({ budgetInr: 100000 });
    // 6 panels + 1 inverter + 4 batteries = ₹165,000 > ₹100,000
    const result = checkBudget(panel, inverter, battery, 6, 4, req);
    expect(result.status).toBe("failed");
  });

  it("returns unverified when any price is null", () => {
    const panel = makePanel();
    const inverter = makeInverter();
    const battery = { ...makeBattery(), priceInr: null };
    const req = makeRequirement();
    const result = checkBudget(panel, inverter, battery, 6, 4, req);
    expect(result.status).toBe("unverified");
    expect(result.reason).toContain("battery price");
  });
});

// ─── runAllConstraints ────────────────────────────────────────────────────────

describe("runAllConstraints", () => {
  it("passes all constraints for a valid 2S2P configuration with 4 batteries", () => {
    const panel = makePanel();
    const inverter = makeInverter();
    const battery = makeBattery({ nominalVoltageV: 12, capacityKwh: 2.4, dod: 80 });
    const req = makeRequirement({ dailyEnergyKwh: 5, peakLoadKw: 2.5, budgetInr: 200000 });

    const result = runAllConstraints({
      panel,
      inverter,
      battery,
      seriesCount: 2,
      parallelCount: 2,
      batteryUnitCount: 4,
      requirement: req,
      minTempC: 5,
    });

    expect(result.passed).toBe(true);
    expect(result.failedConstraints).toHaveLength(0);
  });

  it("fails when series count causes voltage to exceed inverter limit", () => {
    const panel = makePanel({ vocV: 49.69 });
    const inverter = makeInverter({ maxPvVoltageV: 100 });
    const battery = makeBattery();
    const req = makeRequirement();

    const result = runAllConstraints({
      panel,
      inverter,
      battery,
      seriesCount: 3, // 3 × ~50.7V corrected = ~152V > 100V
      parallelCount: 1,
      batteryUnitCount: 4,
      requirement: req,
    });

    expect(result.passed).toBe(false);
    expect(result.failedConstraints).toContain("series_voltage");
  });

  it("returns unverified constraints when required fields are missing", () => {
    const panel = makePanel({ vocV: null, vmpV: null });
    const inverter = makeInverter();
    const battery = makeBattery();
    const req = makeRequirement();

    const result = runAllConstraints({
      panel,
      inverter,
      battery,
      seriesCount: 2,
      parallelCount: 2,
      batteryUnitCount: 4,
      requirement: req,
    });

    expect(result.unverifiedConstraints).toContain("series_voltage");
    expect(result.unverifiedConstraints).toContain("mppt_range");
  });
});
