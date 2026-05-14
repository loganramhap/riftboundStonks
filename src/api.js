const BASE_URL = 'https://api.justtcg.com/v1';
const API_KEY = process.env.JUSTTCG_API_KEY;

async function fetchCards(params) {
  const url = `${BASE_URL}/cards?${params.toString()}`;
  const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(`JustTCG API error: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data ?? []);
}

/**
 * Flatten a raw API card into a simple object using the first variant's pricing.
 * The API returns price data nested inside variants[].
 */
export function flattenCard(card) {
  const v = card.variants?.[0] ?? {};
  return {
    name: card.name,
    set: card.set_name,
    rarity: card.rarity,
    price: v.price ?? null,
    change24h: v.priceChange24hr ?? null,
    change7d: v.priceChange7d ?? null,
    change30d: v.priceChange30d ?? null,
    condition: v.condition,
    printing: v.printing,
  };
}

export async function fetchRiftbound(orderBy, order = 'desc') {
  const params = new URLSearchParams({
    game: 'riftbound-league-of-legends-trading-card-game',
    orderBy,
    order,
    limit: '20',
  });
  const cards = await fetchCards(params);
  return cards
    .filter((c) => !/ \((Metal|Signature|Ultimate)\)$/i.test(c.name))
    .filter((c) => !/booster|display case|bundle|sealed|pack|box/i.test(c.name))
    .map(flattenCard);
}
