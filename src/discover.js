/**
 * One-time utility to discover Riftbound rarities and available games.
 * Run once: node --env-file=.env src/discover.js
 * Then update the RARITIES array in src/report.js if needed.
 *
 * Costs: 2 API calls (games list + one card sample)
 */

const BASE_URL = 'https://api.justtcg.com/v1';
const API_KEY = process.env.JUSTTCG_API_KEY;

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data ?? json);
}

const games = await get('/games');
console.log('\nSupported games:');
games.forEach((g) => console.log(` - ${g.slug ?? g.id ?? JSON.stringify(g)}`));

const sample = await get('/cards?game=riftbound-league-of-legends-trading-card-game&limit=20');
const rarities = [...new Set(sample.map((c) => c.rarity).filter(Boolean))];
console.log('\nRiftbound rarities found in sample:');
rarities.forEach((r) => console.log(` - ${r}`));

console.log('\nSample card fields:', sample[0] ? Object.keys(sample[0]) : 'no cards returned');
