import type { Battery, ConstraintResult, Inverter, SolarPanel, Topology } from '@/types'
import type { StructuredRequirement } from './gemini'
import type { CatalogResult, NormalizedComponent } from './catalog'

/**
 * Deterministic deployed compiler used by Live Mode.
 *
 * This module intentionally contains no LLM calls and no guessed electrical
 * values. A candidate is considered VALIDATED only when every required value
 * came from the live Bright Data catalog and every constraint passes.
 */

const STC_TEMP_C = 25
const DEFAULT_MIN_TEMP_C = 5
const DEFAULT_PEAK_SUN_HOURS = 5
const SYSTEM_EFFICIENCY = 0.8
const MAX_PV_SERIES = 6
const MAX_PV_PARALLEL = 4
const MAX_BATTERY_PARALLEL_BANKS = 6

export interface LiveCompilerStats {
  totalCandidates: number
  rejectedByVoltage: number
  rejectedByMppt: number
  rejectedByCurrent: number
  rejectedByPower: number
  rejectedByGeneration: number
  rejectedByBatteryVoltage: number
  rejectedByPeakLoad: number
  rejectedByStorage: number
  rejectedByBudget: number
  fullyValidated: number
}

export interface LiveCompilerResult {
  topology: Topology | null
  stats: LiveCompilerStats
  rejectedCandidates: Array<{
    panelId?: string
    inverterId?: string
    batteryId?: string
    reason: string
    failedConstraint: string
  }>
  assumptions: string[]
}

export class LiveRequirementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LiveRequirementError'
  }
}

function requiredPositive(value: number | null | undefined, label: string): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new LiveRequirementError(`${label} is required for Live Mode. Please provide it explicitly.`)
  }
  return value
}

function componentId(catalog: CatalogResult, component: NormalizedComponent): string {
  return `${catalog.collectorId}:${component.externalProductId ?? component.model ?? component.componentType}`
}

function sourceMeta(catalog: CatalogResult, component: NormalizedComponent) {
  const originalUrl = component.originalUrl ?? catalog.sourceUrl
  return {
    storeName: catalog.sourceName,
    originalUrl,
    collectorId: catalog.collectorId,
    scrapeRunId: catalog.scrapeRunId,
    scrapedAt: catalog.scrapedAt,
  }
}

function toPanel(catalog: CatalogResult, component: NormalizedComponent): SolarPanel {
  const originalUrl = component.originalUrl ?? catalog.sourceUrl
  return {
    id: componentId(catalog, component),
    type: 'solar_panel',
    manufacturer: component.manufacturer ?? 'Unknown manufacturer',
    model: component.model ?? component.externalProductId ?? 'Unknown model',
    source: sourceMeta(catalog, component),
    priceInr: component.priceInr,
    currency: 'INR',
    availability: component.availability ?? 'unknown',
    verificationStatus: component.verificationStatus,
    scrapedAt: catalog.scrapedAt,
    productUrl: originalUrl,
    specs: {
      pmaxW: component.pmaxW,
      vocV: component.vocV,
      vmpV: component.vmpV,
      iscA: component.iscA,
      impA: component.impA,
      efficiency: component.efficiencyPct,
      vocTempCoefficientPctPerC: component.vocTempCoeffPctPerC,
      cellType: component.cellType,
    },
  }
}

function toInverter(catalog: CatalogResult, component: NormalizedComponent): Inverter {
  const originalUrl = component.originalUrl ?? catalog.sourceUrl
  return {
    id: componentId(catalog, component),
    type: 'inverter',
    manufacturer: component.manufacturer ?? 'Unknown manufacturer',
    model: component.model ?? component.externalProductId ?? 'Unknown model',
    source: sourceMeta(catalog, component),
    priceInr: component.priceInr,
    currency: 'INR',
    availability: component.availability ?? 'unknown',
    verificationStatus: component.verificationStatus,
    scrapedAt: catalog.scrapedAt,
    productUrl: originalUrl,
    specs: {
      ratedAcOutputW: component.acOutputW,
      nominalBatteryVoltageV: component.batteryVoltageV,
      maxPvVoltageV: component.maxPvVoltageV,
      mpptMinVoltageV: component.mpptMinV,
      mpptMaxVoltageV: component.mpptMaxV,
      maxPvCurrentA: component.maxPvCurrentA,
      maxPvPowerW: component.maxPvPowerW,
      nominalOutputVoltageV: 230,
      outputFrequencyHz: 50,
      inverterType: 'MPPT / hybrid',
    },
  }
}

function toBattery(catalog: CatalogResult, component: NormalizedComponent): Battery {
  const originalUrl = component.originalUrl ?? catalog.sourceUrl
  return {
    id: componentId(catalog, component),
    type: 'battery',
    manufacturer: component.manufacturer ?? 'Unknown manufacturer',
    model: component.model ?? component.externalProductId ?? 'Unknown model',
    source: sourceMeta(catalog, component),
    priceInr: component.priceInr,
    currency: 'INR',
    availability: component.availability ?? 'unknown',
    verificationStatus: component.verificationStatus,
    scrapedAt: catalog.scrapedAt,
    productUrl: originalUrl,
    specs: {
      nominalVoltageV: component.nominalVoltageV,
      capacityAh: component.capacityAh,
      capacityKwh: component.capacityKwh,
      chemistry: component.chemistry,
      dod: component.dodPct,
      cycleLife: component.cycleLife,
    },
  }
}

function pass(id: string, name: string, reason: string, evidenceValues: Record<string, number | string | null>): ConstraintResult {
  return { id, name, status: 'passed', reason, evidenceValues }
}

function fail(id: string, name: string, reason: string, evidenceValues: Record<string, number | string | null>): ConstraintResult {
  return { id, name, status: 'failed', reason, evidenceValues }
}

function incrementRejection(stats: LiveCompilerStats, constraintId: string) {
  if (constraintId === 'series_voltage') stats.rejectedByVoltage++
  else if (constraintId === 'mppt_range') stats.rejectedByMppt++
  else if (constraintId === 'parallel_current') stats.rejectedByCurrent++
  else if (constraintId === 'array_power') stats.rejectedByPower++
  else if (constraintId === 'daily_generation') stats.rejectedByGeneration++
  else if (constraintId === 'battery_compatibility') stats.rejectedByBatteryVoltage++
  else if (constraintId === 'peak_load') stats.rejectedByPeakLoad++
  else if (constraintId === 'storage_adequacy') stats.rejectedByStorage++
  else if (constraintId === 'budget') stats.rejectedByBudget++
}

interface Candidate {
  topology: Topology
  totalCostInr: number
}

export function compileLiveTopology(
  catalogs: CatalogResult[],
  requirement: StructuredRequirement,
): LiveCompilerResult {
  const dailyEnergyKwh = requiredPositive(requirement.dailyEnergyKwh, 'Daily energy (kWh/day)')
  const peakLoadKw = requiredPositive(requirement.peakLoadKw, 'Peak load (kW)')
  const budgetInr = requiredPositive(requirement.budgetInr, 'Budget (INR)')

  if (requirement.systemType !== 'off_grid') {
    throw new LiveRequirementError('The hackathon MVP currently validates off-grid systems only. Please specify an off-grid requirement.')
  }

  const autonomyDays = requirement.autonomyDays && requirement.autonomyDays > 0
    ? requirement.autonomyDays
    : 1
  const minTempC = DEFAULT_MIN_TEMP_C
  const peakSunHours = DEFAULT_PEAK_SUN_HOURS

  const assumptions = [
    `${peakSunHours} peak-sun-hours/day used for sizing`,
    `${Math.round(SYSTEM_EFFICIENCY * 100)}% aggregate generation efficiency used for energy sizing`,
    `${minTempC}°C minimum design temperature used for cold-Voc validation`,
    requirement.autonomyDays
      ? `${autonomyDays} day(s) battery autonomy requested by user`
      : `${autonomyDays} day battery autonomy used because no autonomy target was supplied`,
  ]

  const panels: SolarPanel[] = []
  const inverters: Inverter[] = []
  const batteries: Battery[] = []

  for (const catalog of catalogs) {
    for (const component of catalog.verifiedComponents) {
      if (component.availability !== 'in_stock') continue
      if (component.componentType === 'solar_panel') panels.push(toPanel(catalog, component))
      else if (component.componentType === 'inverter') inverters.push(toInverter(catalog, component))
      else if (component.componentType === 'battery') batteries.push(toBattery(catalog, component))
    }
  }

  const stats: LiveCompilerStats = {
    totalCandidates: 0,
    rejectedByVoltage: 0,
    rejectedByMppt: 0,
    rejectedByCurrent: 0,
    rejectedByPower: 0,
    rejectedByGeneration: 0,
    rejectedByBatteryVoltage: 0,
    rejectedByPeakLoad: 0,
    rejectedByStorage: 0,
    rejectedByBudget: 0,
    fullyValidated: 0,
  }

  const rejectedCandidates: LiveCompilerResult['rejectedCandidates'] = []
  const valid: Candidate[] = []

  for (const panel of panels) {
    const panelValues = [
      panel.specs.pmaxW,
      panel.specs.vocV,
      panel.specs.vmpV,
      panel.specs.iscA,
      panel.specs.impA,
      panel.specs.vocTempCoefficientPctPerC,
      panel.priceInr,
    ]
    if (panelValues.some(value => value === null || value === undefined)) continue

    for (const inverter of inverters) {
      const inverterValues = [
        inverter.specs.ratedAcOutputW,
        inverter.specs.nominalBatteryVoltageV,
        inverter.specs.maxPvVoltageV,
        inverter.specs.mpptMinVoltageV,
        inverter.specs.mpptMaxVoltageV,
        inverter.specs.maxPvCurrentA,
        inverter.specs.maxPvPowerW,
        inverter.priceInr,
      ]
      if (inverterValues.some(value => value === null || value === undefined)) continue

      for (const battery of batteries) {
        const batteryValues = [
          battery.specs.nominalVoltageV,
          battery.specs.capacityKwh,
          battery.specs.dod,
          battery.priceInr,
        ]
        if (batteryValues.some(value => value === null || value === undefined)) continue

        const batterySeriesRaw = inverter.specs.nominalBatteryVoltageV! / battery.specs.nominalVoltageV!
        if (!Number.isInteger(batterySeriesRaw) || batterySeriesRaw < 1 || batterySeriesRaw > 8) continue
        const batterySeries = batterySeriesRaw

        for (let batteryParallel = 1; batteryParallel <= MAX_BATTERY_PARALLEL_BANKS; batteryParallel++) {
          const batteryUnitCount = batterySeries * batteryParallel
          const usableStorageKwh = battery.specs.capacityKwh! * (battery.specs.dod! / 100) * batteryUnitCount

          for (let seriesCount = 1; seriesCount <= MAX_PV_SERIES; seriesCount++) {
            for (let parallelCount = 1; parallelCount <= MAX_PV_PARALLEL; parallelCount++) {
              stats.totalCandidates++

              const totalPanels = seriesCount * parallelCount
              const correctedVocPerPanel = panel.specs.vocV! * (
                1 + (panel.specs.vocTempCoefficientPctPerC! / 100) * (minTempC - STC_TEMP_C)
              )
              const stringVoc = correctedVocPerPanel * seriesCount
              const stringVmp = panel.specs.vmpV! * seriesCount
              const arrayIsc = panel.specs.iscA! * parallelCount
              const arrayPowerW = panel.specs.pmaxW! * totalPanels
              const generationKwh = (arrayPowerW / 1000) * peakSunHours * SYSTEM_EFFICIENCY
              const batteryBankVoltage = battery.specs.nominalVoltageV! * batterySeries
              const totalCostInr = panel.priceInr! * totalPanels + inverter.priceInr! + battery.priceInr! * batteryUnitCount

              const constraints: ConstraintResult[] = []

              const voltageOk = stringVoc < inverter.specs.maxPvVoltageV!
              constraints.push(voltageOk
                ? pass('series_voltage', 'PV string open-circuit voltage', `Cold-corrected string Voc ${stringVoc.toFixed(1)}V is below inverter limit ${inverter.specs.maxPvVoltageV}V.`, {
                    panelVocSTC: panel.specs.vocV!, correctedVocPerPanel: Number(correctedVocPerPanel.toFixed(2)), seriesCount, stringVoc: Number(stringVoc.toFixed(2)), inverterMaxPvVoltage: inverter.specs.maxPvVoltageV!, temperatureMinC: minTempC, coefficientUsed: panel.specs.vocTempCoefficientPctPerC!, coefficientSource: 'Scraped manufacturer specification',
                  })
                : fail('series_voltage', 'PV string open-circuit voltage', `Cold-corrected string Voc ${stringVoc.toFixed(1)}V exceeds inverter limit ${inverter.specs.maxPvVoltageV}V.`, {
                    panelVocSTC: panel.specs.vocV!, seriesCount, stringVoc: Number(stringVoc.toFixed(2)), inverterMaxPvVoltage: inverter.specs.maxPvVoltageV!, temperatureMinC: minTempC,
                  }))

              const mpptOk = stringVmp >= inverter.specs.mpptMinVoltageV! && stringVmp <= inverter.specs.mpptMaxVoltageV!
              constraints.push(mpptOk
                ? pass('mppt_range', 'MPPT operating voltage', `String Vmp ${stringVmp.toFixed(1)}V is inside ${inverter.specs.mpptMinVoltageV}–${inverter.specs.mpptMaxVoltageV}V.`, { stringVmp: Number(stringVmp.toFixed(2)), mpptMin: inverter.specs.mpptMinVoltageV!, mpptMax: inverter.specs.mpptMaxVoltageV! })
                : fail('mppt_range', 'MPPT operating voltage', `String Vmp ${stringVmp.toFixed(1)}V is outside ${inverter.specs.mpptMinVoltageV}–${inverter.specs.mpptMaxVoltageV}V.`, { stringVmp: Number(stringVmp.toFixed(2)), mpptMin: inverter.specs.mpptMinVoltageV!, mpptMax: inverter.specs.mpptMaxVoltageV! }))

              const currentOk = arrayIsc <= inverter.specs.maxPvCurrentA!
              constraints.push(currentOk
                ? pass('parallel_current', 'PV array short-circuit current', `Array Isc ${arrayIsc.toFixed(1)}A is within inverter limit ${inverter.specs.maxPvCurrentA}A.`, { arrayIsc: Number(arrayIsc.toFixed(2)), inverterMaxCurrent: inverter.specs.maxPvCurrentA!, parallelCount })
                : fail('parallel_current', 'PV array short-circuit current', `Array Isc ${arrayIsc.toFixed(1)}A exceeds inverter limit ${inverter.specs.maxPvCurrentA}A.`, { arrayIsc: Number(arrayIsc.toFixed(2)), inverterMaxCurrent: inverter.specs.maxPvCurrentA!, parallelCount }))

              const powerOk = arrayPowerW <= inverter.specs.maxPvPowerW!
              constraints.push(powerOk
                ? pass('array_power', 'Total PV array power', `Array power ${(arrayPowerW / 1000).toFixed(2)}kW is within inverter PV limit ${(inverter.specs.maxPvPowerW! / 1000).toFixed(2)}kW.`, { arrayPowerW, inverterMaxPvPower: inverter.specs.maxPvPowerW! })
                : fail('array_power', 'Total PV array power', `Array power ${(arrayPowerW / 1000).toFixed(2)}kW exceeds inverter PV limit ${(inverter.specs.maxPvPowerW! / 1000).toFixed(2)}kW.`, { arrayPowerW, inverterMaxPvPower: inverter.specs.maxPvPowerW! }))

              const generationOk = generationKwh >= dailyEnergyKwh
              constraints.push(generationOk
                ? pass('daily_generation', 'Daily energy coverage', `Estimated generation ${generationKwh.toFixed(2)}kWh/day meets ${dailyEnergyKwh.toFixed(2)}kWh/day target.`, { estimatedGenerationKwh: Number(generationKwh.toFixed(2)), targetKwh: dailyEnergyKwh, peakSunHours, systemEfficiencyPct: SYSTEM_EFFICIENCY * 100 })
                : fail('daily_generation', 'Daily energy coverage', `Estimated generation ${generationKwh.toFixed(2)}kWh/day is below ${dailyEnergyKwh.toFixed(2)}kWh/day target.`, { estimatedGenerationKwh: Number(generationKwh.toFixed(2)), targetKwh: dailyEnergyKwh, peakSunHours, systemEfficiencyPct: SYSTEM_EFFICIENCY * 100 }))

              const batteryVoltageOk = batteryBankVoltage === inverter.specs.nominalBatteryVoltageV!
              constraints.push(batteryVoltageOk
                ? pass('battery_compatibility', 'Battery–inverter voltage compatibility', `${batterySeries} batteries in series create a ${batteryBankVoltage}V bank matching the inverter.`, { batteryNominalVoltage: battery.specs.nominalVoltageV!, batteriesInSeries: batterySeries, parallelBanks: batteryParallel, bankVoltage: batteryBankVoltage, inverterBatteryVoltage: inverter.specs.nominalBatteryVoltageV! })
                : fail('battery_compatibility', 'Battery–inverter voltage compatibility', `Battery bank voltage ${batteryBankVoltage}V does not match inverter ${inverter.specs.nominalBatteryVoltageV}V.`, { bankVoltage: batteryBankVoltage, inverterBatteryVoltage: inverter.specs.nominalBatteryVoltageV! }))

              const peakOk = inverter.specs.ratedAcOutputW! >= peakLoadKw * 1000
              constraints.push(peakOk
                ? pass('peak_load', 'Peak load capacity', `Inverter ${(inverter.specs.ratedAcOutputW! / 1000).toFixed(1)}kW output covers ${peakLoadKw.toFixed(1)}kW peak load.`, { inverterRatedOutputW: inverter.specs.ratedAcOutputW!, requiredPeakLoadW: peakLoadKw * 1000 })
                : fail('peak_load', 'Peak load capacity', `Inverter ${(inverter.specs.ratedAcOutputW! / 1000).toFixed(1)}kW output cannot cover ${peakLoadKw.toFixed(1)}kW peak load.`, { inverterRatedOutputW: inverter.specs.ratedAcOutputW!, requiredPeakLoadW: peakLoadKw * 1000 }))

              const requiredStorageKwh = dailyEnergyKwh * autonomyDays
              const storageOk = usableStorageKwh >= requiredStorageKwh
              constraints.push(storageOk
                ? pass('storage_adequacy', 'Battery storage adequacy', `Usable storage ${usableStorageKwh.toFixed(1)}kWh meets ${requiredStorageKwh.toFixed(1)}kWh target.`, { usableStorageKwh: Number(usableStorageKwh.toFixed(2)), requiredStorageKwh: Number(requiredStorageKwh.toFixed(2)), batteryUnits: batteryUnitCount, batteriesInSeries: batterySeries, parallelBanks: batteryParallel, dodPct: battery.specs.dod! })
                : fail('storage_adequacy', 'Battery storage adequacy', `Usable storage ${usableStorageKwh.toFixed(1)}kWh is below ${requiredStorageKwh.toFixed(1)}kWh target.`, { usableStorageKwh: Number(usableStorageKwh.toFixed(2)), requiredStorageKwh: Number(requiredStorageKwh.toFixed(2)), batteryUnits: batteryUnitCount, dodPct: battery.specs.dod! }))

              const budgetOk = totalCostInr <= budgetInr
              constraints.push(budgetOk
                ? pass('budget', 'Component cost within budget', `₹${Math.round(totalCostInr).toLocaleString('en-IN')} is within ₹${Math.round(budgetInr).toLocaleString('en-IN')} budget.`, { totalCostInr: Math.round(totalCostInr), budgetInr: Math.round(budgetInr) })
                : fail('budget', 'Component cost within budget', `₹${Math.round(totalCostInr).toLocaleString('en-IN')} exceeds ₹${Math.round(budgetInr).toLocaleString('en-IN')} budget.`, { totalCostInr: Math.round(totalCostInr), budgetInr: Math.round(budgetInr) }))

              const firstFailure = constraints.find(constraint => constraint.status === 'failed')
              if (firstFailure) {
                incrementRejection(stats, firstFailure.id)
                if (rejectedCandidates.length < 100) {
                  rejectedCandidates.push({
                    panelId: panel.id,
                    inverterId: inverter.id,
                    batteryId: battery.id,
                    reason: firstFailure.reason,
                    failedConstraint: firstFailure.id,
                  })
                }
                continue
              }

              stats.fullyValidated++

              const topology: Topology = {
                id: `live_${panel.id}_${inverter.id}_${battery.id}_${seriesCount}s${parallelCount}p_${batterySeries}s${batteryParallel}p_bat`,
                pvArray: {
                  panelId: panel.id,
                  panel,
                  seriesCount,
                  parallelCount,
                  totalPanels,
                  arrayVoc: Number((panel.specs.vocV! * seriesCount).toFixed(2)),
                  arrayVmp: Number(stringVmp.toFixed(2)),
                  arrayIsc: Number(arrayIsc.toFixed(2)),
                  arrayPowerW,
                },
                inverterId: inverter.id,
                inverter,
                batteryId: battery.id,
                battery,
                batteryUnitCount,
                batteryBankVoltageV: batteryBankVoltage,
                metrics: {
                  totalCostInr: Math.round(totalCostInr),
                  dailyEnergyKwh: Number(generationKwh.toFixed(2)),
                  peakOutputW: inverter.specs.ratedAcOutputW!,
                  storedEnergyKwh: Number(usableStorageKwh.toFixed(2)),
                  autonomyDays: Number((usableStorageKwh / dailyEnergyKwh).toFixed(2)),
                  arrayPowerW,
                  batteryUnitCount,
                },
                constraints,
                validationStatus: 'VALIDATED',
                compiledAt: new Date().toISOString(),
                version: 1,
                rejectedCandidates: [],
              }

              valid.push({ topology, totalCostInr })
            }
          }
        }
      }
    }
  }

  valid.sort((a, b) => {
    if (a.totalCostInr !== b.totalCostInr) return a.totalCostInr - b.totalCostInr
    const aComponents = a.topology.pvArray.totalPanels + a.topology.batteryUnitCount + 1
    const bComponents = b.topology.pvArray.totalPanels + b.topology.batteryUnitCount + 1
    return aComponents - bComponents
  })

  const topology = valid[0]?.topology ?? null
  if (topology) topology.rejectedCandidates = rejectedCandidates.slice(0, 20)

  return { topology, stats, rejectedCandidates, assumptions }
}
