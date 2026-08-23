// Demo store root layout — minimal, passes through children directly
// The page.tsx returns full <html> elements (V1 and V2 layouts have their own <html>)
// So this layout must NOT wrap in another <html>/<body>

export const metadata = {
  title: 'GridForge Demo Store',
  description: 'Bright Data scraper test target — server-rendered solar components catalog',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pass through directly — page renders full HTML
  return children
}
