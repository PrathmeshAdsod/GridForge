"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { DEMO_TOPOLOGY, DEMO_COMPILE_STATS } from "@/lib/demo-data";
import type { Topology, Component, SimulateState } from "@/types";

// Dynamic import for React Flow (heavy, client-only)
const TopologyCanvas = dynamic(
  () => import("@/components/topology/TopologyCanvas"),
  { ssr: false, loading: () => <CanvasLoading /> }
);

// ─── Component Detail Drawer ──────────────────────────────────────────────────

function ComponentDrawer({
  nodeId,
  topology,
  onClose,
}: {
  nodeId: string | null;
  topology: Topology;
  onClose: () => void;
}) {
  const component: Component | null = (() => {
    if (!nodeId) return null;
    if (nodeId === "panel-array") return topology.pvArray.panel;
    if (nodeId === "inverter") return topology.inverter;
    if (nodeId === "battery") return topology.battery;
    return null;
  })();

  return (
    <AnimatePresence>
      {component && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(17,17,16,0.08)", zIndex: 40 }}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: 380,
              background: "var(--surface-base)",
              borderLeft: "1px solid var(--border-subtle)",
              zIndex: 50,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drawer header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 4 }}>
                  {component.type === "solar_panel" ? "Solar Panel" : component.type === "inverter" ? "Inverter" : "Battery"}
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
                  {component.manufacturer}<br />{component.model}
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{ padding: "6px", background: "var(--surface-muted)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
                aria-label="Close drawer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "1.25rem 1.5rem", flex: 1 }}>
              {/* Price & Availability */}
              <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem" }}>
                <div style={{ flex: 1, padding: "0.75rem", background: "white", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Price</div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>
                    {component.priceInr !== null
                      ? `₹${component.priceInr.toLocaleString("en-IN")}`
                      : <span style={{ color: "var(--color-unverified)" }}>Unknown</span>}
                  </div>
                </div>
                <div style={{ flex: 1, padding: "0.75rem", background: "white", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Stock</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: component.availability === "in_stock" ? "var(--color-verified)" : "var(--color-error)" }}>
                    {component.availability === "in_stock" ? "In stock" : component.availability === "out_of_stock" ? "Out of stock" : "Limited"}
                  </div>
                </div>
              </div>

              {/* Verification status */}
              <div style={{
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                marginBottom: "1.5rem",
                background: component.verificationStatus === "VERIFIED"
                  ? "var(--color-verified-bg)"
                  : component.verificationStatus === "UNVERIFIED"
                  ? "var(--color-unverified-bg)"
                  : "var(--color-warning-bg)",
                border: `1px solid ${
                  component.verificationStatus === "VERIFIED" ? "rgba(5,150,105,0.2)"
                  : component.verificationStatus === "UNVERIFIED" ? "rgba(107,114,128,0.2)"
                  : "rgba(245,158,11,0.2)"
                }`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: component.verificationStatus === "VERIFIED" ? "var(--color-verified)" : "var(--color-unverified)", marginBottom: 2 }}>
                  {component.verificationStatus}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {component.verificationStatus === "VERIFIED"
                    ? "All critical electrical specs scraped and validated"
                    : component.verificationStatus === "PARTIAL"
                    ? "Some specs missing — see fields below"
                    : "Critical specs unavailable — excluded from validated systems"}
                </div>
              </div>

              {/* Specs */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
                  Electrical Specifications
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {component.type === "solar_panel" && (
                    <>
                      <SpecRow label="Peak Power (Pmax)" value={component.specs.pmaxW} unit="W" />
                      <SpecRow label="Open-Circuit Voltage (Voc)" value={component.specs.vocV} unit="V" />
                      <SpecRow label="Max Power Voltage (Vmp)" value={component.specs.vmpV} unit="V" />
                      <SpecRow label="Short-Circuit Current (Isc)" value={component.specs.iscA} unit="A" />
                      <SpecRow label="Max Power Current (Imp)" value={component.specs.impA} unit="A" />
                      {component.specs.vocTempCoefficientPctPerC !== undefined && (
                        <SpecRow label="Voc Temp Coefficient" value={component.specs.vocTempCoefficientPctPerC} unit="%/°C" />
                      )}
                      {component.specs.efficiency !== undefined && (
                        <SpecRow label="Efficiency" value={component.specs.efficiency} unit="%" />
                      )}
                      {component.specs.cellType && <SpecRow label="Cell Type" value={component.specs.cellType} />}
                    </>
                  )}
                  {component.type === "inverter" && (
                    <>
                      <SpecRow label="Rated AC Output" value={component.specs.ratedAcOutputW} unit="W" />
                      <SpecRow label="Battery Voltage" value={component.specs.nominalBatteryVoltageV} unit="V" />
                      <SpecRow label="Max PV Voltage" value={component.specs.maxPvVoltageV} unit="V" />
                      <SpecRow label="MPPT Min Voltage" value={component.specs.mpptMinVoltageV} unit="V" />
                      <SpecRow label="MPPT Max Voltage" value={component.specs.mpptMaxVoltageV} unit="V" />
                      <SpecRow label="Max PV Current" value={component.specs.maxPvCurrentA} unit="A" />
                      <SpecRow label="Max PV Power" value={component.specs.maxPvPowerW} unit="W" />
                      {component.specs.inverterType && <SpecRow label="Type" value={component.specs.inverterType} />}
                    </>
                  )}
                  {component.type === "battery" && (
                    <>
                      <SpecRow label="Nominal Voltage" value={component.specs.nominalVoltageV} unit="V" />
                      <SpecRow label="Capacity" value={component.specs.capacityAh} unit="Ah" />
                      <SpecRow label="Energy" value={component.specs.capacityKwh} unit="kWh" />
                      {component.specs.dod !== undefined && (
                        <SpecRow label="Depth of Discharge" value={component.specs.dod} unit="%" />
                      )}
                      {component.specs.chemistry && <SpecRow label="Chemistry" value={component.specs.chemistry} />}
                      {component.specs.cycleLife !== undefined && (
                        <SpecRow label="Cycle Life" value={component.specs.cycleLife} unit="cycles" />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Provenance */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
                  Data Provenance
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <ProvenanceRow label="Source" value={component.source.storeName} />
                  <ProvenanceRow label="Collector" value={component.source.collectorId} mono />
                  <ProvenanceRow label="Run ID" value={component.source.scrapeRunId} mono />
                  <ProvenanceRow label="Scraped" value={new Date(component.source.scrapedAt).toLocaleString("en-IN")} />
                </div>
              </div>

              <a
                href={component.source.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ width: "100%", marginTop: 8, justifyContent: "center", textDecoration: "none" }}
              >
                View source →
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SpecRow({ label, value, unit }: { label: string; value: number | string | null | undefined; unit?: string }) {
  const isMissing = value === null || value === undefined;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: isMissing ? "var(--color-unverified)" : "var(--text-primary)",
        fontFamily: isMissing ? "inherit" : "var(--font-mono, 'JetBrains Mono', monospace)",
      }}>
        {isMissing ? "—" : `${value}${unit ? " " + unit : ""}`}
      </span>
    </div>
  );
}

function ProvenanceRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right", wordBreak: "break-all", fontFamily: mono ? "JetBrains Mono, monospace" : "inherit", fontWeight: mono ? 500 : 400 }}>
        {value}
      </span>
    </div>
  );
}

// ─── Simulate Sun Button ──────────────────────────────────────────────────────

function SimulateSunButton({ simState, onToggle }: { simState: SimulateState; onToggle: () => void }) {
  const isRunning = simState.state === "running";

  return (
    <button
      onClick={onToggle}
      className={isRunning ? "btn btn-amber" : "btn btn-ghost"}
      style={{ gap: 8 }}
      id="simulate-sun-button"
      aria-label={isRunning ? "Pause simulation" : "Simulate Sun"}
    >
      {isRunning ? (
        <>
          <PauseIcon />
          Pause simulation
        </>
      ) : (
        <>
          <SunIcon />
          Simulate Sun
        </>
      )}
    </button>
  );
}

// ─── Constraint Results ───────────────────────────────────────────────────────

function ConstraintList({ topology }: { topology: Topology }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {topology.constraints.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "8px 0",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: c.status === "passed" ? "var(--color-verified)" : c.status === "failed" ? "var(--color-error)" : "var(--border-default)",
          }}>
            {c.status === "passed" && <span style={{ color: "white", fontSize: 9, lineHeight: 1 }}>✓</span>}
            {c.status === "failed" && <span style={{ color: "white", fontSize: 9, lineHeight: 1 }}>✗</span>}
            {c.status === "unverified" && <span style={{ color: "var(--text-secondary)", fontSize: 8 }}>?</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{c.reason}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Rejection Stats ──────────────────────────────────────────────────────────

function RejectionStats() {
  const stats = DEMO_COMPILE_STATS;
  const rows = [
    { label: "Rejected by voltage", count: stats.rejectedByVoltage },
    { label: "Rejected by MPPT range", count: stats.rejectedByMppt },
    { label: "Rejected by current limit", count: stats.rejectedByCurrent },
    { label: "Rejected by array power", count: stats.rejectedByPower },
    { label: "Rejected by battery voltage", count: stats.rejectedByBatteryVoltage },
    { label: "Rejected by peak load", count: stats.rejectedByPeakLoad },
    { label: "Rejected by storage", count: stats.rejectedByStorage },
    { label: "Rejected by budget", count: stats.rejectedByBudget },
    { label: "Fully validated", count: stats.fullyValidated },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 12, color: r.label === "Fully validated" ? "var(--color-verified)" : "var(--text-secondary)" }}>{r.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: r.label === "Fully validated" ? "var(--color-verified)" : "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{r.count}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginTop: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Total evaluated</span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{stats.totalCandidates}</span>
      </div>
    </div>
  );
}

// ─── Simulate Sun Logic ───────────────────────────────────────────────────────

function useSimulateSun(topology: Topology) {
  const [simState, setSimState] = useState<SimulateState>({
    state: "idle",
    pvOutputW: 0,
    batteryChargePct: 65,
    loadDrawW: 0,
    batteryFlowW: 0,
    flowEdges: [],
    timeOfDay: 12,
  });
  const animRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const toggle = useCallback(() => {
    if (simState.state === "running") {
      clearInterval(animRef.current);
      setSimState((s) => ({ ...s, state: "paused" }));
    } else {
      setSimState((s) => ({ ...s, state: "running" }));
    }
  }, [simState.state]);

  useEffect(() => {
    if (simState.state !== "running") return;

    let t = simState.timeOfDay;
    const peakLoad = topology.metrics.peakOutputW;
    const arrayPeak = topology.pvArray.arrayPowerW;

    animRef.current = setInterval(() => {
      t = (t + 0.2) % 24;

      // Simplified solar curve: peak at midday (t=12)
      const solarFactor = Math.max(0, Math.sin(((t - 6) / 12) * Math.PI));
      const pvW = arrayPeak * solarFactor * 0.8;

      // Load is mostly constant with slight variation
      const loadW = peakLoad * (0.5 + 0.2 * Math.sin(t));

      // Battery charges if PV > Load, discharges if PV < Load
      const netW = pvW - loadW;
      const battFlow = netW * 0.9; // 90% efficiency
      let newBatPct = simState.batteryChargePct + (battFlow / (topology.batteryUnitCount * 1200)) * 0.5;
      newBatPct = Math.max(10, Math.min(95, newBatPct));

      setSimState((prev) => ({
        ...prev,
        timeOfDay: t,
        pvOutputW: Math.round(pvW),
        loadDrawW: Math.round(loadW),
        batteryFlowW: Math.round(battFlow),
        batteryChargePct: Math.round(newBatPct),
        flowEdges: pvW > 0 ? ["pv-to-inv", "inv-to-load"] : ["bat-to-inv", "inv-to-load"],
      }));
    }, 100);

    return () => clearInterval(animRef.current);
  }, [simState.state]); // eslint-disable-line

  return { simState, toggle };
}

// ─── Canvas Loading ───────────────────────────────────────────────────────────

function CanvasLoading() {
  return (
    <div
      className="topology-canvas tall"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-subtle)" }}
    >
      <div style={{ textAlign: "center" }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ fontSize: 13, color: "var(--text-tertiary)" }}
        >
          Loading topology canvas…
        </motion.div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 1V2.5M7.5 12.5V14M1 7.5H2.5M12.5 7.5H14M3.05 3.05L4.11 4.11M10.89 10.89L11.95 11.95M11.95 3.05L10.89 4.11M4.11 10.89L3.05 11.95" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2" y="1.5" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="8" y="1.5" width="3" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignPage() {
  const topology: Topology = DEMO_TOPOLOGY;
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showConstraints, setShowConstraints] = useState(false);
  const { simState, toggle: toggleSim } = useSimulateSun(topology);

  const metrics = topology.metrics;
  const totalCostL = (metrics.totalCostInr / 100000).toFixed(2);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-base)" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-base)", position: "sticky", top: 0, zIndex: 30 }}>
        <div className="container-main" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none" }}>
              ← Projects
            </Link>
            <span style={{ color: "var(--border-default)" }}>/</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Farmhouse 8kWh Off-grid</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              fontSize: 11,
              color: topology.validationStatus === "VALIDATED" ? "var(--color-verified)" : "var(--accent-700)",
              fontWeight: 600,
              background: topology.validationStatus === "VALIDATED" ? "var(--color-verified-bg)" : "var(--color-warning-bg)",
              padding: "3px 8px",
              borderRadius: 99,
              border: `1px solid ${topology.validationStatus === "VALIDATED" ? "rgba(5,150,105,0.2)" : "rgba(245,158,11,0.2)"}`,
            }}>
              ✓ {topology.validationStatus}
            </div>
            <SimulateSunButton simState={simState} onToggle={toggleSim} />
            <button className="btn btn-ghost btn-sm" id="save-project-btn">Save project</button>
          </div>
        </div>
      </header>

      <div className="container-main" style={{ paddingBlock: "1.5rem 3rem" }}>

        {/* Simulation banner */}
        <AnimatePresence>
          {simState.state === "running" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "var(--accent-50)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                  <SunIconSmall />
                </motion.div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-700)" }}>
                  Simulating — Time {Math.floor(simState.timeOfDay).toString().padStart(2, "0")}:{Math.round((simState.timeOfDay % 1) * 60).toString().padStart(2, "0")}
                </span>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <SimMetric label="PV Output" value={`${(simState.pvOutputW / 1000).toFixed(2)} kW`} />
                <SimMetric label="Load" value={`${(simState.loadDrawW / 1000).toFixed(2)} kW`} />
                <SimMetric label="Battery" value={`${simState.batteryChargePct}%`} color={simState.batteryFlowW > 0 ? "var(--color-verified)" : "var(--accent-600)"} />
                <SimMetric label="Flow" value={simState.batteryFlowW > 0 ? "Charging" : "Discharging"} color={simState.batteryFlowW > 0 ? "var(--color-verified)" : "var(--accent-600)"} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>Illustrative simulation — not irradiance-accurate</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "1.5rem", border: "1px solid var(--border-subtle)" }}>
          {[
            { label: "Component cost", value: `₹${totalCostL}L`, sub: `of ₹2L budget`, isStatus: false },
            { label: "Daily energy", value: `${metrics.dailyEnergyKwh.toFixed(1)} kWh`, sub: "at 5 peak sun hrs", isStatus: false },
            { label: "Usable storage", value: `${metrics.storedEnergyKwh.toFixed(1)} kWh`, sub: `${topology.batteryUnitCount} battery units`, isStatus: false },
            { label: "Validation", value: topology.validationStatus, sub: `${topology.constraints.filter(c => c.status === "passed").length}/${topology.constraints.length} checks passed`, isStatus: true },
          ].map((m, i) => (
            <div key={i} style={{ padding: "1rem 1.25rem", background: "white" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 6 }}>
                {m.label}
              </div>
              <div style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: m.isStatus
                  ? (topology.validationStatus === "VALIDATED" ? "var(--color-verified)" : "var(--accent-700)")
                  : "var(--text-primary)",
                lineHeight: 1,
                marginBottom: 4,
              }}>
                {m.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Main layout: canvas + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }}>
          {/* Canvas */}
          <div>
            <TopologyCanvas
              topology={topology}
              simState={simState}
              onNodeClick={(id) => setSelectedNode(id === selectedNode ? null : id)}
            />
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8, textAlign: "center" }}>
              Click any component to view scraped specifications and provenance
            </p>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Topology summary */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
                Configuration
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ConfigRow label="Array" value={`${topology.pvArray.seriesCount}S × ${topology.pvArray.parallelCount}P (${topology.pvArray.totalPanels} panels)`} />
                <ConfigRow label="Array power" value={`${(topology.pvArray.arrayPowerW / 1000).toFixed(2)} kWp`} />
                <ConfigRow label="Inverter" value={`${topology.inverter.manufacturer} ${topology.inverter.model}`} />
                <ConfigRow label="Battery" value={`${topology.batteryUnitCount}× ${topology.battery.manufacturer}`} />
                <ConfigRow label="Bank voltage" value={`${topology.batteryBankVoltageV}V DC`} />
              </div>
            </div>

            {/* Constraints toggle */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
              <button
                onClick={() => setShowConstraints(!showConstraints)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: showConstraints ? 12 : 0,
                }}
              >
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600 }}>
                  Constraints ({topology.constraints.filter(c => c.status === "passed").length}/{topology.constraints.length} passed)
                </span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", transform: showConstraints ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>▾</span>
              </button>
              <AnimatePresence>
                {showConstraints && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <ConstraintList topology={topology} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Rejection stats */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
                Candidate search
              </div>
              <RejectionStats />
            </div>

            {/* Sources */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 12 }}>
                Data sources
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[topology.pvArray.panel, topology.inverter, topology.battery].map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-verified)", marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{c.source.storeName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>{c.source.collectorId}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/sources" style={{ fontSize: 12, color: "var(--accent-700)", textDecoration: "none", display: "block", marginTop: 12 }}>
                View source health →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Component drawer */}
      <ComponentDrawer
        nodeId={selectedNode}
        topology={topology}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SimMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? "var(--accent-800)", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function SunIconSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.5" fill="var(--accent-500)" />
      <path d="M7 1V2.5M7 11.5V13M1 7H2.5M11.5 7H13M2.93 2.93L3.99 3.99M10.01 10.01L11.07 11.07M11.07 2.93L10.01 3.99M3.99 10.01L2.93 11.07" stroke="var(--accent-500)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
