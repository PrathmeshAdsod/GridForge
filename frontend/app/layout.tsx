import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GridForge — Compile Physical Systems from the Live Web",
  description:
    "GridForge finds live solar components from real suppliers, validates electrical constraints, and compiles a buildable off-grid energy system — powered by Bright Data Scraper Studio.",
  keywords: ["solar", "off-grid", "energy system", "procurement", "Bright Data", "scraper"],
  authors: [{ name: "GridForge" }],
  openGraph: {
    title: "GridForge",
    description: "Compile physical systems from the live web.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {process.env.GRIDFORGE_MODE !== "real" && (
          <div className="dev-banner">
            ◆ Development / Mock Mode — No live data. Set GRIDFORGE_MODE=real with credentials for hackathon demo.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
