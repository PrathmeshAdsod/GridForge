"use client";

/**
 * /compile/live — Entry point for Live Mode compilation.
 * 
 * Calls /api/compile with mode: "live"
 * Shows LIVE badge, animated scraping progress.
 * 
 * CRITICAL: Never falls back silently to demo data.
 * On live pipeline failure: shows error with full detail.
 */

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

type LiveStage = 
  | 'parsing'
  | 'triggering_scraper'
  | 'scraping'
  | 'normalizing'
  | 'solving'
  | 'complete'
  | 'error';

const STAGE_LABELS: Record<LiveStage, string> = {
  parsing: 'Parsing requirement with Gemini…',
  triggering_scraper: 'Triggering Bright Data collector…',
  scraping: 'Live scraping in progress…',
  normalizing: 'Normalizing & validating scraped data…',
  solving: 'Running constraint solver…',
  complete: 'System compiled from live data',
  error: 'Live pipeline error',
};

function CompileLiveEntry() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";
  const started = useRef(false);
  const [stage, setStage] = useState<LiveStage>('parsing');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (started.current || !q) return;
    started.current = true;

    async function run() {
      try {
        // Step 1: Parse NL
        setStage('parsing');
        const parseResp = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nl: q }),
        });
        const parseData = await parseResp.json();
        const requirement = parseData.requirement;

        // Step 2: Trigger live pipeline
        setStage('triggering_scraper');
        await new Promise(r => setTimeout(r, 500));
        setStage('scraping');

        const compileResp = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'live', requirement, nl: q }),
        });

        const result = await compileResp.json();

        if (!compileResp.ok || !result.ok) {
          // NEVER silently fall back to demo — show error
          setStage('error');
          setErrorDetail(
            result.detail ??
            result.error ??
            `HTTP ${compileResp.status}: Live pipeline returned an error`
          );
          return;
        }

        setStage('normalizing');
        await new Promise(r => setTimeout(r, 300));
        setStage('solving');
        await new Promise(r => setTimeout(r, 300));
        setStage('complete');

        // Store result and navigate
        const runId = `live-${Date.now()}`;
        sessionStorage.setItem(`compile-${runId}`, JSON.stringify({
          mode: 'live',
          q,
          requirement,
          result,
        }));

        router.replace(`/compile/${runId}?q=${encodeURIComponent(q)}&mode=live`);

      } catch (err) {
        // Network error — show error, DO NOT redirect to demo
        setStage('error');
        setErrorDetail(
          err instanceof Error ? err.message : 'Network error — check console'
        );
      }
    }

    run();
  }, [q, router]);

  const isError = stage === 'error';

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--surface-base)",
      gap: "1.25rem",
      padding: "2rem",
    }}>
      {/* Live badge */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "6px",
        background: isError ? "var(--color-error-bg)" : "rgba(245,158,11,0.08)",
        border: `1px solid ${isError ? "var(--color-error)" : "rgba(245,158,11,0.3)"}`,
        fontSize: "11px",
        fontWeight: 700,
        color: isError ? "var(--color-error)" : "var(--accent-600)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>
        {isError ? "⚠ LIVE PIPELINE ERROR" : "⚡ LIVE MODE"}
      </div>

      {/* Stage */}
      <p style={{ fontSize: 16, color: "var(--text-primary)", fontWeight: 500 }}>
        {STAGE_LABELS[stage]}
      </p>

      {/* Progress dots */}
      {!isError && stage !== 'complete' && (
        <div style={{ display: "flex", gap: "6px" }}>
          {(['parsing', 'triggering_scraper', 'scraping', 'normalizing', 'solving'] as LiveStage[]).map((s, i) => {
            const stageOrder = ['parsing', 'triggering_scraper', 'scraping', 'normalizing', 'solving'];
            const currentIdx = stageOrder.indexOf(stage);
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={s} style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isDone
                  ? "var(--accent-500)"
                  : isCurrent
                  ? "var(--accent-400)"
                  : "var(--border-default)",
                transition: "background 300ms",
                opacity: isCurrent ? 1 : isDone ? 0.8 : 0.4,
              }} />
            );
          })}
        </div>
      )}

      {/* Timer */}
      {!isError && (
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
          {elapsed}s — Live scraping may take 1–5 minutes
        </span>
      )}

      {/* Error detail */}
      {isError && errorDetail && (
        <div style={{
          maxWidth: 540,
          padding: "1.25rem",
          background: "var(--color-error-bg)",
          border: "1px solid var(--color-error)",
          borderRadius: "var(--radius-md)",
          textAlign: "left",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-error)", marginBottom: 8 }}>
            Pipeline Error — No fallback used
          </div>
          <p style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "monospace", lineHeight: 1.6 }}>
            {errorDetail}
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
            <a
              href={`/compile/demo?q=${encodeURIComponent(q)}`}
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                padding: "0.375rem 0.75rem",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
              }}
            >
              Switch to Demo Mode
            </a>
            <a
              href="/BRIGHT_DATA_SETUP.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                color: "var(--accent-600)",
                textDecoration: "none",
              }}
            >
              → Setup Guide
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompileLivePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-base)" }}>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Loading live compiler…</p>
      </div>
    }>
      <CompileLiveEntry />
    </Suspense>
  );
}
