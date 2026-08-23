"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ─── Shared Types (inline for now, will be extracted) ─────────────────────────

const EXAMPLE_PROMPTS = [
  "An off-grid setup for a small farmhouse using around 8 kWh/day, 3 kW peak load, under ₹2 lakh.",
  "Solar backup for a rural clinic, 12 kWh/day, 5 kW peak, budget ₹3.5 lakh.",
  "Off-grid cabin, 4 kWh/day, 1.5 kW peak, ₹80,000 budget in Himachal Pradesh.",
];

const NAV_LINKS = [
  { label: "Sources", href: "/sources" },
];

// ─── Mock Requirement Parser (will call Gemini backend) ──────────────────────

function parseMockRequirement(input: string): ParsedChips | null {
  const lower = input.toLowerCase();

  // Extract daily energy
  const kwhMatch = lower.match(/(\d+\.?\d*)\s*k?wh/);
  const dailyKwh = kwhMatch ? parseFloat(kwhMatch[1]) : null;

  // Extract peak load
  const kwMatch = lower.match(/(\d+\.?\d*)\s*kw\s*peak/);
  const peakKw = kwMatch ? parseFloat(kwMatch[1]) : null;

  // Extract budget
  const lakhMatch = lower.match(/₹?\s*(\d+\.?\d*)\s*lakh/);
  const budgetInr = lakhMatch ? parseFloat(lakhMatch[1]) * 100000 : null;

  // System type
  const isOffGrid = lower.includes("off-grid") || lower.includes("off grid") || lower.includes("backup");

  if (!dailyKwh && !budgetInr) return null;

  return {
    dailyKwh: dailyKwh ?? null,
    peakKw: peakKw ?? null,
    budgetInr: budgetInr ?? null,
    systemType: isOffGrid ? "Off-grid" : "Hybrid",
    location: lower.includes("himachal") ? "Himachal Pradesh" :
              lower.includes("india") ? "India" : "India",
  };
}

interface ParsedChips {
  dailyKwh: number | null;
  peakKw: number | null;
  budgetInr: number | null;
  systemType: string;
  location: string;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="w-full border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
      <nav className="container-main flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2.5 text-[var(--text-primary)]" aria-label="GridForge home">
          <GridForgeLogo />
          <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.02em" }}>
            GridForge
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                padding: "0.375rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                transition: "color 150ms ease, background 150ms ease",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "var(--surface-subtle)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {link.label}
            </a>
          ))}

          {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" && (
            <>
              <div style={{ width: "1px", height: "16px", background: "var(--border-subtle)", margin: "0 0.5rem" }} />
              <button className="btn btn-ghost btn-sm" aria-label="Sign in">
                Sign in
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

function GridForgeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill="var(--accent-500)" />
      <rect x="13" y="2" width="7" height="7" rx="1.5" fill="var(--accent-300)" />
      <rect x="2" y="13" width="7" height="7" rx="1.5" fill="var(--accent-300)" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" fill="var(--text-primary)" />
      <path d="M9 5.5H13M5.5 9V13M13 16.5H9M16.5 13V9" stroke="var(--text-primary)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Requirement Chip ─────────────────────────────────────────────────────────

function RequirementChip({ label, value, color = "neutral" }: {
  label: string;
  value: string;
  color?: "amber" | "neutral" | "green" | "blue";
}) {
  const colors = {
    amber: { bg: "var(--accent-50)", text: "var(--accent-800)", border: "rgba(245,158,11,0.25)" },
    neutral: { bg: "var(--surface-muted)", text: "var(--text-secondary)", border: "var(--border-subtle)" },
    green: { bg: "var(--color-verified-bg)", text: "var(--color-verified)", border: "rgba(5,150,105,0.2)" },
    blue: { bg: "var(--color-info-bg)", text: "var(--color-info)", border: "rgba(37,99,235,0.2)" },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "2px",
        padding: "0.4rem 0.75rem",
        borderRadius: "var(--radius-md)",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: colors.text, opacity: 0.7 }}>
        {label}
      </span>
      <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text, letterSpacing: "-0.01em" }}>
        {value}
      </span>
    </motion.div>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────

function NLComposer() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<ParsedChips | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Parse requirement as user types — calls real Gemini API
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (input.trim().length < 10) {
      // Clear derived parser state when the external input becomes incomplete.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChips(null);
      return;
    }
    setIsParsing(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nl: input }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const req = data.requirement;
          setChips({
            dailyKwh: req.dailyEnergyKwh,
            peakKw: req.peakLoadKw,
            budgetInr: req.budgetInr,
            systemType: req.systemType === 'off_grid' ? 'Off-grid' : req.systemType === 'on_grid' ? 'On-grid' : req.systemType === 'hybrid' ? 'Hybrid' : 'Unknown',
            location: req.location ?? 'India',
          });
        } else {
          // Fallback to local parser on API error
          const parsed = parseMockRequirement(input);
          setChips(parsed);
        }
      } catch {
        // Network error — use local fallback silently
        const parsed = parseMockRequirement(input);
        setChips(parsed);
      }
      setIsParsing(false);
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [input]);


  function handleExampleClick(prompt: string) {
    setInput(prompt);
  }

  async function handleCompile(mode: 'demo' | 'live' = 'demo') {
    if (!input.trim() || isCompiling) return;
    setIsCompiling(true);
    await new Promise((r) => setTimeout(r, 200));
    router.push(`/compile/${mode}?q=${encodeURIComponent(input)}`);
  }


  const canCompile = input.trim().length > 10;

  return (
    <div style={{ width: "100%", maxWidth: "680px" }}>
      {/* Main composer box */}
      <div
        style={{
          background: "white",
          border: "1.5px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 2px 8px rgba(17,17,16,0.06), 0 0 0 1px rgba(245,158,11,0)",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          overflow: "hidden",
        }}
        onFocus={() => {}}
      >
        <textarea
          ref={textareaRef}
          id="nl-composer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleCompile();
            }
          }}
          placeholder="Describe your energy requirement..."
          rows={3}
          style={{
            width: "100%",
            padding: "1.25rem 1.25rem 0.75rem",
            fontSize: "15px",
            lineHeight: "1.6",
            color: "var(--text-primary)",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}
          aria-label="Describe your energy requirement"
        />

        {/* Chips row */}
        <AnimatePresence>
          {chips && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                padding: "0 1.25rem 0.75rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {chips.systemType && (
                <RequirementChip label="System" value={chips.systemType} color="amber" />
              )}
              {chips.budgetInr && (
                <RequirementChip
                  label="Budget"
                  value={`₹${(chips.budgetInr / 100000).toFixed(1)}L`}
                  color="amber"
                />
              )}
              {chips.dailyKwh && (
                <RequirementChip
                  label="Daily energy"
                  value={`${chips.dailyKwh} kWh/day`}
                  color="neutral"
                />
              )}
              {chips.peakKw && (
                <RequirementChip
                  label="Peak load"
                  value={`${chips.peakKw} kW`}
                  color="neutral"
                />
              )}
              {chips.location && (
                <RequirementChip label="Location" value={chips.location} color="blue" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar — Demo / Live mode split */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.625rem 0.875rem 0.875rem",
            borderTop: chips ? "1px solid var(--border-subtle)" : "none",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
            {isParsing ? "Parsing with Gemini…" : canCompile ? "⌘↵ for demo · Shift+↵ for live" : "Describe your need above"}
          </span>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {/* Demo Mode — always available */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleCompile('demo')}
              disabled={!canCompile || isCompiling}
              id="compile-demo-button"
              aria-label="Compile in Demo Mode (deterministic fixtures)"
              title="Demo Mode — uses validated fixtures, instant results"
            >
              {isCompiling ? (
                <SpinnerIcon />
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
                  <rect x="1" y="1" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
                  <rect x="7" y="1" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
                  <rect x="1" y="7" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
                  <rect x="7" y="7" width="4" height="4" rx="0.5" fill="currentColor" />
                </svg>
              )}
              Demo
            </button>

            {/* Live Mode — calls real Bright Data */}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleCompile('live')}
              disabled={!canCompile || isCompiling}
              id="compile-live-button"
              aria-label="Compile in Live Mode — scrapes real component data"
              title="Live Mode — triggers real Bright Data scraper, uses real electrical specs"
              style={{
                background: canCompile && !isCompiling
                  ? "linear-gradient(135deg, var(--accent-500), var(--accent-600))"
                  : undefined,
              }}
            >
              {isCompiling ? (
                <>
                  <SpinnerIcon />
                  Compiling…
                </>
              ) : (
                <>
                  <BoltIcon />
                  Live compile
                </>
              )}
            </button>
          </div>
        </div>
      </div>


      {/* Example prompts */}
      <div style={{ marginTop: "1.25rem" }}>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "0.625rem", letterSpacing: "0.02em" }}>
          Try an example:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleExampleClick(prompt)}
              style={{
                textAlign: "left",
                fontSize: "13px",
                color: "var(--text-secondary)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                border: "1px solid transparent",
                cursor: "pointer",
                transition: "all 150ms ease",
                lineHeight: 1.5,
                letterSpacing: "-0.005em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-subtle)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <span style={{ color: "var(--accent-500)", marginRight: "0.5rem" }}>→</span>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Describe your need",
      description: "Write what you need in plain language. GridForge extracts requirements using Gemini.",
      icon: "✦",
    },
    {
      number: "02",
      title: "Live component fetch",
      description: "Bright Data Scraper Studio pulls real panels, inverters, and batteries from public solar storefronts.",
      icon: "◈",
    },
    {
      number: "03",
      title: "Constraint validation",
      description: "A deterministic engine verifies every electrical pairing — Voc, MPPT, current limits, battery compatibility.",
      icon: "◇",
    },
    {
      number: "04",
      title: "Topology compiled",
      description: "The optimal valid configuration is rendered as an interactive Single-Line Diagram with full provenance.",
      icon: "⬡",
    },
  ];

  return (
    <section style={{ paddingBlock: "5rem" }}>
      <div className="container-content">
        <div style={{ marginBottom: "3rem" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-600)", marginBottom: "0.5rem" }}>
            How it works
          </p>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", maxWidth: "520px", letterSpacing: "-0.03em" }}>
            From description to buildable system in seconds
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              style={{
                padding: "1.5rem",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)",
                background: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "18px", color: "var(--accent-500)" }}>{step.icon}</span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {step.number}
                </span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Recovery Story ───────────────────────────────────────────────────────────

function RecoveryStory() {
  return (
    <section style={{ paddingBlock: "4rem", background: "var(--surface-subtle)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="container-content">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-600)", marginBottom: "0.75rem" }}>
              Two-level recovery
            </p>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
              When the web breaks,<br />
              <span style={{ color: "var(--accent-600)" }}>Bright Data heals the source.</span><br />
              When supply changes,<br />
              <span style={{ color: "var(--color-verified)" }}>GridForge heals the system.</span>
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              GridForge distinguishes between a broken scraper (DOM drift) and a real business event (stockout). It self-heals the appropriate layer — never conflating infrastructure issues with supply reality.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              {
                label: "DOM drift detected",
                desc: "Field coverage dropped — Bright Data heals the same collector ID",
                color: "var(--color-error)",
                dot: "DEGRADED",
              },
              {
                label: "Self-healing triggered",
                desc: "Bright Data AI refactors selectors. Same collector ID retained.",
                color: "var(--accent-500)",
                dot: "HEALING",
              },
              {
                label: "Source recovered",
                desc: "Data verified after healing. Full coverage restored.",
                color: "var(--color-verified)",
                dot: "RECOVERED",
              },
              {
                label: "Real stockout detected",
                desc: "Schema intact, availability changed — GridForge recompiles with replacement.",
                color: "var(--accent-700)",
                dot: "REAL_WORLD",
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "white",
                  border: "1px solid var(--border-subtle)",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, marginTop: "5px", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border-subtle)", paddingBlock: "2rem" }}>
      <div className="container-main" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <GridForgeLogo />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>GridForge</span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {[
            { label: "GitHub", href: "https://github.com/PrathmeshAdsod/GridForge" },
            { label: "Bright Data", href: "https://brightdata.com" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{ fontSize: "13px", color: "var(--text-tertiary)", textDecoration: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          Engineering simulation — not certified installation design
        </p>
      </div>
    </footer>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8 1.5L3.5 7.5H7L6 12.5L10.5 6.5H7L8 1.5Z" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 1s linear infinite" }} aria-hidden="true">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 8" strokeLinecap="round" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main>
        {/* Hero Section */}
        <section style={{ paddingBlock: "6rem 4rem" }}>
          <div className="container-content">
            <div style={{ maxWidth: "680px", marginBottom: "3rem" }}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--accent-700)",
                    background: "var(--accent-50)",
                    padding: "0.25rem 0.625rem",
                    borderRadius: "var(--radius-full)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}>
                    Powered by Bright Data Scraper Studio
                  </span>
                </div>

                <h1 style={{
                  fontSize: "clamp(2rem, 5vw, 3rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                  color: "var(--text-primary)",
                  marginBottom: "1rem",
                }}>
                  Compile physical systems<br />
                  <span style={{ color: "var(--accent-600)" }}>from the live Web.</span>
                </h1>

                <p style={{
                  fontSize: "16px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                  maxWidth: "520px",
                  letterSpacing: "-0.01em",
                }}>
                  Describe what you need. GridForge finds live components from real solar suppliers, validates electrical constraints, and compiles a buildable energy system.
                </p>
              </motion.div>
            </div>

            {/* Composer */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <NLComposer />
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <HowItWorks />

        {/* Recovery Story */}
        <RecoveryStory />

        {/* Engineering Trust Section */}
        <section style={{ paddingBlock: "5rem" }}>
          <div className="container-content">
            <div style={{ maxWidth: "580px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "1rem" }}>
                Engineering integrity
              </p>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
                No hallucinated specs. No silent failures.
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "2rem" }}>
                Every electrical value comes from scraped public product pages — never from AI inference. Components with missing critical specifications are marked <strong style={{ color: "var(--color-unverified)" }}>UNVERIFIED</strong> and excluded from validated systems. If a system cannot be validated, GridForge says so — and explains why.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  "Voc, Vmp, Isc, Imp from scraped datasheets — never invented",
                  "Deterministic constraint engine — auditable, not a score",
                  "Gemini handles language. Never electrical values.",
                  "Every price, spec, and topology has Bright Data provenance",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ color: "var(--color-verified)", marginTop: "2px", flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
