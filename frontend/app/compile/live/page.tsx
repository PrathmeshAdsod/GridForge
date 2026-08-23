"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";

type LiveStage =
  | 'parsing'
  | 'triggering_scraper'
  | 'scraping'
  | 'solving'
  | 'complete'
  | 'no_solution'
  | 'error';

const LIVE_READY_PROMPT = 'Off-grid farmhouse using 6.5 kWh/day, 3 kW peak load, under ₹2.5 lakh in India.';

const STAGE_LABELS: Record<LiveStage, string> = {
  parsing: 'Parsing requirement with Gemini…',
  triggering_scraper: 'Triggering Bright Data Scraper Studio…',
  scraping: 'Collecting & verifying live component data…',
  solving: 'Running deterministic electrical compiler…',
  complete: 'Live system compiled',
  no_solution: 'No valid system found',
  error: 'Live pipeline error',
};

const NO_SOLUTION_CODES = new Set([
  'no_valid_topology',
  'insufficient_verified_components',
  'incomplete_requirement',
]);

function CompileLiveEntry() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";
  const started = useRef(false);
  const [stage, setStage] = useState<LiveStage>('parsing');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (started.current || !q) return;
    started.current = true;

    async function run() {
      try {
        setStage('parsing');
        const parseResponse = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nl: q }),
        });
        const parsePayload = await parseResponse.json();

        if (!parseResponse.ok || !parsePayload.requirement) {
          throw new Error(parsePayload.error ?? 'Could not parse the requirement')
        }

        setStage('triggering_scraper');
        await new Promise(resolve => setTimeout(resolve, 250));
        setStage('scraping');

        const compileResponse = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'live',
            requirement: parsePayload.requirement,
            nl: q,
          }),
        });
        const result = await compileResponse.json();

        if (!compileResponse.ok || !result.ok) {
          const isNoSolution = NO_SOLUTION_CODES.has(result.error);
          setStage(isNoSolution ? 'no_solution' : 'error');

          const assumptions = Array.isArray(result.assumptions)
            ? `\nAssumptions: ${result.assumptions.join(' · ')}`
            : ''

          const candidateSummary = result.stats && typeof result.stats.totalCandidates === 'number'
            ? `\n${result.stats.totalCandidates.toLocaleString()} candidate configurations were evaluated against the live inventory.`
            : ''

          setErrorDetail(`${result.detail ?? result.error ?? `HTTP ${compileResponse.status}`}${candidateSummary}${assumptions}`)
          return
        }

        setStage('solving');
        await new Promise(resolve => setTimeout(resolve, 300));
        setStage('complete');

        const runId = `live-${Date.now()}`;
        sessionStorage.setItem(`compile-${runId}`, JSON.stringify({
          mode: 'live',
          q,
          requirement: parsePayload.requirement,
          result,
        }));

        await new Promise(resolve => setTimeout(resolve, 350));
        router.replace(`/design/live/${runId}`);
      } catch (error) {
        setStage('error');
        setErrorDetail(error instanceof Error ? error.message : 'Unknown live pipeline error');
      }
    }

    run();
  }, [q, router]);

  const isError = stage === 'error';
  const isNoSolution = stage === 'no_solution';
  const isStopped = isError || isNoSolution;
  const steps: LiveStage[] = ['parsing', 'triggering_scraper', 'scraping', 'solving'];
  const currentIndex = steps.indexOf(stage);

  const statusBackground = isError
    ? 'var(--color-error-bg)'
    : isNoSolution
      ? 'rgba(245,158,11,0.08)'
      : 'rgba(245,158,11,0.08)';

  const statusBorder = isError
    ? 'var(--color-error)'
    : 'rgba(245,158,11,0.22)';

  const statusColor = isError
    ? 'var(--color-error)'
    : 'var(--accent-700)';

  return (
    <main style={{
      minHeight: "100dvh",
      display: "grid",
      placeItems: "center",
      background: "var(--surface-base)",
      padding: "2rem",
    }}>
      <section style={{ width: "min(560px, 100%)" }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}>← GridForge</Link>
        </div>

        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 10px",
          borderRadius: 999,
          background: statusBackground,
          border: `1px solid ${statusBorder}`,
          fontSize: 10,
          fontWeight: 700,
          color: statusColor,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 18,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {isError ? 'Live pipeline stopped' : isNoSolution ? 'Live inventory checked' : 'Live · Bright Data'}
        </div>

        <h1 style={{ fontSize: 28, letterSpacing: '-0.04em', fontWeight: 650, marginBottom: 8 }}>
          {STAGE_LABELS[stage]}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 26 }}>
          {q}
        </p>

        {!isStopped && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {steps.map((step, index) => (
              <div key={step} style={{
                height: 3,
                flex: 1,
                borderRadius: 99,
                background: index <= currentIndex || stage === 'complete'
                  ? 'var(--accent-500)'
                  : 'var(--border-subtle)',
                opacity: index === currentIndex ? 1 : 0.65,
                transition: 'background 240ms ease',
              }} />
            ))}
          </div>
        )}

        {!isStopped && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
            {elapsed}s · Scraper Studio collection can take a few minutes
          </p>
        )}

        {isStopped && errorDetail && (
          <div style={{
            background: isError ? 'var(--color-error-bg)' : 'rgba(245,158,11,0.055)',
            border: `1px solid ${isError ? 'rgba(220,38,38,0.25)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.1rem',
          }}>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: 14 }}>
              {errorDetail}
            </p>

            {isNoSolution && (
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                The live pipeline is healthy. GridForge rejected this requirement because the currently available components cannot satisfy every engineering constraint at once.
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isError ? (
                <a href={`/compile/live?q=${encodeURIComponent(q)}`} className="btn btn-amber btn-sm" style={{ textDecoration: 'none' }}>Retry live</a>
              ) : (
                <a href={`/compile/live?q=${encodeURIComponent(LIVE_READY_PROMPT)}`} className="btn btn-amber btn-sm" style={{ textDecoration: 'none' }}>Try live-ready example</a>
              )}
              <Link href="/" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>Change requirement</Link>
              <a href={`/compile/demo?q=${encodeURIComponent(q)}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>Explore demo</a>
            </div>

            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 12 }}>
              Live Mode never silently falls back to fixtures.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function CompileLivePage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Loading…</main>}>
      <CompileLiveEntry />
    </Suspense>
  );
}
