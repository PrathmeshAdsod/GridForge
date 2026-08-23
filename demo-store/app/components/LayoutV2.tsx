import type { DemoStoreState } from '@/lib/supabase'
import { DEMO_PRODUCTS, productIsInStock, type DemoProduct } from '@/lib/products'

interface Props { state: DemoStoreState }

function v2Specs(product: DemoProduct): Array<[string, string]> {
  if (product.type === 'solar_panel') return [
    ['Rated Power', `${product.pmax} W`],
    ['Open Circuit Voltage', `${product.voc} V`],
    ['Max Power Voltage', `${product.vmp} V`],
    ['Short-circuit Current', `${product.isc} A`],
    ['Max Power Current', `${product.imp} A`],
    ['Temp. Coeff. (Voc)', `${product.vocTempCoeff} %/°C`],
    ['Module Efficiency', `${product.efficiency} %`],
    ['Cell Technology', product.cellType ?? ''],
  ]

  if (product.type === 'inverter') return [
    ['AC Output', `${product.acOutputW} W`],
    ['Battery Voltage', `${product.batteryVoltageV} V`],
    ['Max PV Voltage', `${product.maxPvV} V`],
    ['MPPT Range', `${product.mpptRange} V`],
    ['Max PV Current', `${product.maxPvA} A`],
    ['Max PV Power', `${product.maxPvW} W`],
  ]

  return [
    ['Nominal Voltage', `${product.voltageV} V`],
    ['Capacity', `${product.capacityAh} Ah`],
    ['Nominal Energy', `${product.energyKwh} kWh`],
    ['Depth of Discharge', `${product.dodPct}%`],
    ['Battery Type', product.chemistry ?? ''],
    ['Cycle Life', `${product.cycleLife} cycles`],
  ]
}

/**
 * Layout V2: same inventory and values, completely different presentation.
 * Crucially there are NO data-spec attributes. The V1 collector therefore loses
 * critical electrical fields while price/availability remain extractable.
 */
export function LayoutV2({ state }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="gridforge:layout" content="v2" />
        <meta name="gridforge:last-updated" content={new Date(state.updated_at).toISOString()} />
        <title>SolarHub — Premium Solar Equipment</title>
        <style>{`
          *{box-sizing:border-box}body{margin:0;background:#0d1422;color:#e7edf7;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.bar{background:#f5b522;color:#131722;padding:18px 28px;display:flex;justify-content:space-between;font-weight:800}.bar small{font-size:9px;letter-spacing:.1em;background:#111827;color:#fbbf24;padding:5px 8px;border-radius:99px}.wrap{max-width:920px;margin:auto;padding:50px 24px 72px}.hero{margin-bottom:30px}.hero span{font-size:10px;color:#fbbf24;text-transform:uppercase;letter-spacing:.1em;font-weight:700}.hero h1{font-size:38px;letter-spacing:-.045em;margin:8px 0}.hero p{font-size:13px;color:#8994a8}.list{display:grid;gap:15px}.product-item{border:1px solid #263247;background:#151f31;border-radius:18px;overflow:hidden}.product-top{padding:21px 22px;display:flex;justify-content:space-between;border-bottom:1px solid #263247}.product-category{font-size:9px;color:#fbbf24;text-transform:uppercase;letter-spacing:.1em}.product-title{font-size:18px;font-weight:750;margin-top:5px}.product-brand{font-size:11px;color:#7f8ba0;margin-top:3px}.amount{font-size:19px;font-weight:800;text-align:right;color:#fbbf24}.stock{font-size:10px;text-align:right;margin-top:5px}.ok{color:#4ade80}.no{color:#fb7185}.spec-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;padding:12px 22px 18px}.spec-row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid #202b3d;font-size:11px}.spec-label{color:#778399}.spec-value{font-weight:650}footer{text-align:center;padding:26px;color:#667085;font-size:10px}
        `}</style>
      </head>
      <body>
        <div className="bar"><span>⚡ SolarHub</span><small>LAYOUT V2 · REDESIGNED</small></div>
        <main className="wrap">
          <section className="hero">
            <span>New storefront architecture</span>
            <h1>Premium solar equipment</h1>
            <p>The business data is unchanged. Only the HTML structure and semantic selectors have moved.</p>
          </section>

          <section className="list">
            {DEMO_PRODUCTS.map(product => {
              const inStock = productIsInStock(product, state)
              return (
                <article key={product.id} className="product-item" data-product-id={product.id} data-product-type={product.type}>
                  <div className="product-top">
                    <div>
                      <div className="product-category">{product.type.replace('_', ' ')}</div>
                      <div className="product-title">{product.model}</div>
                      <div className="product-brand">{product.manufacturer}</div>
                    </div>
                    <div>
                      <div className="amount" data-field="price">{product.price}</div>
                      <div className={`stock ${inStock ? 'ok' : 'no'}`} data-field="availability">{inStock ? 'Available' : 'Out of Stock'}</div>
                    </div>
                  </div>

                  <div className="spec-grid">
                    {v2Specs(product).map(([label, value]) => (
                      <div className="spec-row" key={label}>
                        <span className="spec-label">{label}</span>
                        <span className="spec-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </section>
        </main>
        <footer>SolarHub Demo Store · GridForge controlled drift target · {state.updated_at}</footer>
      </body>
    </html>
  )
}
