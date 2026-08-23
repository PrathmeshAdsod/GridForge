"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { DEMO_SOURCES } from "@/lib/demo-data";
import type { SourceHealth, SourceHealthState, SourceHealthEvent } from "@/types";

// ─── State Colors ─────────────────────────────────────────────────────────────

function stateColor(state: SourceHealthState): string {
  const map: Record<SourceHealthState, string> = {
    HEALTHY: "var(--color-verified)",
    DEGRADED: "var(--color-error)",
    HEALING: "var(--accent-500)",
    VERIFYING: "var(--color-info)",
    RECOVERED: "var(--color-verified)",
    REAL_WORLD_CHANGE: "var(--accent-700)",
    FAILED: "var(--color-error)",
  };
  return map[state];
}

function stateBg(state: SourceHealthState): string {
  const map: Record<SourceHealthState, string> = {
    HEALTHY: "var(--color-verified-bg)",
    DEGRADED: "var(--color-error-bg)",
    HEALING: "var(--color-warning-bg)",
    VERIFYING: "var(--color-info-bg)",
    RECOVERED: "var(--color-verified-bg)",
    REAL_WORLD_CHANGE: "var(--color-warning-bg)",
    FAILED: "var(--color-error-bg)",
  };
  return map[state];
}

// ─── Coverage Bar ─────────────────────────────────────────────────────────────

function CoverageBar({ field, value }: { field: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "var(--color-verified)" : pct >= 70 ? "var(--accent-500)" : "var(--color-error)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 32, textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
        {field.toUpperCase()}
      </span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--border-subtle)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: color, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", width: 32 }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ source, onSimulate }: { source: SourceHealth; onSimulate?: (sourceId: string, scenario: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: expanded ? "1px solid var(--border-subtle)" : "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <motion.div
                animate={
                  source.state === "HEALING" || source.state === "VERIFYING"
                    ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }
                    : { scale: 1, opacity: 1 }
                }
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor(source.state), flexShrink: 0 }}
              />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {source.storeName}
              </span>
            </div>
            <a
              href={source.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none", fontFamily: "JetBrains Mono, monospace" }}
            >
              {source.storeUrl}
            </a>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: stateColor(source.state),
              background: stateBg(source.state),
              padding: "3px 8px",
              borderRadius: 99,
              letterSpacing: "0.04em",
            }}>
              {source.state}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ padding: "4px 8px", background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer", color: "var(--text-secondary)" }}
            >
              {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>

        {/* Quick metrics */}
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <QuickStat label="Products" value={source.metrics.totalProducts} />
          <QuickStat label="Schema errors" value={`${(source.metrics.schemaValidationFailureRate * 100).toFixed(0)}%`} color={source.metrics.schemaValidationFailureRate > 0.1 ? "var(--color-error)" : "var(--text-primary)"} />
          <QuickStat label="Collector" value={source.collectorId} mono />
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: "1rem 1.25rem" }}
          >
            {/* Field coverage */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 10 }}>
                Critical field coverage
              </div>
              {Object.entries(source.metrics.criticalFieldCoverage).map(([field, value]) => (
                <CoverageBar key={field} field={field} value={value} />
              ))}
            </div>

            {/* Event log */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 10 }}>
                Event log
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {source.events.slice(-5).reverse().map((evt) => (
                  <EventRow key={evt.id} event={evt} />
                ))}
              </div>
            </div>

            {/* Simulate buttons */}
            {onSimulate && (
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 8 }}>
                  Demo scenarios
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onSimulate(source.sourceId, "dom_drift")}
                    className="btn btn-ghost btn-sm"
                    id={`simulate-dom-drift-${source.sourceId}`}
                  >
                    Simulate DOM drift →
                  </button>
                  <button
                    onClick={() => onSimulate(source.sourceId, "stockout")}
                    className="btn btn-ghost btn-sm"
                    id={`simulate-stockout-${source.sourceId}`}
                  >
                    Simulate stockout →
                  </button>
                  <button
                    onClick={() => onSimulate(source.sourceId, "recovery")}
                    className="btn btn-ghost btn-sm"
                    id={`simulate-recovery-${source.sourceId}`}
                  >
                    Trigger self-heal →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickStat({ label, value, color, mono }: { label: string; value: string | number; color?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--text-primary)", fontFamily: mono ? "JetBrains Mono, monospace" : "inherit" }}>{value}</div>
    </div>
  );
}

function EventRow({ event }: { event: SourceHealthEvent }) {
  const typeColors: Record<string, string> = {
    SCRAPE_COMPLETE: "var(--color-verified)",
    DEGRADATION_DETECTED: "var(--color-error)",
    HEALING_INITIATED: "var(--accent-500)",
    HEALING_COMPLETE: "var(--accent-600)",
    VERIFICATION_PASSED: "var(--color-verified)",
    VERIFICATION_FAILED: "var(--color-error)",
    REAL_SUPPLY_CHANGE_DETECTED: "var(--accent-700)",
    SOURCE_RECOVERED: "var(--color-verified)",
  };
  const color = typeColors[event.type] ?? "var(--text-tertiary)";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em" }}>{event.type}</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{new Date(event.timestamp).toLocaleTimeString("en-IN")}</span>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1, lineHeight: 1.4 }}>{event.detail}</p>
      </div>
    </div>
  );
}

// ─── Simulation State Machine ─────────────────────────────────────────────────

type ScenarioType = "dom_drift" | "stockout" | "recovery" | null;

function useSimulation() {
  const [sources, setSources] = useState<SourceHealth[]>(DEMO_SOURCES);
  const [activeScenario, setActiveScenario] = useState<{ sourceId: string; scenario: ScenarioType; step: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) {
    setLog((l) => [`[${new Date().toLocaleTimeString("en-IN")}] ${msg}`, ...l.slice(0, 19)]);
  }

  async function simulate(sourceId: string, scenario: string) {
    const sc = scenario as ScenarioType;
    setActiveScenario({ sourceId, scenario: sc, step: 0 });

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const updateSource = (id: string, updates: Partial<SourceHealth>, newEvent?: SourceHealthEvent) => {
      setSources((prev) =>
        prev.map((s) =>
          s.sourceId === id
            ? {
                ...s,
                ...updates,
                events: newEvent ? [...s.events, newEvent] : s.events,
                stateChangedAt: new Date().toISOString(),
              }
            : s
        )
      );
    };

    const makeEvent = (type: string, detail: string): SourceHealthEvent => ({
      id: `evt_${Date.now()}`,
      sourceId,
      type,
      timestamp: new Date().toISOString(),
      detail,
    });

    if (sc === "dom_drift") {
      addLog(`[${sourceId}] DOM drift simulation started`);
      updateSource(sourceId, { state: "DEGRADED", metrics: { ...DEMO_SOURCES.find(s => s.sourceId === sourceId)!.metrics, criticalFieldCoverage: { voc: 0.2, vmp: 0.2, isc: 0.3, pmax: 0.8, price: 0.9 }, schemaValidationFailureRate: 0.45 } }, makeEvent("DEGRADATION_DETECTED", "Field coverage dropped 60%+ — DOM structure changed. Voc, Vmp selectors returning empty."));
      addLog(`[${sourceId}] DEGRADED — field coverage dropped`);
      await delay(2000);

      updateSource(sourceId, { state: "HEALING" }, makeEvent("HEALING_INITIATED", "Triggering Bright Data self-heal on collector. Same collector ID retained for downstream continuity."));
      addLog(`[${sourceId}] Self-healing triggered via Bright Data API`);
      await delay(3000);

      updateSource(sourceId, { state: "VERIFYING" }, makeEvent("HEALING_COMPLETE", "Bright Data AI proposed selector fix: [data-spec='open-circuit-voltage'] strong → Voc. Approved and deployed."));
      addLog(`[${sourceId}] Healing complete — verifying data quality`);
      await delay(2000);

      updateSource(sourceId, {
        state: "RECOVERED",
        metrics: { ...DEMO_SOURCES.find(s => s.sourceId === sourceId)!.metrics, criticalFieldCoverage: { voc: 0.91, vmp: 0.91, isc: 0.88, pmax: 1.0, price: 0.96 }, schemaValidationFailureRate: 0.04 },
        lastSuccessfulScrapeAt: new Date().toISOString(),
      }, makeEvent("SOURCE_RECOVERED", "Post-healing scrape verified. Full field coverage restored. System will recompile on next request."));
      addLog(`[${sourceId}] RECOVERED — source fully operational`);

    } else if (sc === "stockout") {
      addLog(`[${sourceId}] Stockout simulation started`);
      updateSource(sourceId, { state: "REAL_WORLD_CHANGE" }, makeEvent("REAL_SUPPLY_CHANGE_DETECTED", "Availability field changed from 'in_stock' → 'out_of_stock' on 3 panels. Schema intact — real business event, not DOM drift."));
      addLog(`[${sourceId}] REAL_WORLD_CHANGE — availability changed`);

    } else if (sc === "recovery") {
      const src = sources.find(s => s.sourceId === sourceId);
      if (src?.state === "DEGRADED") {
        updateSource(sourceId, { state: "HEALING" }, makeEvent("HEALING_INITIATED", "Manual self-heal triggered."));
        addLog(`[${sourceId}] Self-heal triggered`);
      } else {
        addLog(`[${sourceId}] Source is ${src?.state ?? "unknown"} — no healing needed`);
      }
    }

    setActiveScenario(null);
  }

  return { sources, log, simulate, activeScenario };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  const { sources, log, simulate, activeScenario } = useSimulation();
  const totalHealthy = sources.filter(s => s.state === "HEALTHY" || s.state === "RECOVERED").length;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-base)" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-base)", position: "sticky", top: 0, zIndex: 30 }}>
        <div className="container-main" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none" }}>← GridForge</Link>
            <span style={{ color: "var(--border-default)" }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Source Health</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {totalHealthy}/{sources.length} healthy
            </span>
          </div>
        </div>
      </header>

      <div className="container-content" style={{ paddingBlock: "2rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>Source Health</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 560 }}>
            Real-time health of Bright Data collectors. GridForge distinguishes DOM drift from real supply changes — healing only what's broken.
          </p>
        </div>

        {/* Summary bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-subtle)", marginBottom: "2rem" }}>
          {[
            { label: "Total sources", value: sources.length },
            { label: "Healthy", value: sources.filter(s => s.state === "HEALTHY" || s.state === "RECOVERED").length, color: "var(--color-verified)" },
            { label: "Degraded", value: sources.filter(s => s.state === "DEGRADED" || s.state === "FAILED").length, color: "var(--color-error)" },
            { label: "Healing", value: sources.filter(s => s.state === "HEALING" || s.state === "VERIFYING").length, color: "var(--accent-500)" },
          ].map((m, i) => (
            <div key={i} style={{ padding: "0.875rem 1.25rem", background: "white" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", color: m.color ?? "var(--text-primary)" }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Source cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {sources.map((source) => (
            <SourceCard key={source.sourceId} source={source} onSimulate={simulate} />
          ))}
        </div>

        {/* Live event log */}
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
            Live event stream
          </div>
          {log.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
              No events yet — click "Simulate DOM drift" or "Simulate stockout" above to trigger a scenario.
            </p>
          ) : (
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
              <AnimatePresence>
                {log.map((line, i) => (
                  <motion.div
                    key={`${i}-${line}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ color: line.includes("RECOVERED") ? "var(--color-verified)" : line.includes("DEGRADED") ? "var(--color-error)" : "var(--text-secondary)", lineHeight: 1.5 }}
                  >
                    {line}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Two-level recovery explanation */}
        <div style={{ marginTop: "2rem", padding: "1.25rem 1.5rem", background: "var(--surface-subtle)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
            How GridForge classifies source events
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <ClassificationCard
              title="DEGRADED (DOM drift)"
              color="var(--color-error)"
              description="Field coverage drops significantly while products are still returned. This indicates the scraper's selectors are broken — Bright Data self-healing is appropriate."
              signals={["Voc/Vmp field coverage drops >40%", "Schema validation failures >30%", "Product count drops with elevated schema errors"]}
            />
            <ClassificationCard
              title="REAL_WORLD_CHANGE (supply)"
              color="var(--accent-700)"
              description="Schema is intact and field coverage is normal, but availability or price values have changed. This is a real business event — GridForge recompiles, not the scraper."
              signals={["Availability field: in_stock → out_of_stock", "Field coverage remains high", "Schema validation rate normal"]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassificationCard({ title, color, description, signals }: { title: string; color: string; description: string; signals: string[] }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>{description}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {signals.map((s) => (
          <div key={s} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, marginTop: 5, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
