/**
 * GridForge — Deterministic Solar Electrical Constraint Engine
 *
 * PURE FUNCTIONS. No I/O. No randomness. No AI decisions.
 * Every constraint check is auditable and testable.
 *
 * References:
 * - IEC 62548: Design of photovoltaic arrays
 * - Inverter manufacturer specs (MPPT range, max PV voltage, current limits)
 * - NEC 690 (US) / IS 16221 (India) for safety margins
 *
 * Engineering note:
 * Voc increases as temperature DECREASES. Cold weather = higher Voc = voltage risk.
 * If temperature coefficient is unavailable, we use a labeled conservative assumption.
 */

import type {
  SolarPanel,
  Inverter,
  Battery,
  LoadRequirement,
  ConstraintResult,
  PvArray,
} from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Conservative Voc temperature coefficient used when manufacturer value is unavailable.
 * -0.29%/°C is typical for crystalline silicon, per IEC 61215.
 * This assumption is explicitly labeled in constraint evidence.
 */
const CONSERVATIVE_VOC_TEMP_COEFF_PCT_PER_C = -0.29;

/**
 * Standard Test Conditions temperature (25°C per IEC 61215).
 */
const STC_TEMP_C = 25;

/**
 * Default minimum design temperature when not provided.
 * Using 5°C as a conservative default for Indian off-grid use.
 */
const DEFAULT_MIN_TEMP_C = 5;

/**
 * System efficiency factor (wiring losses, inverter efficiency, etc.)
 * Used only for storage/sizing checks, not electrical constraint validation.
 */
const SYSTEM_EFFICIENCY = 0.8;

// ─── Helper: Temperature-corrected Voc ───────────────────────────────────────

export interface VocCorrectionResult {
  correctedVocV: number;
  usedCoefficient: number;
  usedMinTempC: number;
  wasAssumed: boolean; // true if coefficient was assumed, not from datasheet
}

export function calculateCorrectedVoc(
  panel: SolarPanel,
  minTempC: number = DEFAULT_MIN_TEMP_C
): VocCorrectionResult | null {
  if (panel.specs.vocV === null) return null;

  const coefficient =
    panel.specs.vocTempCoefficientPctPerC ?? CONSERVATIVE_VOC_TEMP_COEFF_PCT_PER_C;
  const wasAssumed = panel.specs.vocTempCoefficientPctPerC === null || panel.specs.vocTempCoefficientPctPerC === undefined;

  // ΔT = minTemp - STC (will be negative for cold weather)
  const deltaT = minTempC - STC_TEMP_C;

  // Voc_corrected = Voc_STC × (1 + coefficient/100 × ΔT)
  // coefficient is negative, deltaT is negative in cold weather → product is positive → Voc increases
  const correctedVocV = panel.specs.vocV * (1 + (coefficient / 100) * deltaT);

  return {
    correctedVocV,
    usedCoefficient: coefficient,
    usedMinTempC: minTempC,
    wasAssumed,
  };
}

// ─── Constraint 1: PV Series Voltage ─────────────────────────────────────────

/**
 * seriesCount × corrected_Voc must remain below inverter absolute max PV input voltage.
 * This is the primary safety constraint — overvoltage destroys inverters.
 */
export function checkSeriesVoltage(
  panel: SolarPanel,
  inverter: Inverter,
  seriesCount: number,
  minTempC: number = DEFAULT_MIN_TEMP_C
): ConstraintResult {
  const id = "series_voltage";
  const name = "PV String Open-Circuit Voltage";

  if (panel.specs.vocV === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Panel Voc is missing — cannot verify string voltage safety",
      evidenceValues: { panelVoc: null, seriesCount, inverterMaxPvVoltage: inverter.specs.maxPvVoltageV },
    };
  }

  if (inverter.specs.maxPvVoltageV === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Inverter max PV voltage is missing — cannot verify string voltage safety",
      evidenceValues: { panelVoc: panel.specs.vocV, seriesCount, inverterMaxPvVoltage: null },
    };
  }

  const vocCorrection = calculateCorrectedVoc(panel, minTempC);
  if (!vocCorrection) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Could not compute temperature-corrected Voc",
      evidenceValues: { panelVoc: panel.specs.vocV, seriesCount },
    };
  }

  const stringVoc = seriesCount * vocCorrection.correctedVocV;
  const passed = stringVoc < inverter.specs.maxPvVoltageV;

  return {
    id,
    name,
    status: passed ? "passed" : "failed",
    reason: passed
      ? `String Voc ${stringVoc.toFixed(1)}V < inverter limit ${inverter.specs.maxPvVoltageV}V`
      : `String Voc ${stringVoc.toFixed(1)}V exceeds inverter limit ${inverter.specs.maxPvVoltageV}V — risk of inverter damage`,
    evidenceValues: {
      panelVocSTC: panel.specs.vocV,
      correctedVocPerPanel: parseFloat(vocCorrection.correctedVocV.toFixed(2)),
      seriesCount,
      stringVoc: parseFloat(stringVoc.toFixed(2)),
      inverterMaxPvVoltage: inverter.specs.maxPvVoltageV,
      temperatureMinC: vocCorrection.usedMinTempC,
      coefficientUsed: vocCorrection.usedCoefficient,
      coefficientSource: vocCorrection.wasAssumed ? "Conservative assumption (-0.29%/°C)" : "Manufacturer datasheet",
    },
  };
}

// ─── Constraint 2: MPPT Operating Range ──────────────────────────────────────

/**
 * seriesCount × Vmp must fall within the MPPT operating voltage range.
 * Use STC Vmp (MPPT operates at normal temperature).
 */
export function checkMpptRange(
  panel: SolarPanel,
  inverter: Inverter,
  seriesCount: number
): ConstraintResult {
  const id = "mppt_range";
  const name = "MPPT Operating Voltage";

  if (panel.specs.vmpV === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Panel Vmp is missing — cannot verify MPPT compatibility",
      evidenceValues: { panelVmp: null, seriesCount, mpptMin: inverter.specs.mpptMinVoltageV, mpptMax: inverter.specs.mpptMaxVoltageV },
    };
  }

  if (inverter.specs.mpptMinVoltageV === null || inverter.specs.mpptMaxVoltageV === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Inverter MPPT voltage range is missing — cannot verify compatibility",
      evidenceValues: { panelVmp: panel.specs.vmpV, seriesCount, mpptMin: null, mpptMax: null },
    };
  }

  const stringVmp = seriesCount * panel.specs.vmpV;
  const inRange =
    stringVmp >= inverter.specs.mpptMinVoltageV &&
    stringVmp <= inverter.specs.mpptMaxVoltageV;

  return {
    id,
    name,
    status: inRange ? "passed" : "failed",
    reason: inRange
      ? `String Vmp ${stringVmp.toFixed(1)}V is within MPPT range [${inverter.specs.mpptMinVoltageV}V – ${inverter.specs.mpptMaxVoltageV}V]`
      : `String Vmp ${stringVmp.toFixed(1)}V is outside MPPT range [${inverter.specs.mpptMinVoltageV}V – ${inverter.specs.mpptMaxVoltageV}V]`,
    evidenceValues: {
      panelVmp: panel.specs.vmpV,
      seriesCount,
      stringVmp: parseFloat(stringVmp.toFixed(2)),
      mpptMin: inverter.specs.mpptMinVoltageV,
      mpptMax: inverter.specs.mpptMaxVoltageV,
    },
  };
}

// ─── Constraint 3: Parallel String Current ───────────────────────────────────

/**
 * parallelCount × Isc must not exceed inverter max PV input current.
 * Using Isc (not Imp) for the safety-side current check.
 */
export function checkParallelCurrent(
  panel: SolarPanel,
  inverter: Inverter,
  parallelCount: number
): ConstraintResult {
  const id = "parallel_current";
  const name = "PV Array Short-Circuit Current";

  if (panel.specs.iscA === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Panel Isc is missing — cannot verify current limits",
      evidenceValues: { panelIsc: null, parallelCount, inverterMaxCurrent: inverter.specs.maxPvCurrentA },
    };
  }

  if (inverter.specs.maxPvCurrentA === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Inverter max PV current is missing — cannot verify current limits",
      evidenceValues: { panelIsc: panel.specs.iscA, parallelCount, inverterMaxCurrent: null },
    };
  }

  const arrayIsc = parallelCount * panel.specs.iscA;
  const passed = arrayIsc <= inverter.specs.maxPvCurrentA;

  return {
    id,
    name,
    status: passed ? "passed" : "failed",
    reason: passed
      ? `Array Isc ${arrayIsc.toFixed(1)}A ≤ inverter limit ${inverter.specs.maxPvCurrentA}A`
      : `Array Isc ${arrayIsc.toFixed(1)}A exceeds inverter limit ${inverter.specs.maxPvCurrentA}A`,
    evidenceValues: {
      panelIsc: panel.specs.iscA,
      parallelCount,
      arrayIsc: parseFloat(arrayIsc.toFixed(2)),
      inverterMaxCurrent: inverter.specs.maxPvCurrentA,
    },
  };
}

// ─── Constraint 4: Total Array Power ─────────────────────────────────────────

/**
 * Panel Pmax × total panel count must not exceed inverter's rated max PV input power.
 * Some oversizing tolerance is acceptable but we check against the stated limit.
 */
export function checkArrayPower(
  panel: SolarPanel,
  inverter: Inverter,
  totalPanels: number
): ConstraintResult {
  const id = "array_power";
  const name = "Total PV Array Power";

  if (panel.specs.pmaxW === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Panel Pmax is missing — cannot verify array power",
      evidenceValues: { panelPmax: null, totalPanels, inverterMaxPvPower: inverter.specs.maxPvPowerW },
    };
  }

  if (inverter.specs.maxPvPowerW === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Inverter max PV power is missing — cannot verify array power",
      evidenceValues: { panelPmax: panel.specs.pmaxW, totalPanels, inverterMaxPvPower: null },
    };
  }

  const arrayPowerW = totalPanels * panel.specs.pmaxW;
  const passed = arrayPowerW <= inverter.specs.maxPvPowerW;

  return {
    id,
    name,
    status: passed ? "passed" : "failed",
    reason: passed
      ? `Array power ${(arrayPowerW / 1000).toFixed(2)}kW ≤ inverter PV input limit ${(inverter.specs.maxPvPowerW / 1000).toFixed(2)}kW`
      : `Array power ${(arrayPowerW / 1000).toFixed(2)}kW exceeds inverter PV input limit ${(inverter.specs.maxPvPowerW / 1000).toFixed(2)}kW`,
    evidenceValues: {
      panelPmax: panel.specs.pmaxW,
      totalPanels,
      arrayPowerW: parseFloat(arrayPowerW.toFixed(0)),
      inverterMaxPvPower: inverter.specs.maxPvPowerW,
    },
  };
}

// ─── Constraint 5: Battery–Inverter Voltage Compatibility ────────────────────

/**
 * Battery nominal voltage must match inverter's nominal battery voltage.
 * Battery bank can be series-connected to match voltage.
 */
export function checkBatteryCompatibility(
  battery: Battery,
  inverter: Inverter,
  batteryUnitCount: number
): ConstraintResult {
  const id = "battery_compatibility";
  const name = "Battery–Inverter Voltage Compatibility";

  if (battery.specs.nominalVoltageV === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Battery nominal voltage is missing — cannot verify compatibility",
      evidenceValues: { batteryVoltage: null, inverterBatteryVoltage: inverter.specs.nominalBatteryVoltageV },
    };
  }

  if (inverter.specs.nominalBatteryVoltageV === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Inverter battery voltage is missing — cannot verify compatibility",
      evidenceValues: { batteryVoltage: battery.specs.nominalVoltageV, inverterBatteryVoltage: null },
    };
  }

  // Bank voltage: for parallel config, voltage stays the same; series adds up
  // We determine config: if battery voltage < inverter voltage, they must be in series
  const bankVoltage = battery.specs.nominalVoltageV * batteryUnitCount;
  const compatible = bankVoltage === inverter.specs.nominalBatteryVoltageV;

  return {
    id,
    name,
    status: compatible ? "passed" : "failed",
    reason: compatible
      ? `Battery bank (${batteryUnitCount}× ${battery.specs.nominalVoltageV}V = ${bankVoltage}V) matches inverter battery voltage (${inverter.specs.nominalBatteryVoltageV}V)`
      : `Battery bank voltage (${batteryUnitCount}× ${battery.specs.nominalVoltageV}V = ${bankVoltage}V) does not match inverter battery voltage (${inverter.specs.nominalBatteryVoltageV}V)`,
    evidenceValues: {
      batteryNominalVoltage: battery.specs.nominalVoltageV,
      batteryUnitCount,
      bankVoltage,
      inverterBatteryVoltage: inverter.specs.nominalBatteryVoltageV,
    },
  };
}

// ─── Constraint 6: Peak Load ──────────────────────────────────────────────────

/**
 * Inverter rated AC output must be >= user's required peak load.
 */
export function checkPeakLoad(
  inverter: Inverter,
  requirement: LoadRequirement
): ConstraintResult {
  const id = "peak_load";
  const name = "Peak Load Capacity";

  if (inverter.specs.ratedAcOutputW === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Inverter rated AC output is missing — cannot verify peak load coverage",
      evidenceValues: { inverterRatedOutput: null, requiredPeakLoadW: requirement.peakLoadKw * 1000 },
    };
  }

  const requiredW = requirement.peakLoadKw * 1000;
  const passed = inverter.specs.ratedAcOutputW >= requiredW;

  return {
    id,
    name,
    status: passed ? "passed" : "failed",
    reason: passed
      ? `Inverter output ${(inverter.specs.ratedAcOutputW / 1000).toFixed(1)}kW ≥ required peak load ${requirement.peakLoadKw.toFixed(1)}kW`
      : `Inverter output ${(inverter.specs.ratedAcOutputW / 1000).toFixed(1)}kW is insufficient for required peak load ${requirement.peakLoadKw.toFixed(1)}kW`,
    evidenceValues: {
      inverterRatedOutputW: inverter.specs.ratedAcOutputW,
      requiredPeakLoadW: requiredW,
      marginW: inverter.specs.ratedAcOutputW - requiredW,
    },
  };
}

// ─── Constraint 7: Storage Adequacy ──────────────────────────────────────────

/**
 * Usable battery energy must satisfy autonomy requirement.
 * Usable energy = capacity × DoD factor.
 */
export function checkStorage(
  battery: Battery,
  batteryUnitCount: number,
  requirement: LoadRequirement
): ConstraintResult {
  const id = "storage_adequacy";
  const name = "Battery Storage Adequacy";

  if (battery.specs.capacityKwh === null) {
    return {
      id,
      name,
      status: "unverified",
      reason: "Battery capacity (kWh) is missing — cannot verify storage adequacy",
      evidenceValues: {
        batteryCapacity: null,
        batteryUnitCount,
        requiredKwh: requirement.dailyEnergyKwh * (requirement.autonomyDays ?? 1),
      },
    };
  }

  const dod = battery.specs.dod !== null && battery.specs.dod !== undefined ? battery.specs.dod / 100 : 0.8;
  const usableKwhPerUnit = battery.specs.capacityKwh * dod;
  const totalUsableKwh = usableKwhPerUnit * batteryUnitCount;
  const requiredKwh = requirement.dailyEnergyKwh * (requirement.autonomyDays ?? 1);
  const passed = totalUsableKwh >= requiredKwh;

  return {
    id,
    name,
    status: passed ? "passed" : "failed",
    reason: passed
      ? `Usable storage ${totalUsableKwh.toFixed(1)}kWh (${batteryUnitCount}× ${usableKwhPerUnit.toFixed(1)}kWh usable) ≥ required ${requiredKwh.toFixed(1)}kWh for ${requirement.autonomyDays ?? 1} day(s)`
      : `Usable storage ${totalUsableKwh.toFixed(1)}kWh insufficient — need ${requiredKwh.toFixed(1)}kWh for ${requirement.autonomyDays ?? 1} day(s)`,
    evidenceValues: {
      batteryCapacityKwh: battery.specs.capacityKwh,
      dodFactor: dod,
      usableKwhPerUnit: parseFloat(usableKwhPerUnit.toFixed(2)),
      batteryUnitCount,
      totalUsableKwh: parseFloat(totalUsableKwh.toFixed(2)),
      requiredKwh: parseFloat(requiredKwh.toFixed(2)),
      autonomyDays: requirement.autonomyDays ?? 1,
      dodSource: (battery.specs.dod !== null && battery.specs.dod !== undefined) ? "Manufacturer datasheet" : "Assumed 80% (conservative default)",
    },
  };
}

// ─── Constraint 8: Budget ─────────────────────────────────────────────────────

/**
 * Total current live component cost must not exceed user budget.
 */
export function checkBudget(
  panel: SolarPanel,
  inverter: Inverter,
  battery: Battery,
  totalPanels: number,
  batteryUnitCount: number,
  requirement: LoadRequirement
): ConstraintResult {
  const id = "budget";
  const name = "Total Cost Within Budget";

  const panelCost = panel.priceInr !== null ? panel.priceInr * totalPanels : null;
  const inverterCost = inverter.priceInr;
  const batteryCost = battery.priceInr !== null ? battery.priceInr * batteryUnitCount : null;

  if (panelCost === null || inverterCost === null || batteryCost === null) {
    const missing = [];
    if (panelCost === null) missing.push("panel price");
    if (inverterCost === null) missing.push("inverter price");
    if (batteryCost === null) missing.push("battery price");

    return {
      id,
      name,
      status: "unverified",
      reason: `Cannot verify budget — missing prices: ${missing.join(", ")}`,
      evidenceValues: {
        panelCostInr: panelCost,
        inverterCostInr: inverterCost,
        batteryCostInr: batteryCost,
        budgetInr: requirement.budgetInr,
      },
    };
  }

  const totalCost = panelCost + inverterCost + batteryCost;
  const passed = totalCost <= requirement.budgetInr;

  return {
    id,
    name,
    status: passed ? "passed" : "failed",
    reason: passed
      ? `Total cost ₹${totalCost.toLocaleString("en-IN")} is within budget ₹${requirement.budgetInr.toLocaleString("en-IN")}`
      : `Total cost ₹${totalCost.toLocaleString("en-IN")} exceeds budget ₹${requirement.budgetInr.toLocaleString("en-IN")} by ₹${(totalCost - requirement.budgetInr).toLocaleString("en-IN")}`,
    evidenceValues: {
      panelCostInr: panelCost,
      inverterCostInr: inverterCost,
      batteryCostInr: batteryCost,
      totalCostInr: totalCost,
      budgetInr: requirement.budgetInr,
      surplusInr: requirement.budgetInr - totalCost,
    },
  };
}

// ─── Run All Constraints ──────────────────────────────────────────────────────

export interface RunConstraintsInput {
  panel: SolarPanel;
  inverter: Inverter;
  battery: Battery;
  seriesCount: number;
  parallelCount: number;
  batteryUnitCount: number;
  requirement: LoadRequirement;
  minTempC?: number;
}

export interface RunConstraintsOutput {
  constraints: ConstraintResult[];
  passed: boolean;
  failedConstraints: string[];
  unverifiedConstraints: string[];
}

export function runAllConstraints(input: RunConstraintsInput): RunConstraintsOutput {
  const {
    panel,
    inverter,
    battery,
    seriesCount,
    parallelCount,
    batteryUnitCount,
    requirement,
    minTempC = requirement.temperatureMinC ?? DEFAULT_MIN_TEMP_C,
  } = input;

  const totalPanels = seriesCount * parallelCount;

  const constraints: ConstraintResult[] = [
    checkSeriesVoltage(panel, inverter, seriesCount, minTempC),
    checkMpptRange(panel, inverter, seriesCount),
    checkParallelCurrent(panel, inverter, parallelCount),
    checkArrayPower(panel, inverter, totalPanels),
    checkBatteryCompatibility(battery, inverter, batteryUnitCount),
    checkPeakLoad(inverter, requirement),
    checkStorage(battery, batteryUnitCount, requirement),
    checkBudget(panel, inverter, battery, totalPanels, batteryUnitCount, requirement),
  ];

  const failedConstraints = constraints
    .filter((c) => c.status === "failed")
    .map((c) => c.id);

  const unverifiedConstraints = constraints
    .filter((c) => c.status === "unverified")
    .map((c) => c.id);

  // System is considered "passed" only if all constraints are passed or unverified
  // (unverified constraints don't block compilation but are flagged in UI)
  const passed = failedConstraints.length === 0;

  return {
    constraints,
    passed,
    failedConstraints,
    unverifiedConstraints,
  };
}
