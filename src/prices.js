/**
 * Price tracking using TCGTracking.com open API (no key required).
 * Fetches all Riftbound sets + pricing, stores daily snapshots in data/prices.json.
 * Snapshots are keyed by date string (YYYY-MM-DD) and kept for 31 days.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const BASE = 'https://tcgtracking.com/tcgapi/v1';
const CAT = 89; // Riftbound League of Legends TCG
const DATA_PATH = './data/prices.json';
const KEEP_DAYS = 31;

// Subtypes we care about — skip sealed product variants
const SKIP_NAME = /booster|display case|bundle|sealed|pack|box/i;
const SKIP_SUBTYPE = /booster|bundle|box|sealed/i;

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`TCGTracking API error: ${res.status} ${res.statusText} — ${path}`);
  return res.json();
}

function loadStore() {
  if (!existsSync(DATA_PATH)) return { snapshots: {} };
  try {
    return JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return { snapshots: {} };
  }
}

function saveStore(store) {
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch current prices for all Riftbound cards across all sets.
 * Returns a flat map of { [productId]: { name, set, price } }
 */
export async function fetchCurrentPrices() {
  const { sets } = await get(`/${CAT}/sets`);
  const snapshot = {};

  for (const set of sets) {
    // Skip sets with no pricing or clearly supplemental/promo junk
    if (!set.pricing_url) continue;

    const [productData, pricingData] = await Promise.all([
      get(`/${CAT}/sets/${set.id}`),
      get(`/${CAT}/sets/${set.id}/pricing`),
    ]);

    const productMap = {};
    for (const p of productData.products ?? []) {
      if (SKIP_NAME.test(p.name)) continue;
      productMap[p.id] = { name: p.name, set: set.name, rarity: p.rarity ?? null };
    }

    for (const [productId, priceInfo] of Object.entries(pricingData.prices ?? {})) {
      const meta = productMap[productId];
      if (!meta) continue;

      // Pick the best subtype price: prefer Normal, then first available
      const tcg = priceInfo.tcg ?? {};
      const subtype =
        Object.keys(tcg).find((k) => k.toLowerCase() === 'normal') ??
        Object.keys(tcg).find((k) => !SKIP_SUBTYPE.test(k));

      if (!subtype) continue;
      const market = tcg[subtype]?.market;
      if (market == null) continue;

      snapshot[productId] = { ...meta, price: market };
    }
  }

  return snapshot;
}

/**
 * Take a snapshot of current prices and persist it.
 * Prunes snapshots older than KEEP_DAYS.
 */
export async function snapshotPrices() {
  console.log('[prices] Fetching current prices from TCGTracking...');
  const current = await fetchCurrentPrices();
  const store = loadStore();
  const today = todayKey();

  store.snapshots[today] = current;

  // Prune old snapshots
  const cutoff = daysAgoKey(KEEP_DAYS);
  for (const key of Object.keys(store.snapshots)) {
    if (key < cutoff) delete store.snapshots[key];
  }

  saveStore(store);
  console.log(`[prices] Snapshot saved for ${today} (${Object.keys(current).length} cards)`);
  return current;
}

/**
 * Get the stored snapshot closest to N days ago.
 */
export function getSnapshotDaysAgo(n) {
  const store = loadStore();
  // Walk back up to 3 days to find the nearest available snapshot
  for (let i = 0; i <= 3; i++) {
    const key = daysAgoKey(n + i);
    if (store.snapshots[key]) return store.snapshots[key];
  }
  return null;
}

/**
 * Get today's snapshot (already stored), or fetch+store if missing.
 */
export async function getTodaySnapshot() {
  const store = loadStore();
  const today = todayKey();
  if (store.snapshots[today]) return store.snapshots[today];
  return snapshotPrices();
}
