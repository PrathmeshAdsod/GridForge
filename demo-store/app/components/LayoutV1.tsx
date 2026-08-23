/**
 * Layout V1 — Clean structured HTML with data-spec attributes
 * This is what Bright Data scrapes SUCCESSFULLY.
 * Attributes like data-spec="voc" are present — collector can extract specs.
 */

import type { DemoStoreState } from '@/lib/supabase'

interface Props {
  state: DemoStoreState
}

const PRODUCTS = [
  {
    id: 'sp-440w-mono',
    type: 'solar_panel',
    manufacturer: 'SunPower Systems',
    model: 'SPX-440M',
    pmax: '440',
    voc: '49.8',
    vmp: '41.4',
    isc: '11.35',
    imp: '10.63',
    vocTempCoeff: '-0.28',
    efficiency: '21.4',
    cellType: 'Monocrystalline PERC',
    priceV1: '₹17,500',
    stockKey: 'panel_440w_in_stock' as keyof DemoStoreState,
  },
  {
    id: 'sp-550w-mono',
    type: 'solar_panel',
    manufacturer: 'BrightCell India',
    model: 'BCX-550HV',
    pmax: '550',
    voc: '52.1',
    vmp: '43.6',
    isc: '13.42',
    imp: '12.61',
    vocTempCoeff: '-0.25',
    efficiency: '22.1',
    cellType: 'Monocrystalline TOPCon',
    priceV1: '₹21,800',
    stockKey: 'panel_550w_in_stock' as keyof DemoStoreState,
  },
  {
    id: 'sp-375w-poly',
    type: 'solar_panel',
    manufacturer: 'SunPower Systems',
    model: 'SPX-375P',
    pmax: '375',
    voc: '46.2',
    vmp: '38.1',
    isc: '10.21',
    imp: '9.84',
    vocTempCoeff: '-0.31',
    efficiency: '18.8',
    cellType: 'Polycrystalline',
    priceV1: '₹13,200',
    stockKey: 'panel_375w_in_stock' as keyof DemoStoreState,
  },
  {
    id: 'inv-4kva-hybrid',
    type: 'inverter',
    manufacturer: 'Luminous Power',
    model: 'NXG-4KVA-48V',
    acOutputW: '4000',
    batteryVoltageV: '48',
    maxPvV: '150',
    mpptRange: '60-115',
    maxPvA: '25',
    maxPvW: '4500',
    price: '₹42,000',
    inStock: true,
    cellType: null,
  },
  {
    id: 'bat-150ah-agm',
    type: 'battery',
    manufacturer: 'Exide Industries',
    model: 'TuffE-150AH-12V',
    voltageV: '12',
    capacityAh: '150',
    energyKwh: '1.8',
    dodPct: '50',
    chemistry: 'AGM Lead-Acid',
    cycleLife: '800',
    price: '₹13,500',
    inStock: true,
    cellType: null,
  },
]

export function LayoutV1({ state }: Props) {
  const lastUpdated = new Date(state.updated_at).toISOString()

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GridForge Demo Store — Solar Components</title>
        {/* Scraper hint: layout version in meta */}
        <meta name="gridforge:layout" content="v1" />
        <meta name="gridforge:last-updated" content={lastUpdated} />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; background: #f8f9fa; color: #1a1a2e; }
          .site-header { background: #1a1a2e; color: white; padding: 16px 32px; display: flex; align-items: center; gap: 12px; }
          .site-header h1 { font-size: 20px; font-weight: 600; }
          .site-header .badge { background: #f59e0b; color: #1a1a2e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
          .container { max-width: 1100px; margin: 0 auto; padding: 32px; }
          .page-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
          .page-desc { color: #6b7280; margin-bottom: 32px; font-size: 14px; }
          .layout-badge { display: inline-flex; align-items: center; gap: 6px; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-bottom: 24px; }
          .products-grid { display: grid; gap: 24px; }
          .product-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
          .product-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
          .product-type { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
          .product-name { font-size: 18px; font-weight: 700; margin-top: 4px; }
          .product-manufacturer { font-size: 13px; color: #6b7280; }
          .price-block { text-align: right; }
          .price { font-size: 22px; font-weight: 700; color: #1a1a2e; }
          .availability { margin-top: 4px; font-size: 12px; font-weight: 600; }
          .availability.in_stock { color: #16a34a; }
          .availability.out_of_stock { color: #dc2626; }
          .spec-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .spec-table tr:not(:last-child) td { border-bottom: 1px solid #f3f4f6; }
          .spec-table td { padding: 8px 4px; }
          .spec-table td:first-child { color: #6b7280; font-weight: 500; width: 50%; }
          .spec-table td:last-child { font-weight: 600; color: #111827; }
          .spec-section { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
          .footer { text-align: center; padding: 32px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 48px; }
        `}</style>
      </head>
      <body>
        <header className="site-header">
          <h1>GridForge Demo Store</h1>
          <span className="badge">LAYOUT V1</span>
        </header>

        <div className="container">
          <h2 className="page-title">Solar Components Catalog</h2>
          <p className="page-desc">Off-grid solar panels, inverters, and batteries — direct from manufacturer</p>
          <div className="layout-badge">
            <span>●</span> Layout Version 1 — Standard structured data
          </div>

          {/* Products grid */}
          <div className="products-grid">
            {PRODUCTS.map(product => {
              const isInStock = product.stockKey
                ? Boolean(state[product.stockKey])
                : product.inStock ?? true

              return (
                <div
                  key={product.id}
                  className="product-card"
                  data-product-id={product.id}
                  data-product-type={product.type}
                >
                  <div className="product-header">
                    <div>
                      <div className="product-type">{product.type.replace('_', ' ')}</div>
                      <div className="product-name">{product.model}</div>
                      <div className="product-manufacturer">{product.manufacturer}</div>
                    </div>
                    <div className="price-block">
                      <div className="price" data-field="price">{product.priceV1 ?? product.price}</div>
                      <div
                        className={`availability ${isInStock ? 'in_stock' : 'out_of_stock'}`}
                        data-field="availability"
                      >
                        {isInStock ? '✓ In Stock' : '✗ Out of Stock'}
                      </div>
                    </div>
                  </div>

                  {/* Spec table — V1 uses data-spec attributes that the collector reads */}
                  {product.type === 'solar_panel' && (
                    <>
                      <div className="spec-section">Electrical Specifications</div>
                      <div data-spec-table>
                        <table className="spec-table">
                          <tbody>
                            <tr>
                              <td>Max Power (Pmax)</td>
                              <td data-spec="pmax">{product.pmax} W</td>
                            </tr>
                            <tr>
                              <td>Open Circuit Voltage (Voc)</td>
                              <td data-spec="voc">{product.voc} V</td>
                            </tr>
                            <tr>
                              <td>Max Power Voltage (Vmp)</td>
                              <td data-spec="vmp">{product.vmp} V</td>
                            </tr>
                            <tr>
                              <td>Short Circuit Current (Isc)</td>
                              <td data-spec="isc">{product.isc} A</td>
                            </tr>
                            <tr>
                              <td>Max Power Current (Imp)</td>
                              <td data-spec="imp">{product.imp} A</td>
                            </tr>
                            <tr>
                              <td>Voc Temp Coefficient</td>
                              <td data-spec="voc_temp_coeff">{product.vocTempCoeff}%/°C</td>
                            </tr>
                            <tr>
                              <td>Efficiency</td>
                              <td data-spec="efficiency">{product.efficiency}%</td>
                            </tr>
                            <tr>
                              <td>Cell Type</td>
                              <td data-spec="cell_type">{product.cellType}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {product.type === 'inverter' && (
                    <>
                      <div className="spec-section">Inverter Specifications</div>
                      <div data-spec-table>
                        <table className="spec-table">
                          <tbody>
                            <tr>
                              <td>AC Output Power</td>
                              <td data-spec="ac_output_w">{product.acOutputW} W</td>
                            </tr>
                            <tr>
                              <td>Battery Voltage</td>
                              <td data-spec="battery_voltage_v">{product.batteryVoltageV} V</td>
                            </tr>
                            <tr>
                              <td>Max PV Input Voltage</td>
                              <td data-spec="max_pv_v">{product.maxPvV} V</td>
                            </tr>
                            <tr>
                              <td>MPPT Range</td>
                              <td data-spec="mppt_range">{product.mpptRange} V</td>
                            </tr>
                            <tr>
                              <td>Max PV Input Current</td>
                              <td data-spec="max_pv_a">{product.maxPvA} A</td>
                            </tr>
                            <tr>
                              <td>Max PV Power</td>
                              <td data-spec="max_pv_w">{product.maxPvW} W</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {product.type === 'battery' && (
                    <>
                      <div className="spec-section">Battery Specifications</div>
                      <div data-spec-table>
                        <table className="spec-table">
                          <tbody>
                            <tr>
                              <td>Nominal Voltage</td>
                              <td data-spec="voltage_v">{product.voltageV} V</td>
                            </tr>
                            <tr>
                              <td>Capacity</td>
                              <td data-spec="capacity_ah">{product.capacityAh} Ah</td>
                            </tr>
                            <tr>
                              <td>Energy (Usable)</td>
                              <td data-spec="energy_kwh">{product.energyKwh} kWh</td>
                            </tr>
                            <tr>
                              <td>Depth of Discharge</td>
                              <td data-spec="dod_pct">{product.dodPct}%</td>
                            </tr>
                            <tr>
                              <td>Chemistry</td>
                              <td data-spec="chemistry">{product.chemistry}</td>
                            </tr>
                            <tr>
                              <td>Cycle Life</td>
                              <td data-spec="cycle_life">{product.cycleLife} cycles</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <footer className="footer">
          <p>GridForge Demo Store — Scraper Studio Test Target</p>
          <p>Layout: V1 | Last updated: {state.updated_at}</p>
        </footer>
      </body>
    </html>
  )
}
