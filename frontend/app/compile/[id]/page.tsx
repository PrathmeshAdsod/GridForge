"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type StageStatus = "idle" | "running" | "complete" | "error";

interface CompileStage {
  id: string;
  label: string;
  detail?: string;
}

const STAGES: CompileStage[] = [
  { id: "parsing", label: "Understanding requirement" },
  { id: "fetching", label: "Loading validated fixture set" },
  { id: "validating", label: "Validating electrical constraints" },
  { id: "compiling", label: "Compiling topology" },
  { id: "explaining", label: "Preparing explanation" },
];

interface CompileStats {
  panels: number;
  inverters: number;
  batteries: number;
  candidates: number;
  rejected: number;
  validated: number;
  warnings: number;
}

async function runMockCompilation(
  onStageUpdate: (stageId: string, status: StageStatus, detail?: string) => void,
  onStats: (stats: Partial<CompileStats>) => void
): Promise<void> {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  onStageUpdate("parsing", "running");
  await delay(900);
  onStageUpdate("parsing", "complete", "8 kWh/day · 3 kW peak · ₹2L budget · Off-grid");

  onStageUpdate("fetching", "running");
  await delay(400);
  onStats({ panels: 6 });
  await delay(300);
  onStats({ panels: 12, inverters: 4 });
  await delay(400);
  onStats({ panels: 18, inverters: 11, batteries: 9 });
  await delay(600);
  onStageUpdate("fetching", "complete", "Validated demo component catalogue loaded");

  onStageUpdate("validating", "running");
  await delay(300);
  onStats({ candidates: 40 });
  await delay(300);
  onStats({ candidates: 90, rejected: 51 });
  await delay(400);
  onStats({ candidates: 143, rejected: 137 });
  await delay(500);
  onStats({ candidates: 143, rejected: 137, validated: 6, warnings: 0 });
  onStageUpdate("validating", "complete", "143 evaluated · 137 rejected · 6 validated");

  onStageUpdate("compiling", "running");
  await delay(700);
  onStageUpdate("compiling", "complete", "Demo topology selected from the validated fixture set");

  onStageUpdate("explaining", "running");
  await delay(600);
  onStageUpdate("explaining", "complete");
}

function StageRow({
  stage,
  status,
  detail,
  index,
}: {
  stage: CompileStage;
  status: StageStatus;
  detail?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.875rem 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {status === "complete" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <CheckIcon />
          </motion.div>
        )}
        {status === "running" && <PulsingDot />}
        {status === "idle" && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--border-default)" }} />
        )}
        {status === "error" && <ErrorDot />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: status === "idle" ? "var(--text-tertiary)" : "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {stage.label}
        </span>
        <AnimatePresence>
          {detail && status === "complete" && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "1px" }}
            >
              {detail}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flexShrink: 0 }}>
        {status === "running" && (
          <span style={{ fontSize: "12px", color: "var(--accent-600)", fontWeight: 500 }}>Running</span>
        )}
        {status === "complete" && (
          <span style={{ fontSize: "12px", color: "var(--color-verified)", fontWeight: 500 }}>Done</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: "12px", color: "var(--color-error)", fontWeight: 500 }}>Error</span>
        )}
      </div>
    </motion.div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number | null; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: color ?? "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {value === null ? "N/A" : value}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="var(--color-verified)" />
      <path d="M5.5 9L7.5 11L12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulsingDot() {
  return (
    <div style={{ position: "relative", width: 18, height: 18 }}>
      <motion.div
        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "var(--accent-300)",
        }}
      />
      <div style={{
        position: "absolute",
        inset: "4px",
        borderRadius: "50%",
        background: "var(--accent-500)",
      }} />
    </div>
  );
}

function ErrorDot() {
  return (
    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--color-error)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "white", fontSize: "10px", fontWeight: 700 }}>!</span>
    </div>
  );
}

function CompilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "Off-grid farmhouse using 6.5 kWh/day, 3 kW peak load, under ₹2.5 lakh in India.";

  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(
    Object.fromEntries(STAGES.map((s) => [s.id, "idle"]))
  );
  const [stageDetails, setStageDetails] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<CompileStats>({
    panels: 0,
    inverters: 0,
    batteries: 0,
    candidates: 0,
    rejected: 0,
    validated: 0,
    warnings: 0,
  });
  const [isDone, setIsDone] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    runMockCompilation(
      (stageId, status, detail) => {
        setStageStatuses((prev) => ({ ...prev, [stageId]: status }));
        if (detail) setStageDetails((prev) => ({ ...prev, [stageId]: detail }));
      },
      (newStats) => {
        setStats((prev) => ({ ...prev, ...newStats }));
      }
    ).then(() => {
      setIsDone(true);
      setTimeout(() => {
        router.push("/design/demo");
      }, 1200);
    });
  }, [router]);

  const completedCount = STAGES.filter((s) => stageStatuses[s.id] === "complete").length;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-base)" }}>
      <div style={{ height: "2px", background: "var(--border-subtle)", position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <motion.div
          style={{ height: "100%", background: "var(--accent-500)", transformOrigin: "left" }}
          animate={{ scaleX: completedCount / STAGES.length }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "5rem 2rem 4rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <Link href="/" style={{ fontSize: "13px", color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", marginBottom: "1.5rem" }}>
            ← Back
          </Link>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--text-tertiary)", marginBottom: 8 }}>DEMO MODE · VALIDATED FIXTURES</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.025em", marginBottom: "0.5rem" }}>
            Compiling demo system
          </h1>
          <p style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            background: "var(--surface-subtle)",
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            fontStyle: "italic",
          }}>
            &ldquo;{query}&rdquo;
          </p>
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          {STAGES.map((stage, i) => (
            <StageRow
              key={stage.id}
              stage={stage}
              status={stageStatuses[stage.id] ?? "idle"}
              detail={stageDetails[stage.id]}
              index={i}
            />
          ))}
        </div>

        <AnimatePresence>
          {stats.panels > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "white",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: "1.25rem" }}>
                Validated fixture set
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <StatCell label="Panels" value={stats.panels} color="var(--accent-700)" />
                <StatCell label="Inverters" value={stats.inverters} />
                <StatCell label="Batteries" value={stats.batteries} />
              </div>

              {stats.candidates > 0 && (
                <>
                  <div style={{ height: "1px", background: "var(--border-subtle)", marginBottom: "1.25rem" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
                    <StatCell label="Candidates" value={stats.candidates} />
                    <StatCell label="Rejected" value={stats.rejected} color="var(--color-error)" />
                    <StatCell label="Validated" value={stats.validated} color="var(--color-verified)" />
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: "var(--color-verified-bg)",
                border: "1px solid rgba(5,150,105,0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--color-verified)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "white", fontSize: "11px" }}>✓</span>
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-verified)" }}>
                  Demo topology compiled from validated fixtures
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Opening design view...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CompilePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Initializing...</p>
      </div>
    }>
      <CompilePageInner />
    </Suspense>
  );
}
