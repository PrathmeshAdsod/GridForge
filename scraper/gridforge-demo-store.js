/**
 * GridForge Demo Store — Bright Data Scraper Studio Script
 *
 * Targets: https://gridforge-demo-store.vercel.app (or localhost:3001)
 *
 * Layout V1: Extracts data via data-spec="voc" attributes → HIGH coverage
 * Layout V2: data-spec attributes REMOVED → coverage drops → triggers Guardian
 *
 * This is the collector that demonstrates Bright Data self-healing:
 * when V2 layout is activated via the admin API, field coverage drops
 * below threshold, Source Guardian flags DEGRADED, and self-heal is triggered.
 */

// Input: { url: "https://gridforge-demo-store.vercel.app" } (optional)
const targetUrl = input?.url || 'https://gridforge-demo-store.vercel.app';

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

// Detect layout version from meta tag
const layoutVersion = await page.evaluate(() => {
  return document.querySelector('meta[name="gridforge:layout"]')?.getAttribute('content') || 'unknown';
});

const lastUpdated = await page.evaluate(() => {
  return document.querySelector('meta[name="gridforge:last-updated"]')?.getAttribute('content') || null;
});

// Extract all products
const products = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[data-product-id]'));

  return cards.map(card => {
    const getText = (selector) => card.querySelector(selector)?.textContent?.trim() || null;
    const getAttr = (selector, attr) => card.querySelector(selector)?.getAttribute(attr) || null;

    return {
      productId: card.getAttribute('data-product-id'),
      productType: card.getAttribute('data-product-type'),

      // Availability & price — present in both V1 and V2
      price: getText('[data-field="price"]'),
      availability: getText('[data-field="availability"]'),

      // V1 data-spec attributes (absent in V2 — this is what triggers DEGRADED)
      pmax: getText('[data-spec="pmax"]'),
      voc: getText('[data-spec="voc"]'),
      vmp: getText('[data-spec="vmp"]'),
      isc: getText('[data-spec="isc"]'),
      imp: getText('[data-spec="imp"]'),
      vocTempCoeff: getText('[data-spec="voc_temp_coeff"]'),
      efficiency: getText('[data-spec="efficiency"]'),
      cellType: getText('[data-spec="cell_type"]'),

      // Inverter specs
      acOutputW: getText('[data-spec="ac_output_w"]'),
      batteryVoltageV: getText('[data-spec="battery_voltage_v"]'),
      maxPvV: getText('[data-spec="max_pv_v"]'),
      mpptRange: getText('[data-spec="mppt_range"]'),
      maxPvA: getText('[data-spec="max_pv_a"]'),

      // Battery specs
      voltageV: getText('[data-spec="voltage_v"]'),
      capacityAh: getText('[data-spec="capacity_ah"]'),
      energyKwh: getText('[data-spec="energy_kwh"]'),
      dodPct: getText('[data-spec="dod_pct"]'),
      chemistry: getText('[data-spec="chemistry"]'),
      cycleLife: getText('[data-spec="cycle_life"]'),
    };
  });
});

await browser.close();

// Compute field coverage for critical electrical fields
const panelProducts = products.filter(p => p.productType === 'solar_panel');
const criticalFields = ['voc', 'vmp', 'isc', 'pmax'];

const fieldCoverage = {};
for (const field of criticalFields) {
  const filled = panelProducts.filter(p => p[field] !== null).length;
  fieldCoverage[field] = panelProducts.length > 0 ? filled / panelProducts.length : 0;
}

// Return structured result
return {
  sourceUrl: targetUrl,
  layoutVersion,
  lastUpdated,
  scrapedAt: new Date().toISOString(),
  productCount: products.length,
  fieldCoverage,
  products,
};
