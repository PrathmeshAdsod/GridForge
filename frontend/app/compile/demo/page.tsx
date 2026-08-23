"use client";

/**
 * /compile/demo — Entry point for Demo Mode compilation.
 * 
 * Calls /api/compile with mode: "demo"
 * Shows clearly labeled "DEMO MODE" badge throughout.
 * Redirects to /compile/[id] with result.
 */

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

function CompileDemoEntry() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !q) return;
    started.current = true;

    async function run() {
      try {
        // Step 1: Parse with Gemini
        const parseResp = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nl: q }),
        });
        const parseData = await parseResp.json();
        const requirement = parseData.requirement ?? {
          systemType: 'off_grid', dailyEnergyKwh: 8, peakLoadKw: 3,
          budgetInr: 200000, location: 'India', autonomyDays: null,
          rawNl: q, parsedBy: 'fallback', confidence: 'low',
        };

        // Step 2: Compile in DEMO mode
        const compileResp = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'demo', requirement, nl: q }),
        });
        const result = await compileResp.json();

        // Store result in sessionStorage and navigate to display page
        const runId = `demo-${Date.now()}`;
        sessionStorage.setItem(`compile-${runId}`, JSON.stringify({
          mode: 'demo',
          q,
          requirement,
          result,
        }));

        router.replace(`/compile/${runId}?q=${encodeURIComponent(q)}&mode=demo`);
      } catch {
        // On error — fall back to static demo with error note
        router.replace(`/compile/run-demo-001?q=${encodeURIComponent(q)}&mode=demo`);
      }
    }

    run();
  }, [q, router]);

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--surface-base)",
      gap: "1rem"
    }}>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "6px",
        background: "var(--surface-subtle)",
        border: "1px solid var(--border-subtle)",
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--text-tertiary)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>
        ◼ DEMO MODE
      </div>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
        Compiling from validated fixtures…
      </p>
    </div>
  );
}

export default function CompileDemoPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-base)" }}>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Loading…</p>
      </div>
    }>
      <CompileDemoEntry />
    </Suspense>
  );
}
