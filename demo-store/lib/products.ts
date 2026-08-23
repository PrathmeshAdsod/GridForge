import type { DemoStoreState } from './supabase'

export interface DemoProduct {
  id: string
  type: 'solar_panel' | 'inverter' | 'battery'
  manufacturer: string
  model: string
  price: string
  stockKey?: keyof DemoStoreState
  inStock?: boolean
  pmax?: string
  voc?: string
  vmp?: string
  isc?: string
  imp?: string
  vocTempCoeff?: string
  efficiency?: string
  cellType?: string
  acOutputW?: string
  batteryVoltageV?: string
  maxPvV?: string
  mpptRange?: string
  maxPvA?: string
  maxPvW?: string
  voltageV?: string
  capacityAh?: string
  energyKwh?: string
  dodPct?: string
  chemistry?: string
  cycleLife?: string
}

/**
 * Fictional but internally consistent demo inventory used only as the controlled
 * Scraper Studio drift/stockout target. It is never represented as a real shop.
 */
export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'sp-440w-mono',
    type: 'solar_panel',
    manufacturer: 'SunPower Systems',
    model: 'SPX-440M',
    price: '₹17,500',
    stockKey: 'panel_440w_in_stock',
    pmax: '440', voc: '49.8', vmp: '41.4', isc: '11.35', imp: '10.63',
    vocTempCoeff: '-0.28', efficiency: '21.4', cellType: 'Monocrystalline PERC',
  },
  {
    id: 'sp-550w-mono',
    type: 'solar_panel',
    manufacturer: 'BrightCell India',
    model: 'BCX-550HV',
    price: '₹21,800',
    stockKey: 'panel_550w_in_stock',
    pmax: '550', voc: '52.1', vmp: '43.6', isc: '13.42', imp: '12.61',
    vocTempCoeff: '-0.25', efficiency: '22.1', cellType: 'Monocrystalline TOPCon',
  },
  {
    id: 'sp-375w-poly',
    type: 'solar_panel',
    manufacturer: 'SunPower Systems',
    model: 'SPX-375P',
    price: '₹13,200',
    stockKey: 'panel_375w_in_stock',
    pmax: '375', voc: '46.2', vmp: '38.1', isc: '10.21', imp: '9.84',
    vocTempCoeff: '-0.31', efficiency: '18.8', cellType: 'Polycrystalline',
  },
  {
    id: 'inv-4kva-hybrid',
    type: 'inverter',
    manufacturer: 'Luminous Power',
    model: 'NXG-4KVA-48V',
    price: '₹42,000',
    inStock: true,
    acOutputW: '4000', batteryVoltageV: '48', maxPvV: '150', mpptRange: '60-115', maxPvA: '25', maxPvW: '4500',
  },
  {
    id: 'bat-150ah-agm',
    type: 'battery',
    manufacturer: 'Exide Industries',
    model: 'TuffE-150AH-12V',
    price: '₹13,500',
    inStock: true,
    voltageV: '12', capacityAh: '150', energyKwh: '1.8', dodPct: '50', chemistry: 'AGM Lead-Acid', cycleLife: '800',
  },
]

export function productIsInStock(product: DemoProduct, state: DemoStoreState): boolean {
  return product.stockKey ? Boolean(state[product.stockKey]) : product.inStock ?? true
}
