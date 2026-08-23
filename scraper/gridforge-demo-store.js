/**
 * GridForge Demo Store — Bright Data Scraper Studio INTERACTION CODE
 *
 * IMPORTANT: Scraper Studio interaction code is not a Node.js/Puppeteer runtime.
 * Paste this file into the "Interaction code" stage in Scraper Studio.
 * The extraction logic lives in gridforge-demo-store.parser.js and must be pasted
 * into the separate "Parser code" stage.
 *
 * Collector: c_mt4wvcs1e2p0phlh1
 */

const targetUrl = input?.url || 'https://gridforge-demo-store.vercel.app';

navigate(targetUrl);

const products = parse();

if (!Array.isArray(products)) {
  throw new Error('GridForge parser must return an array of product records');
}

for (const product of products) {
  collect(product);
}
