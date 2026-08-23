/**
 * GridForge Demo Store — Bright Data Scraper Studio PARSER CODE
 *
 * Paste this file into the separate "Parser code" stage in Scraper Studio.
 * It supports Layout V1's semantic data-* attributes and Layout V2's labelled
 * spec rows. The same production collector can therefore survive either
 * storefront layout without inferring missing engineering values.
 *
 * Output: one flat row per component. Field names intentionally match the
 * GridForge live catalog normalizer.
 */

const layoutVersion = $('meta[name="gridforge:layout"]').attr('content') || 'unknown';
const lastUpdated = $('meta[name="gridforge:last-updated"]').attr('content') || null;

function text(card, selector) {
  const value = card.find(selector).first().text().trim();
  return value || null;
}

function valueByLabel(card, label) {
  const element = card.find('.spec-row').toArray().find((row) => {
    return $(row).find('.spec-label').first().text().trim() === label;
  });
  if (!element) return null;
  const value = $(element).find('.spec-value').first().text().trim();
  return value || null;
}

function spec(card, v1Selector, v2Label) {
  return text(card, v1Selector) || valueByLabel(card, v2Label);
}

return $('[data-product-id]').toArray().map((element) => {
  const card = $(element);

  return {
    product_id: card.attr('data-product-id') || null,
    product_type: card.attr('data-product-type') || null,
    manufacturer: text(card, '.product-manufacturer') || text(card, '.product-brand'),
    model: text(card, '.product-name') || text(card, '.product-title'),

    price: text(card, '[data-field="price"]'),
    availability: text(card, '[data-field="availability"]'),

    // Solar panel fields
    pmax: spec(card, '[data-spec="pmax"]', 'Rated Power'),
    voc: spec(card, '[data-spec="voc"]', 'Open Circuit Voltage'),
    vmp: spec(card, '[data-spec="vmp"]', 'Max Power Voltage'),
    isc: spec(card, '[data-spec="isc"]', 'Short-circuit Current'),
    imp: spec(card, '[data-spec="imp"]', 'Max Power Current'),
    voc_temp_coeff: spec(card, '[data-spec="voc_temp_coeff"]', 'Temp. Coeff. (Voc)'),
    efficiency: spec(card, '[data-spec="efficiency"]', 'Module Efficiency'),
    cell_type: spec(card, '[data-spec="cell_type"]', 'Cell Technology'),

    // Inverter fields
    ac_output_w: spec(card, '[data-spec="ac_output_w"]', 'AC Output'),
    battery_voltage_v: spec(card, '[data-spec="battery_voltage_v"]', 'Battery Voltage'),
    max_pv_v: spec(card, '[data-spec="max_pv_v"]', 'Max PV Voltage'),
    mppt_range: spec(card, '[data-spec="mppt_range"]', 'MPPT Range'),
    max_pv_a: spec(card, '[data-spec="max_pv_a"]', 'Max PV Current'),
    max_pv_w: spec(card, '[data-spec="max_pv_w"]', 'Max PV Power'),

    // Battery fields
    voltage_v: spec(card, '[data-spec="voltage_v"]', 'Nominal Voltage'),
    capacity_ah: spec(card, '[data-spec="capacity_ah"]', 'Capacity'),
    energy_kwh: spec(card, '[data-spec="energy_kwh"]', 'Nominal Energy'),
    dod_pct: spec(card, '[data-spec="dod_pct"]', 'Depth of Discharge'),
    chemistry: spec(card, '[data-spec="chemistry"]', 'Battery Type'),
    cycle_life: spec(card, '[data-spec="cycle_life"]', 'Cycle Life'),

    layout_version: layoutVersion,
    last_updated: lastUpdated,
  };
});
