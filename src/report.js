import { fetchRiftbound } from './api.js';
import { buildEmbeds } from './format.js';

export async function generateReport() {
  console.log('[report] Fetching Riftbound market data...');

  const [cards24hDesc, cards24hAsc, cards7d, cards30d, topPriced] = await Promise.all([
    fetchRiftbound('24h', 'desc'),
    fetchRiftbound('24h', 'asc'),
    fetchRiftbound('7d', 'desc'),
    fetchRiftbound('30d', 'desc'),
    fetchRiftbound('price', 'desc'),
  ]);

  console.log('[report] Building message...');

  return buildEmbeds({
    movers24hUp: cards24hDesc.filter((c) => c.change24h > 0).slice(0, 5),
    movers24hDown: cards24hAsc.filter((c) => c.change24h < 0).slice(0, 5),
    movers7d: cards7d.filter((c) => c.change7d > 0).slice(0, 5),
    movers30d: cards30d.filter((c) => c.change30d > 0).slice(0, 5),
    topPriced: topPriced.slice(0, 5),
  });
}
