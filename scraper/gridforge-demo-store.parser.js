/**
 * GridForge Demo Store — Bright Data Scraper Studio PARSER CODE
 *
 * Paste this file into the separate "Parser code" stage in Scraper Studio.
 * It intentionally targets Layout V1's semantic data-* attributes. Layout V2
 * removes those attributes, which creates a genuine coverage drop for the
 * Source Guardian + Bright Data self-healing demonstration.
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

return $('[data-product-id]').toArray().map((element) => {
  const card = $(element);

  return {
    product_id: card.attr('data-product-id') || null,
    product_type: card.attr('data-product-type') || null,
    manufacturer: text(card, '.product-manufacturer'),
    model: text(card, '.product-name'),

    price: text(card, '[data-field="price"]'),
    availability: text(card, '[data-field="availability"]'),

    // Solar panel fields
    pmax: text(card, '[data-spec="pmax"]'),
    voc: text(card, '[data-spec="voc"]'),
    vmp: text(card, '[data-spec="vmp"]'),
    isc: text(card, '[data-spec="isc"]'),
    imp: text(card, '[data-spec="imp"]'),
    voc_temp_coeff: text(card, '[data-spec="voc_temp_coeff"]'),
    efficiency: text(card, '[data-spec="efficiency"]'),
    cell_type: text(card, '[data-spec="cell_type"]'),

    // Inverter fields
    ac_output_w: text(card, '[data-spec="ac_output_w"]'),
    battery_voltage_v: text(card, '[data-spec="battery_voltage_v"]'),
    max_pv_v: text(card, '[data-spec="max_pv_v"]'),
    mppt_range: text(card, '[data-spec="mppt_range"]'),
    max_pv_a: text(card, '[data-spec="max_pv_a"]'),
    max_pv_w: text(card, '[data-spec="max_pv_w"]'),

    // Battery fields
    voltage_v: text(card, '[data-spec="voltage_v"]'),
    capacity_ah: text(card, '[data-spec="capacity_ah"]'),
    energy_kwh: text(card, '[data-spec="energy_kwh"]'),
    dod_pct: text(card, '[data-spec="dod_pct"]'),
    chemistry: text(card, '[data-spec="chemistry"]'),
    cycle_life: text(card, '[data-spec="cycle_life"]'),

    layout_version: layoutVersion,
    last_updated: lastUpdated,
  };
});
