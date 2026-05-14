import { getTodaySnapshot, getSnapshotDaysAgo } from './prices.js';
import { buildPages } from './format.js';

function pctChange(current, previous) {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function computeMovers(current, pastSnapshot, priceKey) {
  if (!pastSnapshot) return [];

  return Object.entries(current)
    .map(([id, card]) => {
      const past = pastSnapshot[id];
      const change = past ? pctChange(card.price, past.price) : null;
      return { ...card, [priceKey]: change };
    })
    .filter((c) => c[priceKey] != null);
}

const RARITIES = ['Epic', 'Showcase', 'Rare', 'Uncommon', 'Common'];

export async function generateReport() {
  console.log('[report] Loading price snapshots...');

  const [current, snap24h, snap7d, snap30d] = await Promise.all([
    getTodaySnapshot(),
    Promise.resolve(getSnapshotDaysAgo(1)),
    Promise.resolve(getSnapshotDaysAgo(7)),
    Promise.resolve(getSnapshotDaysAgo(30)),
  ]);

  const movers24h = computeMovers(current, snap24h, 'change24h');
  const movers7d = computeMovers(current, snap7d, 'change7d');
  const movers30d = computeMovers(current, snap30d, 'change30d');

  const sortDesc = (arr, key) => [...arr].sort((a, b) => b[key] - a[key]);
  const sortAsc = (arr, key) => [...arr].sort((a, b) => a[key] - b[key]);

  const allCards = Object.values(current).filter((c) => c.price != null);

  const topPriced = [...allCards].sort((a, b) => b.price - a.price).slice(0, 5);

  const topByRarity = RARITIES.map((rarity) => ({
    rarity,
    cards: allCards
      .filter((c) => c.rarity === rarity)
      .sort((a, b) => b.price - a.price)
      .slice(0, 3),
  })).filter((r) => r.cards.length > 0);

  console.log('[report] Building embeds...');

  return buildPages({
    movers24hUp: sortDesc(movers24h.filter((c) => c.change24h > 0), 'change24h').slice(0, 5),
    movers24hDown: sortAsc(movers24h.filter((c) => c.change24h < 0), 'change24h').slice(0, 5),
    movers7d: sortDesc(movers7d.filter((c) => c.change7d > 0), 'change7d').slice(0, 5),
    movers30d: sortDesc(movers30d.filter((c) => c.change30d > 0), 'change30d').slice(0, 5),
    topPriced,
    topByRarity,
  });
}
