"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

// ─── Solar Panel Node ─────────────────────────────────────────────────────────

export interface SolarPanelNodeData {
  label: string;
  seriesCount: number;
  parallelCount: number;
  totalPanels: number;
  pmaxW: number | null;
  arrayPowerW: number;
  manufacturer: string;
  model: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "PARTIAL";
  isSelected?: boolean;
  isAnimating?: boolean;
}

export const SolarPanelNode = memo(function SolarPanelNode({ data, selected }: NodeProps) {
  const d = data as unknown as SolarPanelNodeData;
  const powerKw = d.arrayPowerW / 1000;

  return (
    <div
      className="sld-node"
      style={{
        width: 180,
        background: selected ? "var(--accent-50)" : "white",
        borderColor: selected ? "var(--accent-500)" : "var(--border-default)",
        padding: "12px 14px",
      }}
    >
      {/* PV Panel Icon */}
      <div style={{ marginBottom: 8 }}>
        <PanelGrid seriesCount={d.seriesCount} parallelCount={d.parallelCount} />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
        PV Array
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
        {d.seriesCount}S × {d.parallelCount}P
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
        {d.totalPanels} panels · {powerKw.toFixed(2)} kWp
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.4 }}>
        {d.manufacturer}<br />{d.model}
      </div>

      <div style={{ marginTop: 8 }}>
        <VerificationBadge status={d.verificationStatus} />
      </div>

      <Handle type="source" position={Position.Right} id="pv-out" style={handleStyle} />
    </div>
  );
});

// ─── Inverter Node ────────────────────────────────────────────────────────────

export interface InverterNodeData {
  manufacturer: string;
  model: string;
  ratedAcOutputW: number | null;
  nominalBatteryVoltageV: number | null;
  maxPvVoltageV: number | null;
  mpptMinVoltageV: number | null;
  mpptMaxVoltageV: number | null;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "PARTIAL";
  collectorId: string;
  isAnimating?: boolean;
}

export const InverterNode = memo(function InverterNode({ data, selected }: NodeProps) {
  const d = data as unknown as InverterNodeData;
  const outputKw = d.ratedAcOutputW !== null ? (d.ratedAcOutputW / 1000).toFixed(1) : "—";

  return (
    <div
      className="sld-node"
      style={{
        width: 200,
        background: selected ? "#FFF8F0" : "white",
        borderColor: selected ? "var(--accent-500)" : "var(--border-default)",
        padding: "14px 16px",
        position: "relative",
      }}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Left} id="pv-in" style={{ ...handleStyle, top: "35%" }} />
      <Handle type="target" position={Position.Bottom} id="bat-in" style={{ ...handleStyle, left: "60%" }} />
      <Handle type="source" position={Position.Right} id="ac-out" style={handleStyle} />

      {/* Icon */}
      <div style={{ marginBottom: 10 }}>
        <InverterIcon />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
        Hybrid Inverter
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
        {d.manufacturer}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
        {d.model}
      </div>

      {/* Spec pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <SpecPill label="Output" value={`${outputKw} kW`} />
        {d.nominalBatteryVoltageV !== null && (
          <SpecPill label="Bat" value={`${d.nominalBatteryVoltageV}V`} />
        )}
        {d.mpptMinVoltageV !== null && d.mpptMaxVoltageV !== null && (
          <SpecPill label="MPPT" value={`${d.mpptMinVoltageV}–${d.mpptMaxVoltageV}V`} color="blue" />
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <VerificationBadge status={d.verificationStatus} />
      </div>
    </div>
  );
});

// ─── Battery Node ─────────────────────────────────────────────────────────────

export interface BatteryNodeData {
  manufacturer: string;
  model: string;
  unitCount: number;
  nominalVoltageV: number | null;
  capacityKwh: number | null;
  chemistry: string | null;
  bankVoltageV: number;
  usableKwh: number;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "PARTIAL";
  chargePct?: number; // 0–100 for simulation
  isAnimating?: boolean;
}

export const BatteryNode = memo(function BatteryNode({ data, selected }: NodeProps) {
  const d = data as unknown as BatteryNodeData;
  const chargePct = d.chargePct ?? 65;

  return (
    <div
      className="sld-node"
      style={{
        width: 180,
        background: selected ? "#F0FDF4" : "white",
        borderColor: selected ? "var(--color-verified)" : "var(--border-default)",
        padding: "12px 14px",
      }}
    >
      <Handle type="source" position={Position.Top} id="bat-out" style={{ ...handleStyle, left: "40%" }} />

      {/* Battery icon with charge level */}
      <div style={{ marginBottom: 8 }}>
        <BatteryIcon chargePct={chargePct} isAnimating={d.isAnimating} />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
        Battery Bank
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
        {d.unitCount}× {d.manufacturer}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
        {d.model}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <SpecPill label="Bank" value={`${d.bankVoltageV}V`} />
        <SpecPill label="Usable" value={`${d.usableKwh.toFixed(1)} kWh`} color="green" />
        {d.chemistry && <SpecPill label="" value={d.chemistry} />}
      </div>

      <div style={{ marginTop: 8 }}>
        <VerificationBadge status={d.verificationStatus} />
      </div>
    </div>
  );
});

// ─── Load Node ────────────────────────────────────────────────────────────────

export interface LoadNodeData {
  peakLoadKw: number;
  dailyEnergyKwh: number;
  isAnimating?: boolean;
  drawW?: number;
}

export const LoadNode = memo(function LoadNode({ data }: NodeProps) {
  const d = data as unknown as LoadNodeData;

  return (
    <div
      className="sld-node"
      style={{
        width: 148,
        padding: "12px 14px",
        background: "var(--surface-subtle)",
        borderColor: "var(--border-default)",
      }}
    >
      <Handle type="target" position={Position.Left} id="ac-in" style={handleStyle} />

      <div style={{ marginBottom: 8 }}>
        <LoadIcon isAnimating={d.isAnimating} />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
        AC Load
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
        {d.peakLoadKw} kW
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
        {d.dailyEnergyKwh} kWh/day target
      </div>
      {d.drawW !== undefined && d.drawW > 0 && (
        <div style={{ fontSize: 11, color: "var(--accent-600)", fontWeight: 600, marginTop: 4 }}>
          ↻ {(d.drawW / 1000).toFixed(1)} kW drawing
        </div>
      )}
    </div>
  );
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelGrid({ seriesCount, parallelCount }: { seriesCount: number; parallelCount: number }) {
  const cols = Math.min(seriesCount, 4);
  const rows = Math.min(parallelCount, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "fit-content" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 2 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              style={{
                width: 18,
                height: 12,
                borderRadius: 2,
                background: "linear-gradient(135deg, var(--accent-300), var(--accent-500))",
                border: "1px solid var(--accent-400)",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function InverterIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="2" y="6" width="24" height="16" rx="3" stroke="var(--accent-500)" strokeWidth="1.5" fill="var(--accent-50)" />
      <path d="M8 14L11 11L14 14L17 11L20 14" stroke="var(--accent-600)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="10" r="1.5" fill="var(--color-verified)" />
    </svg>
  );
}

function BatteryIcon({ chargePct, isAnimating }: { chargePct: number; isAnimating?: boolean }) {
  const fillWidth = Math.round((chargePct / 100) * 18);
  const fillColor = chargePct > 60 ? "var(--color-verified)" : chargePct > 25 ? "var(--accent-500)" : "var(--color-error)";

  return (
    <svg width="32" height="18" viewBox="0 0 32 18">
      <rect x="1" y="3" width="26" height="12" rx="2.5" stroke="var(--border-strong)" strokeWidth="1.5" fill="white" />
      <rect x="27" y="6" width="3" height="6" rx="1" fill="var(--border-strong)" />
      <rect
        x="3"
        y="5"
        width={fillWidth}
        height={8}
        rx={1.5}
        fill={fillColor}
        style={{
          transition: "width 0.8s ease, fill 0.5s ease",
          ...(isAnimating ? { animation: "batteryPulse 1.5s ease-in-out infinite" } : {}),
        }}
      />
      <style>{`@keyframes batteryPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
    </svg>
  );
}

function LoadIcon({ isAnimating }: { isAnimating?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L3 9V21H21V9L12 3Z" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinejoin="round" fill="var(--surface-muted)" />
      <rect x="9" y="14" width="6" height="7" rx="0.5" stroke="var(--text-secondary)" strokeWidth="1.2" fill="white" />
      {isAnimating && (
        <circle cx="12" cy="10" r="2" fill="var(--accent-400)" style={{ animation: "loadPulse 1s ease-in-out infinite" }} />
      )}
      <style>{`@keyframes loadPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </svg>
  );
}

function VerificationBadge({ status }: { status: "VERIFIED" | "UNVERIFIED" | "PARTIAL" }) {
  const config = {
    VERIFIED: { label: "Verified", bg: "var(--color-verified-bg)", color: "var(--color-verified)", border: "rgba(5,150,105,0.2)", dot: "var(--color-verified)" },
    UNVERIFIED: { label: "Unverified", bg: "var(--color-unverified-bg)", color: "var(--color-unverified)", border: "rgba(107,114,128,0.2)", dot: "var(--color-unverified)" },
    PARTIAL: { label: "Partial", bg: "var(--color-warning-bg)", color: "var(--accent-700)", border: "rgba(245,158,11,0.2)", dot: "var(--accent-500)" },
  }[status];

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 7px",
      borderRadius: 99,
      background: config.bg,
      border: `1px solid ${config.border}`,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: config.dot }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: config.color, letterSpacing: "0.04em" }}>
        {config.label}
      </span>
    </div>
  );
}

function SpecPill({ label, value, color = "neutral" }: { label: string; value: string; color?: "neutral" | "blue" | "green" }) {
  const colors = {
    neutral: { bg: "var(--surface-muted)", text: "var(--text-secondary)" },
    blue: { bg: "var(--color-info-bg)", text: "var(--color-info)" },
    green: { bg: "var(--color-verified-bg)", text: "var(--color-verified)" },
  }[color];

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "2px 6px",
      borderRadius: 4,
      background: colors.bg,
      fontSize: 10,
      color: colors.text,
      fontWeight: 500,
    }}>
      {label && <span style={{ opacity: 0.7 }}>{label}:</span>}
      <span>{value}</span>
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "var(--accent-400)",
  border: "1.5px solid var(--accent-600)",
  borderRadius: "50%",
};

export const nodeTypes = {
  solarPanel: SolarPanelNode,
  inverter: InverterNode,
  battery: BatteryNode,
  load: LoadNode,
};
