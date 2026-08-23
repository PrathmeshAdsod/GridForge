/**
 * Layout V2 — Redesigned HTML WITHOUT data-spec attributes.
 * This simulates a store "redesign" that breaks the Bright Data collector.
 * The same products exist, same prices, same availability —
 * but the data-spec attributes are GONE and DOM structure is different.
 *
 * This is what triggers the "DOM drift" / DEGRADED state in Source Guardian.
 * Bright Data self-healing must fix the collector to read this new layout.
 */

import type { DemoStoreState } from '@/lib/supabase'

interface Props {
  state: DemoStoreState
}

// Same products — different DOM structure (no data-spec attributes)
const PRODUCTS = [
  {
    id: 'sp-440w-mono',
    type: 'solar_panel',
    manufacturer: 'SunPower Systems',
    model: 'SPX-440M',
    specs: [
      { label: 'Rated Power', value: '440 W' },
      { label: 'Open Circuit Voltage', value: '49.8 V' },
      { label: 'Max Power Voltage', value: '41.4 V' },
      { label: 'Short-circuit Current', value: '11.35 A' },
      { label: 'Max Power Current', value: '10.63 A' },
      { label: 'Temp. Coeff. (Voc)', value: '-0.28 %/°C' },
      { label: 'Module Efficiency', value: '21.4 %' },
      { label: 'Cell Technology', value: 'Monocrystalline PERC' },
    ],
    price: '₹17,500',
    stockKey: 'panel_440w_in_stock' as keyof DemoStoreState,
  },
  {
    id: 'sp-550w-mono',
    type: 'solar_panel',
    manufacturer: 'BrightCell India',
    model: 'BCX-550HV',
    specs: [
      { label: 'Rated Power', value: '550 W' },
      { label: 'Open Circuit Voltage', value: '52.1 V' },
      { label: 'Max Power Voltage', value: '43.6 V' },
      { label: 'Short-circuit Current', value: '13.42 A' },
      { label: 'Max Power Current', value: '12.61 A' },
      { label: 'Temp. Coeff. (Voc)', value: '-0.25 %/°C' },
      { label: 'Module Efficiency', value: '22.1 %' },
      { label: 'Cell Technology', value: 'Monocrystalline TOPCon' },
    ],
    price: '₹21,800',
    stockKey: 'panel_550w_in_stock' as keyof DemoStoreState,
  },
  {
    id: 'inv-4kva-hybrid',
    type: 'inverter',
    manufacturer: 'Luminous Power',
    model: 'NXG-4KVA-48V',
    specs: [
      { label: 'AC Output', value: '4000 W' },
      { label: 'Battery Voltage', value: '48 V' },
      { label: 'Max PV Voltage', value: '150 V' },
      { label: 'MPPT Range', value: '60–115 V' },
      { label: 'Max PV Current', value: '25 A' },
    ],
    price: '₹42,000',
    inStock: true,
    stockKey: null,
  },
  {
    id: 'bat-150ah-agm',
    type: 'battery',
    manufacturer: 'Exide Industries',
    model: 'TuffE-150AH-12V',
    specs: [
      { label: 'Nominal Voltage', value: '12 V' },
      { label: 'Capacity', value: '150 Ah' },
      { label: 'Usable Energy', value: '1.8 kWh' },
      { label: 'Depth of Discharge', value: '50%' },
      { label: 'Battery Type', value: 'AGM Lead-Acid' },
      { label: 'Cycle Life', value: '800 cycles' },
    ],
    price: '₹13,500',
    inStock: true,
    stockKey: null,
  },
]

export function LayoutV2({ state }: Props) {
  const lastUpdated = new Date(state.updated_at).toISOString()

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SolarHub — Premium Solar Equipment</title>
        {/* V2: different meta, different site name — simulates a real redesign */}
        <meta name="gridforge:layout" content="v2" />
        <meta name="gridforge:last-updated" content={lastUpdated} />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
          .topbar { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 12px 32px; display: flex; align-items: center; justify-content: space-between; }
          .topbar .brand { font-size: 22px; font-weight: 800; color: #0f172a; }
          .topbar .badge { background: #0f172a; color: #f59e0b; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
          .wrapper { max-width: 1100px; margin: 0 auto; padding: 40px 32px; }
          .hero { margin-bottom: 40px; }
          .hero h2 { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #f59e0b, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .hero p { color: #94a3b8; margin-top: 8px; }
          .layout-indicator { display: inline-flex; align-items: center; gap: 6px; background: #dc2626; color: white; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: 1px; margin-top: 12px; }
          .product-list { display: flex; flex-direction: column; gap: 20px; }
          .product-item { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; }
          .product-top { padding: 24px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #334155; }
          .product-category { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #f59e0b; margin-bottom: 8px; }
          .product-title { font-size: 20px; font-weight: 700; color: #f1f5f9; }
          .product-brand { font-size: 13px; color: #64748b; margin-top: 4px; }
          .price-tag { text-align: right; }
          .price-tag .amount { font-size: 24px; font-weight: 800; color: #f59e0b; }
          .stock-badge { margin-top: 6px; display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
          .stock-badge.available { background: rgba(22,163,74,0.2); color: #4ade80; border: 1px solid rgba(22,163,74,0.3); }
          .stock-badge.unavailable { background: rgba(220,38,38,0.2); color: #f87171; border: 1px solid rgba(220,38,38,0.3); }
          .spec-grid { padding: 20px 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0; }
          .spec-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; }
          .spec-label { color: #64748b; font-size: 12px; }
          .spec-value { color: #e2e8f0; font-size: 12px; font-weight: 600; }
          /* NOTE: V2 intentionally has NO data-spec attributes — this breaks scrapers */
          footer { text-align: center; padding: 32px; color: #475569; font-size: 11px; margin-top: 48px; border-top: 1px solid #1e293b; }
        `}</style>
      </head>
      <body>
        <div className="topbar">
          <div className="brand">⚡ SolarHub</div>
          <span className="badge">LAYOUT V2 — REDESIGNED</span>
        </div>

        <div className="wrapper">
          <div className="hero">
            <h2>Premium Solar Equipment</h2>
            <p>Engineered for performance. Built for India.</p>
            <div className="layout-indicator">
              ⚠ V2 LAYOUT — DOM RESTRUCTURED
            </div>
          </div>

          <div className="product-list">
            {PRODUCTS.map(product => {
              const isInStock = product.stockKey
                ? Boolean(state[product.stockKey])
                : product.inStock ?? true

              return (
                /* V2: data-product-type still present (for type detection) but
                   data-spec-table is GONE and spec values have NO data-spec attributes.
                   This is what breaks the collector — critical fields become unextractable. */
                <div
                  key={product.id}
                  className="product-item"
                  data-product-id={product.id}
                  data-product-type={product.type}
                >
                  <div className="product-top">
                    <div>
                      <div className="product-category">{product.type.replace('_', ' ')}</div>
                      <div className="product-title">{product.model}</div>
                      <div className="product-brand">{product.manufacturer}</div>
                    </div>
                    <div className="price-tag">
                      {/* V2: price still has data-field (schema partially intact) */}
                      <div className="amount" data-field="price">{product.price}</div>
                      <span
                        className={`stock-badge ${isInStock ? 'available' : 'unavailable'}`}
                        data-field="availability"
                      >
                        {isInStock ? 'Available' : 'Out of Stock'}
                      </span>
                    </div>
                  </div>

                  {/* V2 specs: rendered as grid items with NO data-spec attributes */}
                  <div className="spec-grid">
                    {product.specs.map((spec, i) => (
                      <div key={i} className="spec-row">
                        {/* NO data-spec attributes here — this breaks the collector */}
                        <span className="spec-label">{spec.label}</span>
                        <span className="spec-value">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <footer>
          <p>SolarHub Demo Store — GridForge Scraper Test Target | Layout V2</p>
          <p>Last state change: {state.updated_at}</p>
        </footer>
      </body>
    </html>
  )
}
