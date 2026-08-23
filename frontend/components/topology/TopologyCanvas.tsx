"use client";

import { useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  Panel,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./SLDNodes";
import type { Topology, SimulateState } from "@/types";

// ─── Build Nodes from Topology ────────────────────────────────────────────────

function buildNodes(topology: Topology, simState: SimulateState): Node[] {
  const { pvArray, inverter, battery, batteryUnitCount, batteryBankVoltageV } = topology;
  const isAnimating = simState.state === "running";
  const dod = battery.specs.dod !== null && battery.specs.dod !== undefined ? battery.specs.dod / 100 : 0.8;
  const usableKwh = (battery.specs.capacityKwh ?? 0) * dod * batteryUnitCount;

  return [
    {
      id: "panel-array",
      type: "solarPanel",
      position: { x: 60, y: 220 },
      data: {
        label: "PV Array",
        seriesCount: pvArray.seriesCount,
        parallelCount: pvArray.parallelCount,
        totalPanels: pvArray.totalPanels,
        pmaxW: pvArray.panel.specs.pmaxW,
        arrayPowerW: pvArray.arrayPowerW,
        manufacturer: pvArray.panel.manufacturer,
        model: pvArray.panel.model,
        verificationStatus: pvArray.panel.verificationStatus,
        isAnimating,
      },
    },
    {
      id: "inverter",
      type: "inverter",
      position: { x: 340, y: 200 },
      data: {
        manufacturer: inverter.manufacturer,
        model: inverter.model,
        ratedAcOutputW: inverter.specs.ratedAcOutputW,
        nominalBatteryVoltageV: inverter.specs.nominalBatteryVoltageV,
        maxPvVoltageV: inverter.specs.maxPvVoltageV,
        mpptMinVoltageV: inverter.specs.mpptMinVoltageV,
        mpptMaxVoltageV: inverter.specs.mpptMaxVoltageV,
        verificationStatus: inverter.verificationStatus,
        collectorId: inverter.source.collectorId,
        isAnimating,
      },
    },
    {
      id: "battery",
      type: "battery",
      position: { x: 340, y: 420 },
      data: {
        manufacturer: battery.manufacturer,
        model: battery.model,
        unitCount: batteryUnitCount,
        nominalVoltageV: battery.specs.nominalVoltageV,
        capacityKwh: battery.specs.capacityKwh,
        chemistry: battery.specs.chemistry ?? null,
        bankVoltageV: batteryBankVoltageV,
        usableKwh,
        verificationStatus: battery.verificationStatus,
        chargePct: isAnimating ? simState.batteryChargePct : 65,
        isAnimating,
      },
    },
    {
      id: "load",
      type: "load",
      position: { x: 640, y: 220 },
      data: {
        peakLoadKw: (topology.metrics.peakOutputW / 1000).toFixed(1),
        dailyEnergyKwh: topology.metrics.dailyEnergyKwh.toFixed(1),
        isAnimating,
        drawW: isAnimating ? simState.loadDrawW : 0,
      },
    },
  ];
}

function buildEdges(simState: SimulateState): Edge[] {
  const isAnimating = simState.state === "running";
  const pvActive = isAnimating && simState.pvOutputW > 0;
  const batActive = isAnimating && simState.batteryFlowW !== 0;

  const baseStyle = {
    stroke: "var(--border-strong)",
    strokeWidth: 2,
  };

  const activeStyle = {
    stroke: "var(--accent-500)",
    strokeWidth: 2.5,
    strokeDasharray: "6 3",
  };

  return [
    {
      id: "pv-to-inv",
      source: "panel-array",
      target: "inverter",
      sourceHandle: "pv-out",
      targetHandle: "pv-in",
      type: "smoothstep",
      animated: pvActive,
      label: pvActive ? `${(simState.pvOutputW / 1000).toFixed(1)} kW DC` : "DC input",
      labelStyle: { fontSize: 11, fill: pvActive ? "var(--accent-700)" : "var(--text-tertiary)", fontWeight: pvActive ? 600 : 400 },
      labelBgStyle: { fill: "white", fillOpacity: 0.9, rx: 4 },
      style: pvActive ? activeStyle : baseStyle,
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: pvActive ? "var(--accent-500)" : "var(--border-strong)" },
    },
    {
      id: "bat-to-inv",
      source: "battery",
      target: "inverter",
      sourceHandle: "bat-out",
      targetHandle: "bat-in",
      type: "smoothstep",
      animated: batActive,
      label: batActive
        ? simState.batteryFlowW > 0
          ? `↑ ${(simState.batteryFlowW / 1000).toFixed(1)} kW charging`
          : `↓ ${(Math.abs(simState.batteryFlowW) / 1000).toFixed(1)} kW`
        : "48V DC",
      labelStyle: {
        fontSize: 11,
        fill: batActive
          ? simState.batteryFlowW > 0 ? "var(--color-verified)" : "var(--accent-700)"
          : "var(--text-tertiary)",
        fontWeight: batActive ? 600 : 400,
      },
      labelBgStyle: { fill: "white", fillOpacity: 0.9, rx: 4 },
      style: batActive ? { ...activeStyle, stroke: simState.batteryFlowW > 0 ? "var(--color-verified)" : "var(--accent-500)" } : baseStyle,
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "var(--border-strong)" },
    },
    {
      id: "inv-to-load",
      source: "inverter",
      target: "load",
      sourceHandle: "ac-out",
      targetHandle: "ac-in",
      type: "smoothstep",
      animated: isAnimating,
      label: isAnimating ? `${(simState.loadDrawW / 1000).toFixed(1)} kW AC` : "230V AC",
      labelStyle: { fontSize: 11, fill: isAnimating ? "var(--accent-700)" : "var(--text-tertiary)", fontWeight: isAnimating ? 600 : 400 },
      labelBgStyle: { fill: "white", fillOpacity: 0.9, rx: 4 },
      style: isAnimating ? activeStyle : baseStyle,
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: isAnimating ? "var(--accent-500)" : "var(--border-strong)" },
    },
  ];
}

// ─── Canvas Component ─────────────────────────────────────────────────────────

interface TopologyCanvasProps {
  topology: Topology;
  simState: SimulateState;
  onNodeClick?: (nodeId: string) => void;
}

export default function TopologyCanvas({ topology, simState, onNodeClick }: TopologyCanvasProps) {
  const initialNodes = useMemo(() => buildNodes(topology, simState), [topology]); // eslint-disable-line
  const initialEdges = useMemo(() => buildEdges(simState), [simState.state]); // eslint-disable-line

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update edges when simulation state changes
  useEffect(() => {
    setEdges(buildEdges(simState));
  }, [simState.state, simState.pvOutputW, simState.batteryFlowW, simState.loadDrawW, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update node data (battery charge, animation) during simulation
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === "battery") {
          return { ...n, data: { ...n.data, chargePct: simState.batteryChargePct, isAnimating: simState.state === "running" } };
        }
        if (n.id === "load") {
          return { ...n, data: { ...n.data, isAnimating: simState.state === "running", drawW: simState.loadDrawW } };
        }
        if (n.id === "panel-array") {
          return { ...n, data: { ...n.data, isAnimating: simState.state === "running" } };
        }
        return n;
      })
    );
  }, [simState.batteryChargePct, simState.state, simState.loadDrawW, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="topology-canvas tall">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        attributionPosition="bottom-left"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.4}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border-subtle)"
        />
        <Controls
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "solarPanel") return "var(--accent-300)";
            if (n.type === "inverter") return "var(--accent-500)";
            if (n.type === "battery") return "var(--color-verified)";
            return "var(--surface-muted)";
          }}
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
          }}
        />

        {/* Topology label */}
        <Panel position="top-left">
          <div style={{
            background: "white",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "6px 10px",
            boxShadow: "var(--shadow-xs)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Topology v{topology.version}
            </span>
            <div style={{ width: 1, height: 10, background: "var(--border-subtle)" }} />
            <span style={{ fontSize: 11, color: topology.validationStatus === "VALIDATED" ? "var(--color-verified)" : "var(--accent-600)", fontWeight: 600 }}>
              {topology.validationStatus}
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
