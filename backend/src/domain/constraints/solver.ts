/**
 * GridForge — Topology Compiler / Optimizer
 *
 * Given candidate components and user requirements, searches feasible
 * combinations using deterministic pruning and selects the optimal system.
 *
 * NO AI. NO RANDOMNESS. Pure enumeration with constraint-based pruning.
 * Every rejection reason is recorded for auditability.
 */

import type {
  SolarPanel,
  Inverter,
  Battery,
  LoadRequirement,
  Topology,
  PvArray,
  TopologyMetrics,
  RejectedCandidate,
} from "../types";
import {
  runAllConstraints,
  calculateCorrectedVoc,
} from "./solar-constraints";

// ─── Search Bounds ────────────────────────────────────────────────────────────

const MAX_SERIES = 6;
const MAX_PARALLEL = 4;
const MAX_BATTERY_UNITS = 8;
const MIN_ARRAY_POWER_FACTOR = 0.8; // Array must produce at least 80% of required daily energy per peak sun hour

// ─── Peak Sun Hours (India default) ──────────────────────────────────────────

const DEFAULT_PEAK_SUN_HOURS = 5.0; // Conservative average for India

// ─── Compiler Input / Output ──────────────────────────────────────────────────

export interface CompilerInput {
  panels: SolarPanel[];
  inverters: Inverter[];
  batteries: Battery[];
  requirement: LoadRequirement;
  minTempC?: number;
  peakSunHours?: number;
}

export interface CompilerResult {
  topology: Topology | null;
  stats: {
    totalCandidates: number;
    rejectedByVoltage: number;
    rejectedByMppt: number;
    rejectedByCurrent: number;
    rejectedByPower: number;
    rejectedByBatteryVoltage: number;
    rejectedByPeakLoad: number;
    rejectedByStorage: number;
    rejectedByBudget: number;
    fullyValidated: number;
  };
  rejectedCandidates: RejectedCandidate[];
  candidateRankings: CandidateTopology[];
}

interface CandidateTopology {
  panel: SolarPanel;
  inverter: Inverter;
  battery: Battery;
  seriesCount: number;
  parallelCount: number;
  batteryUnitCount: number;
  totalCostInr: number | null;
  verificationScore: number; // 0–1
  failedConstraints: string[];
  unverifiedConstraints: string[];
  topology: Topology;
}

// ─── Build PvArray ────────────────────────────────────────────────────────────

function buildPvArray(
  panel: SolarPanel,
  seriesCount: number,
  parallelCount: number
): PvArray {
  const totalPanels = seriesCount * parallelCount;
  return {
    panelId: panel.id,
    panel,
    seriesCount,
    parallelCount,
    totalPanels,
    arrayVoc: panel.specs.vocV !== null ? seriesCount * panel.specs.vocV : 0,
    arrayVmp: panel.specs.vmpV !== null ? seriesCount * panel.specs.vmpV : 0,
    arrayIsc: panel.specs.iscA !== null ? parallelCount * panel.specs.iscA : 0,
    arrayPowerW: panel.specs.pmaxW !== null ? totalPanels * panel.specs.pmaxW : 0,
  };
}

// ─── Compute Metrics ──────────────────────────────────────────────────────────

function computeMetrics(
  panel: SolarPanel,
  inverter: Inverter,
  battery: Battery,
  seriesCount: number,
  parallelCount: number,
  batteryUnitCount: number,
  peakSunHours: number
): TopologyMetrics {
  const totalPanels = seriesCount * parallelCount;
  const arrayPowerW = panel.specs.pmaxW !== null ? totalPanels * panel.specs.pmaxW : 0;
  const dailyEnergyKwh = (arrayPowerW / 1000) * peakSunHours * 0.8; // 0.8 system efficiency
  const dod = battery.specs.dod !== null && battery.specs.dod !== undefined ? battery.specs.dod / 100 : 0.8;
  const storedEnergyKwh =
    battery.specs.capacityKwh !== null
      ? battery.specs.capacityKwh * dod * batteryUnitCount
      : 0;

  const panelCost = panel.priceInr !== null ? panel.priceInr * totalPanels : 0;
  const inverterCost = inverter.priceInr ?? 0;
  const batteryCost = battery.priceInr !== null ? battery.priceInr * batteryUnitCount : 0;
  const totalCostInr = panelCost + inverterCost + batteryCost;

  const bankVoltage =
    battery.specs.nominalVoltageV !== null
      ? battery.specs.nominalVoltageV * batteryUnitCount
      : 0;

  const autonomyDays =
    dailyEnergyKwh > 0 ? storedEnergyKwh / dailyEnergyKwh : 0;

  return {
    totalCostInr,
    dailyEnergyKwh,
    peakOutputW: inverter.specs.ratedAcOutputW ?? 0,
    storedEnergyKwh,
    autonomyDays,
    arrayPowerW,
    batteryUnitCount,
  };
}

// ─── Determine Battery Bank Count ─────────────────────────────────────────────

/**
 * Find the number of battery units needed such that:
 * 1. Bank voltage matches inverter battery voltage
 * 2. Storage meets the autonomy requirement
 */
function findBatteryUnitCount(
  battery: Battery,
  inverter: Inverter,
  requirement: LoadRequirement
): number[] {
  if (battery.specs.nominalVoltageV === null || inverter.specs.nominalBatteryVoltageV === null) {
    // Can't determine — try unit counts 1–8 and let constraint engine reject
    return [1, 2, 3, 4];
  }

  const battV = battery.specs.nominalVoltageV;
  const invV = inverter.specs.nominalBatteryVoltageV;

  // Find series count that matches inverter battery voltage
  const seriesForVoltage = invV / battV;

  // Must be integer
  if (!Number.isInteger(seriesForVoltage) || seriesForVoltage < 1 || seriesForVoltage > MAX_BATTERY_UNITS) {
    return []; // No valid integer series count for voltage matching
  }

  // Now find how many banks we need for storage
  const dod = battery.specs.dod !== null && battery.specs.dod !== undefined ? battery.specs.dod / 100 : 0.8;
  const usablePerUnit = battery.specs.capacityKwh !== null ? battery.specs.capacityKwh * dod : null;

  if (usablePerUnit === null) {
    // Try base series count for voltage, and up to 4 parallel banks
    return [seriesForVoltage, seriesForVoltage * 2, seriesForVoltage * 3, seriesForVoltage * 4];
  }

  const requiredKwh = requirement.dailyEnergyKwh * (requirement.autonomyDays ?? 1);
  const minUnitsForStorage = Math.ceil(requiredKwh / usablePerUnit);

  // Round up to next multiple of seriesForVoltage (to maintain voltage)
  const minUnitsRounded =
    Math.ceil(minUnitsForStorage / seriesForVoltage) * seriesForVoltage;

  // Return this and a few higher options
  const candidates = [];
  for (let multiplier = 1; multiplier <= 4; multiplier++) {
    const count = minUnitsRounded * multiplier;
    if (count <= MAX_BATTERY_UNITS) {
      candidates.push(count);
    }
  }

  return candidates.length > 0 ? candidates : [seriesForVoltage];
}

// ─── Compute Verification Score ───────────────────────────────────────────────

function computeVerificationScore(
  panel: SolarPanel,
  inverter: Inverter,
  battery: Battery
): number {
  const criticalFields = [
    panel.specs.pmaxW,
    panel.specs.vocV,
    panel.specs.vmpV,
    panel.specs.iscA,
    inverter.specs.ratedAcOutputW,
    inverter.specs.nominalBatteryVoltageV,
    inverter.specs.maxPvVoltageV,
    inverter.specs.mpptMinVoltageV,
    inverter.specs.mpptMaxVoltageV,
    inverter.specs.maxPvCurrentA,
    inverter.specs.maxPvPowerW,
    battery.specs.nominalVoltageV,
    battery.specs.capacityKwh,
    panel.priceInr,
    inverter.priceInr,
    battery.priceInr,
  ];

  const present = criticalFields.filter((f) => f !== null && f !== undefined).length;
  return present / criticalFields.length;
}

// ─── Generate Topology ID ─────────────────────────────────────────────────────

function generateTopologyId(
  panelId: string,
  inverterId: string,
  batteryId: string,
  seriesCount: number,
  parallelCount: number,
  batteryUnitCount: number
): string {
  return `topo_${panelId}_${inverterId}_${batteryId}_${seriesCount}s${parallelCount}p_${batteryUnitCount}b`;
}

// ─── Main Compiler ────────────────────────────────────────────────────────────

export function compileTopology(input: CompilerInput): CompilerResult {
  const {
    panels,
    inverters,
    batteries,
    requirement,
    minTempC = requirement.temperatureMinC ?? 5,
    peakSunHours = DEFAULT_PEAK_SUN_HOURS,
  } = input;

  const stats = {
    totalCandidates: 0,
    rejectedByVoltage: 0,
    rejectedByMppt: 0,
    rejectedByCurrent: 0,
    rejectedByPower: 0,
    rejectedByBatteryVoltage: 0,
    rejectedByPeakLoad: 0,
    rejectedByStorage: 0,
    rejectedByBudget: 0,
    fullyValidated: 0,
  };

  const rejectedCandidates: RejectedCandidate[] = [];
  const validCandidates: CandidateTopology[] = [];

  for (const panel of panels) {
    for (const inverter of inverters) {
      for (const battery of batteries) {
        // Get feasible battery unit counts for this combination
        const batteryUnitCounts = findBatteryUnitCount(battery, inverter, requirement);

        for (const batteryUnitCount of batteryUnitCounts) {
          for (let series = 1; series <= MAX_SERIES; series++) {
            for (let parallel = 1; parallel <= MAX_PARALLEL; parallel++) {
              stats.totalCandidates++;

              const result = runAllConstraints({
                panel,
                inverter,
                battery,
                seriesCount: series,
                parallelCount: parallel,
                batteryUnitCount,
                requirement,
                minTempC,
              });

              if (!result.passed) {
                // Track rejection stats by first failed constraint
                const firstFailed = result.failedConstraints[0];
                if (firstFailed === "series_voltage") stats.rejectedByVoltage++;
                else if (firstFailed === "mppt_range") stats.rejectedByMppt++;
                else if (firstFailed === "parallel_current") stats.rejectedByCurrent++;
                else if (firstFailed === "array_power") stats.rejectedByPower++;
                else if (firstFailed === "battery_compatibility") stats.rejectedByBatteryVoltage++;
                else if (firstFailed === "peak_load") stats.rejectedByPeakLoad++;
                else if (firstFailed === "storage_adequacy") stats.rejectedByStorage++;
                else if (firstFailed === "budget") stats.rejectedByBudget++;

                rejectedCandidates.push({
                  panelId: panel.id,
                  inverterId: inverter.id,
                  batteryId: battery.id,
                  reason: result.constraints
                    .filter((c) => c.status === "failed")
                    .map((c) => c.reason)
                    .join("; "),
                  failedConstraint: firstFailed ?? "unknown",
                });
                continue;
              }

              const totalPanels = series * parallel;
              const metrics = computeMetrics(
                panel,
                inverter,
                battery,
                series,
                parallel,
                batteryUnitCount,
                peakSunHours
              );
              const verificationScore = computeVerificationScore(panel, inverter, battery);
              const pvArray = buildPvArray(panel, series, parallel);
              const bankVoltage =
                battery.specs.nominalVoltageV !== null
                  ? battery.specs.nominalVoltageV * batteryUnitCount
                  : 0;

              const topology: Topology = {
                id: generateTopologyId(panel.id, inverter.id, battery.id, series, parallel, batteryUnitCount),
                pvArray,
                inverterId: inverter.id,
                inverter,
                batteryId: battery.id,
                battery,
                batteryUnitCount,
                batteryBankVoltageV: bankVoltage,
                metrics,
                constraints: result.constraints,
                validationStatus: result.unverifiedConstraints.length > 0
                  ? "PARTIAL"
                  : "VALIDATED",
                compiledAt: new Date().toISOString(),
                version: 1,
                rejectedCandidates: [],
              };

              const totalCostInr =
                panel.priceInr !== null &&
                inverter.priceInr !== null &&
                battery.priceInr !== null
                  ? panel.priceInr * totalPanels +
                    inverter.priceInr +
                    battery.priceInr * batteryUnitCount
                  : null;

              validCandidates.push({
                panel,
                inverter,
                battery,
                seriesCount: series,
                parallelCount: parallel,
                batteryUnitCount,
                totalCostInr,
                verificationScore,
                failedConstraints: result.failedConstraints,
                unverifiedConstraints: result.unverifiedConstraints,
                topology,
              });
              stats.fullyValidated++;
            }
          }
        }
      }
    }
  }

  // ── Selection Strategy ──────────────────────────────────────────────────────
  //
  // PRIMARY: Prefer VALIDATED over PARTIAL
  // SECONDARY: Minimize total cost
  // TIEBREAKER 1: Prefer fewer unverified constraints
  // TIEBREAKER 2: Prefer higher verification score
  // TIEBREAKER 3: Prefer fewer total components

  const sortedCandidates = validCandidates.sort((a, b) => {
    // 1. VALIDATED preferred over PARTIAL
    const aValidated = a.unverifiedConstraints.length === 0 ? 0 : 1;
    const bValidated = b.unverifiedConstraints.length === 0 ? 0 : 1;
    if (aValidated !== bValidated) return aValidated - bValidated;

    // 2. Prefer lowest cost (null costs go last)
    if (a.totalCostInr !== null && b.totalCostInr !== null) {
      if (a.totalCostInr !== b.totalCostInr) return a.totalCostInr - b.totalCostInr;
    } else if (a.totalCostInr !== null) return -1;
    else if (b.totalCostInr !== null) return 1;

    // 3. Fewer unverified constraints
    if (a.unverifiedConstraints.length !== b.unverifiedConstraints.length) {
      return a.unverifiedConstraints.length - b.unverifiedConstraints.length;
    }

    // 4. Higher verification score
    if (b.verificationScore !== a.verificationScore) {
      return b.verificationScore - a.verificationScore;
    }

    // 5. Fewer total components
    const aComponents = a.seriesCount * a.parallelCount + a.batteryUnitCount;
    const bComponents = b.seriesCount * b.parallelCount + b.batteryUnitCount;
    return aComponents - bComponents;
  });

  const bestCandidate = sortedCandidates[0] ?? null;

  // Attach top-level rejection stats to best topology
  if (bestCandidate) {
    bestCandidate.topology.rejectedCandidates = rejectedCandidates.slice(0, 20); // store first 20 for UI
  }

  return {
    topology: bestCandidate?.topology ?? null,
    stats,
    rejectedCandidates,
    candidateRankings: sortedCandidates.slice(0, 10), // top 10 for UI
  };
}
