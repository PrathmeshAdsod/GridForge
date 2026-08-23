/**
 * GridForge — Source Guardian
 *
 * Stateful health monitoring for Bright Data collector sources.
 * Implements the state machine:
 *
 *   HEALTHY → DEGRADED → HEALING → VERIFYING → RECOVERED
 *                                             → FAILED
 *           → REAL_WORLD_CHANGE (when data changes but schema is intact)
 *
 * KEY DISTINCTION:
 *   DEGRADED = scraper broke (DOM/schema drift) — self-healing appropriate
 *   REAL_WORLD_CHANGE = scraper works fine, but supply actually changed
 *
 * CRITICAL: The Guardian NEVER silently restores a source.
 * It must verify data quality after healing before marking RECOVERED.
 */

import type {
  SourceHealth,
  SourceHealthState,
  SourceHealthMetrics,
  SourceHealthEvent,
  SourceEventType,
} from "../types";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Field coverage drop threshold to flag DEGRADED (not REAL_WORLD_CHANGE) */
const CRITICAL_FIELD_DROP_THRESHOLD = 0.4; // If coverage drops by >40% → likely DOM drift

/** Minimum acceptable critical field coverage for a HEALTHY source */
const HEALTHY_FIELD_COVERAGE_MIN = 0.7;

/** Row count drop threshold — sudden large drop may indicate scraper failure */
const ROW_COUNT_DROP_RATIO = 0.5; // If rows drop by >50% without known stockout

/** Schema validation failure rate that triggers DEGRADED */
const SCHEMA_FAILURE_RATE_THRESHOLD = 0.3; // >30% failures → degraded

// ─── Classifier ───────────────────────────────────────────────────────────────

export interface HealthAssessment {
  state: SourceHealthState;
  reason: string;
  degradationSignals: string[];
  realWorldSignals: string[];
}

/**
 * Classify a new scrape result against the previous baseline.
 *
 * The critical difference:
 * - DOM DRIFT: Field coverage drops significantly (fields that existed before now return null/undefined)
 * - REAL SUPPLY CHANGE: Field coverage stays high, but values change (availability: in_stock → out_of_stock)
 */
export function assessSourceHealth(
  newMetrics: SourceHealthMetrics,
  previousMetrics: SourceHealthMetrics | undefined,
  availabilityChangeDetected: boolean = false
): HealthAssessment {
  const degradationSignals: string[] = [];
  const realWorldSignals: string[] = [];

  // ── 1. Schema validation failures ─────────────────────────────────────────
  if (newMetrics.schemaValidationFailureRate > SCHEMA_FAILURE_RATE_THRESHOLD) {
    degradationSignals.push(
      `Schema validation failure rate is ${(newMetrics.schemaValidationFailureRate * 100).toFixed(0)}% — DOM/schema drift likely`
    );
  }

  // ── 2. Critical field coverage drop ───────────────────────────────────────
  if (previousMetrics) {
    const fields = ["voc", "vmp", "isc", "pmax", "price"] as const;
    for (const field of fields) {
      const prev = previousMetrics.criticalFieldCoverage[field];
      const curr = newMetrics.criticalFieldCoverage[field];
      const drop = prev - curr;

      if (drop > CRITICAL_FIELD_DROP_THRESHOLD) {
        degradationSignals.push(
          `${field.toUpperCase()} field coverage dropped from ${(prev * 100).toFixed(0)}% to ${(curr * 100).toFixed(0)}% — selector likely broken`
        );
      }
    }

    // ── 3. Row count anomaly ────────────────────────────────────────────────
    if (previousMetrics.totalProducts > 0) {
      const rowRatio = newMetrics.totalProducts / previousMetrics.totalProducts;
      if (rowRatio < ROW_COUNT_DROP_RATIO) {
        // Could be scraper failure OR actual stockout
        if (newMetrics.schemaValidationFailureRate > 0.1) {
          degradationSignals.push(
            `Product count dropped from ${previousMetrics.totalProducts} to ${newMetrics.totalProducts} with elevated schema errors — pagination or crawl failure`
          );
        } else {
          realWorldSignals.push(
            `Product count dropped from ${previousMetrics.totalProducts} to ${newMetrics.totalProducts} but schema is intact — possible mass stockout`
          );
        }
      }
    }
  }

  // ── 4. Availability change with intact schema ─────────────────────────────
  if (availabilityChangeDetected && degradationSignals.length === 0) {
    realWorldSignals.push(
      "Availability field changed on one or more products with schema intact — real supply change"
    );
  }

  // ── 5. Absolute coverage floor ────────────────────────────────────────────
  const coverageValues = Object.values(newMetrics.criticalFieldCoverage);
  const minCoverage = Math.min(...coverageValues);
  if (minCoverage < HEALTHY_FIELD_COVERAGE_MIN && degradationSignals.length === 0) {
    // Low coverage but no drop (first run or always low) — flag as DEGRADED
    degradationSignals.push(
      `Critical field coverage ${(minCoverage * 100).toFixed(0)}% is below minimum threshold — spec data insufficient`
    );
  }

  // ── Decision ───────────────────────────────────────────────────────────────

  if (degradationSignals.length > 0) {
    return {
      state: "DEGRADED",
      reason: `Source degradation detected: ${degradationSignals[0]}`,
      degradationSignals,
      realWorldSignals,
    };
  }

  if (realWorldSignals.length > 0) {
    return {
      state: "REAL_WORLD_CHANGE",
      reason: `Real supply change detected: ${realWorldSignals[0]}`,
      degradationSignals,
      realWorldSignals,
    };
  }

  return {
    state: "HEALTHY",
    reason: "All metrics within normal bounds",
    degradationSignals,
    realWorldSignals,
  };
}

// ─── State Machine ────────────────────────────────────────────────────────────

export function transitionSourceState(
  current: SourceHealthState,
  event: SourceEventType,
  assessment?: HealthAssessment
): SourceHealthState {
  switch (event) {
    case "SCRAPE_COMPLETE":
      if (current === "HEALTHY" || current === "RECOVERED") {
        if (!assessment) return "HEALTHY";
        return assessment.state === "HEALTHY" ? "HEALTHY" : assessment.state;
      }
      if (current === "VERIFYING") {
        if (!assessment) return "FAILED";
        return assessment.state === "HEALTHY" ? "RECOVERED" : "FAILED";
      }
      return current;

    case "DEGRADATION_DETECTED":
      return "DEGRADED";

    case "HEALING_INITIATED":
      return current === "DEGRADED" ? "HEALING" : current;

    case "HEALING_COMPLETE":
      return current === "HEALING" ? "VERIFYING" : current;

    case "VERIFICATION_PASSED":
      return "RECOVERED";

    case "VERIFICATION_FAILED":
      return "FAILED";

    case "REAL_SUPPLY_CHANGE_DETECTED":
      return "REAL_WORLD_CHANGE";

    case "SOURCE_RECOVERED":
      return "RECOVERED";

    case "SOURCE_FAILED":
      return "FAILED";

    default:
      return current;
  }
}

// ─── Health Check Computation ─────────────────────────────────────────────────

export interface ScrapedProductForHealthCheck {
  voc: string | number | null;
  vmp: string | number | null;
  isc: string | number | null;
  pmax: string | number | null;
  price: number | null;
  availabilityPrev?: string | null;
  availabilityNow?: string | null;
  schemaValid: boolean;
}

export function computeHealthMetrics(
  products: ScrapedProductForHealthCheck[]
): { metrics: SourceHealthMetrics; availabilityChanged: boolean } {
  if (products.length === 0) {
    return {
      metrics: {
        totalProducts: 0,
        criticalFieldCoverage: { voc: 0, vmp: 0, isc: 0, pmax: 0, price: 0 },
        schemaValidationFailureRate: 1,
        lastCheckedAt: new Date().toISOString(),
      },
      availabilityChanged: false,
    };
  }

  const total = products.length;
  const hasValue = (v: string | number | null): boolean =>
    v !== null && v !== undefined && v !== "" && v !== "undefined";

  const vocCount = products.filter((p) => hasValue(p.voc)).length;
  const vmpCount = products.filter((p) => hasValue(p.vmp)).length;
  const iscCount = products.filter((p) => hasValue(p.isc)).length;
  const pmaxCount = products.filter((p) => hasValue(p.pmax)).length;
  const priceCount = products.filter((p) => p.price !== null && p.price > 0).length;
  const schemaFailCount = products.filter((p) => !p.schemaValid).length;
  const availabilityChanged = products.some(
    (p) => p.availabilityPrev !== undefined && p.availabilityNow !== undefined && p.availabilityPrev !== p.availabilityNow
  );

  return {
    metrics: {
      totalProducts: total,
      criticalFieldCoverage: {
        voc: vocCount / total,
        vmp: vmpCount / total,
        isc: iscCount / total,
        pmax: pmaxCount / total,
        price: priceCount / total,
      },
      schemaValidationFailureRate: schemaFailCount / total,
      lastCheckedAt: new Date().toISOString(),
    },
    availabilityChanged,
  };
}

// ─── Event Factory ────────────────────────────────────────────────────────────

export function createSourceEvent(
  sourceId: string,
  type: SourceEventType,
  detail: string,
  metadata?: Record<string, unknown>
): SourceHealthEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sourceId,
    type,
    timestamp: new Date().toISOString(),
    detail,
    metadata,
  };
}
