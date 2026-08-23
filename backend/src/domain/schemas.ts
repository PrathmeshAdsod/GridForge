/**
 * GridForge — Zod Validation Schemas
 *
 * These schemas validate data at external boundaries:
 * - Bright Data scraped product data
 * - Gemini API responses
 * - User input (requirement parsing)
 *
 * All schemas are strict. Missing critical fields are preserved as null,
 * not coerced into values.
 */

import { z } from "zod";

// ─── Scraped Raw Product (from Bright Data) ───────────────────────────────────

export const RawScrapedProductSchema = z.object({
  productUrl: z.string().url(),
  storeName: z.string(),
  collectorId: z.string().regex(/^c_/),
  scrapeRunId: z.string(),
  scrapedAt: z.string().datetime(),
  manufacturer: z.string().optional().nullable(),
  model: z.string(),
  priceText: z.string().optional().nullable(), // Raw price string before parsing
  priceInr: z.number().positive().optional().nullable(),
  currency: z.enum(["INR", "USD", "EUR"]).default("INR"),
  availability: z
    .enum(["in_stock", "out_of_stock", "limited", "unknown"])
    .default("unknown"),
  imageUrl: z.string().url().optional().nullable(),
  // Raw spec fields — key/value from scraped HTML
  rawSpecs: z.record(z.string(), z.string().optional().nullable()),
  productType: z.enum(["solar_panel", "inverter", "battery", "unknown"]).default("unknown"),
});

export type RawScrapedProduct = z.infer<typeof RawScrapedProductSchema>;

// ─── Gemini Parsed Requirement ────────────────────────────────────────────────

export const ParsedRequirementSchema = z.object({
  dailyEnergyKwh: z.number().positive().max(1000),
  peakLoadKw: z.number().positive().max(500),
  budgetInr: z.number().positive(),
  systemType: z.enum(["off_grid", "on_grid", "hybrid"]).default("off_grid"),
  location: z.string().optional().nullable(),
  temperatureMinC: z.number().min(-40).max(50).optional().nullable(),
  autonomyDays: z.number().int().min(1).max(30).default(1),
  assumptions: z.array(z.string()),
  rawInput: z.string(), // Original NL input
});

export type ParsedRequirement = z.infer<typeof ParsedRequirementSchema>;

// ─── Solar Panel Specs ────────────────────────────────────────────────────────

export const SolarPanelSpecsSchema = z.object({
  pmaxW: z.number().positive().nullable(),
  vocV: z.number().positive().nullable(),
  vmpV: z.number().positive().nullable(),
  iscA: z.number().positive().nullable(),
  impA: z.number().positive().nullable(),
  efficiency: z.number().min(0).max(100).nullable().optional(),
  vocTempCoefficientPctPerC: z.number().nullable().optional(),
  impTempCoefficientPctPerC: z.number().nullable().optional(),
  pmaxTempCoefficientPctPerC: z.number().nullable().optional(),
  widthMm: z.number().positive().nullable().optional(),
  heightMm: z.number().positive().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  cellType: z.string().nullable().optional(),
  frameType: z.string().nullable().optional(),
  warrantyYears: z.number().int().positive().nullable().optional(),
});

// ─── Inverter Specs ───────────────────────────────────────────────────────────

export const InverterSpecsSchema = z.object({
  ratedAcOutputW: z.number().positive().nullable(),
  nominalBatteryVoltageV: z.number().positive().nullable(),
  maxPvVoltageV: z.number().positive().nullable(),
  mpptMinVoltageV: z.number().positive().nullable(),
  mpptMaxVoltageV: z.number().positive().nullable(),
  maxPvCurrentA: z.number().positive().nullable(),
  maxPvShortCircuitCurrentA: z.number().positive().nullable().optional(),
  maxPvPowerW: z.number().positive().nullable(),
  nominalOutputVoltageV: z.number().positive().nullable().optional(),
  outputFrequencyHz: z.number().positive().nullable().optional(),
  inverterType: z.string().nullable().optional(),
  chargerCurrentA: z.number().positive().nullable().optional(),
});

// ─── Battery Specs ────────────────────────────────────────────────────────────

export const BatterySpecsSchema = z.object({
  nominalVoltageV: z.number().positive().nullable(),
  capacityAh: z.number().positive().nullable(),
  capacityKwh: z.number().positive().nullable(),
  continuousDischargePowerW: z.number().positive().nullable().optional(),
  continuousDischargeCurrentA: z.number().positive().nullable().optional(),
  chemistry: z.string().nullable().optional(),
  dod: z.number().min(0).max(100).nullable().optional(),
  cycleLife: z.number().int().positive().nullable().optional(),
});

// ─── Health Check Payload ─────────────────────────────────────────────────────

export const HealthCheckResultSchema = z.object({
  collectorId: z.string(),
  scrapeRunId: z.string(),
  timestamp: z.string().datetime(),
  totalProducts: z.number().int().min(0),
  criticalFieldCoverage: z.object({
    voc: z.number().min(0).max(1),
    vmp: z.number().min(0).max(1),
    isc: z.number().min(0).max(1),
    pmax: z.number().min(0).max(1),
    price: z.number().min(0).max(1),
  }),
  schemaValidationFailureRate: z.number().min(0).max(1),
});

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;
