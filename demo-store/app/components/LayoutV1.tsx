import type { DemoStoreState } from '@/lib/supabase'
import { DEMO_PRODUCTS, productIsInStock } from '@/lib/products'

interface Props { state: DemoStoreState }

function Row({ label, spec, value, unit = '' }: { label: string; spec: string; value?: string; unit?: string }) {
  if (value === undefined) return null
  return <div className="spec-row"><span>{label}</span><strong data-spec={spec}>{value}{unit}</strong></div>
}

/**
 * Layout V1: semantic data-spec attributes make the initial collector reliable.
 * Layout V2 deliberately removes these attributes while preserving the same
 * products and values, creating a genuine DOM-drift event.
 */
export function LayoutV1({ state }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="gridforge:layout" content="v1" />
        <meta name="gridforge:last-updated" content={new Date(state.updated_at).toISOString()} />
        <title>GridForge Demo Store — Solar Components</title>
        <style>{`
          *{box-sizing:border-box}body{margin:0;background:#f7f7f4;color:#171713;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
          header{border-bottom:1px solid #e7e5df;background:#fff;padding:18px 28px}header b{font-size:15px}.tag{margin-left:10px;font-size:10px;color:#a16207;background:#fff7d6;padding:4px 7px;border-radius:99px}
          main{max-width:920px;margin:auto;padding:48px 24px 72px}.eyebrow{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a16207}.intro h1{font-size:36px;letter-spacing:-.04em;margin:8px 0}.intro p{font-size:13px;color:#6b6961;margin:0 0 28px}
          .products{display:grid;gap:12px}.product-card{background:#fff;border:1px solid #e7e5df;border-radius:14px;padding:20px}.top{display:flex;justify-content:space-between;gap:20px;margin-bottom:15px}.product-type{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b887f}.product-name{font-size:17px;font-weight:720;margin-top:4px}.product-manufacturer{font-size:11px;color:#8b887f;margin-top:2px}.price{text-align:right;font-weight:720;font-size:17px}.availability{font-size:10px;margin-top:4px}.in{color:#087f5b}.out{color:#c92a2a}
          .specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;border-top:1px solid #efeee9;padding-top:8px}.spec-row{display:flex;justify-content:space-between;gap:15px;padding:7px 0;border-bottom:1px solid #f1f0eb;font-size:11px}.spec-row span{color:#77746c}.spec-row strong{font-weight:650}
          footer{text-align:center;color:#9c9991;font-size:10px;padding:24px}
        `}</style>
      </head>
      <body>
        <header><b>GridForge Demo Store</b><span className="tag">LAYOUT V1</span></header>
        <main>
          <section className="intro">
            <div className="eyebrow">Controlled public scrape target</div>
            <h1>Off-grid components</h1>
            <p>Fictional demo inventory for reproducible Scraper Studio reliability testing.</p>
          </section>

          <section className="products">
            {DEMO_PRODUCTS.map(product => {
              const inStock = productIsInStock(product, state)
              return (
                <article key={product.id} className="product-card" data-product-id={product.id} data-product-type={product.type}>
                  <div className="top">
                    <div>
                      <div className="product-type">{product.type.replace('_', ' ')}</div>
                      <div className="product-name">{product.model}</div>
                      <div className="product-manufacturer">{product.manufacturer}</div>
                    </div>
                    <div>
                      <div className="price" data-field="price">{product.price}</div>
                      <div className={`availability ${inStock ? 'in' : 'out'}`} data-field="availability">{inStock ? 'In Stock' : 'Out of Stock'}</div>
                    </div>
                  </div>

                  <div className="specs">
                    {product.type === 'solar_panel' && <>
                      <Row label="Peak power" spec="pmax" value={product.pmax} unit=" W" />
                      <Row label="Open-circuit voltage" spec="voc" value={product.voc} unit=" V" />
                      <Row label="Max-power voltage" spec="vmp" value={product.vmp} unit=" V" />
                      <Row label="Short-circuit current" spec="isc" value={product.isc} unit=" A" />
                      <Row label="Max-power current" spec="imp" value={product.imp} unit=" A" />
                      <Row label="Voc temp coefficient" spec="voc_temp_coeff" value={product.vocTempCoeff} unit=" %/°C" />
                      <Row label="Efficiency" spec="efficiency" value={product.efficiency} unit=" %" />
                      <Row label="Cell type" spec="cell_type" value={product.cellType} />
                    </>}
                    {product.type === 'inverter' && <>
                      <Row label="AC output" spec="ac_output_w" value={product.acOutputW} unit=" W" />
                      <Row label="Battery voltage" spec="battery_voltage_v" value={product.batteryVoltageV} unit=" V" />
                      <Row label="Max PV voltage" spec="max_pv_v" value={product.maxPvV} unit=" V" />
                      <Row label="MPPT range" spec="mppt_range" value={product.mpptRange} unit=" V" />
                      <Row label="Max PV current" spec="max_pv_a" value={product.maxPvA} unit=" A" />
                      <Row label="Max PV power" spec="max_pv_w" value={product.maxPvW} unit=" W" />
                    </>}
                    {product.type === 'battery' && <>
                      <Row label="Nominal voltage" spec="voltage_v" value={product.voltageV} unit=" V" />
                      <Row label="Capacity" spec="capacity_ah" value={product.capacityAh} unit=" Ah" />
                      <Row label="Nominal energy" spec="energy_kwh" value={product.energyKwh} unit=" kWh" />
                      <Row label="Depth of discharge" spec="dod_pct" value={product.dodPct} unit=" %" />
                      <Row label="Chemistry" spec="chemistry" value={product.chemistry} />
                      <Row label="Cycle life" spec="cycle_life" value={product.cycleLife} unit=" cycles" />
                    </>}
                  </div>
                </article>
              )
            })}
          </section>
        </main>
        <footer>GridForge Demo Store · V1 · {state.updated_at}</footer>
      </body>
    </html>
  )
}
