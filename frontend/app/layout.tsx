import type { Metadata } from "next";
import "./globals.css";
import { AuthButton } from "@/components/AuthButton";

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
  const googleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {process.env.GRIDFORGE_MODE !== "real" && (
          <div className="dev-banner">
            ◆ Development / Mock Mode — No live data. Set GRIDFORGE_MODE=real with credentials for hackathon demo.
          </div>
        )}
        {children}
        {googleAuthEnabled && <AuthButton />}
      </body>
    </html>
  );
}
