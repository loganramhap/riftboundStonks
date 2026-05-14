// Run once to inspect raw API response fields:
// node --env-file=.env src/debug.js

const BASE_URL = 'https://api.justtcg.com/v1';
const GAME = 'riftbound-league-of-legends-trading-card-game';

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { 'x-api-key': process.env.JUSTTCG_API_KEY } });
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data ?? json);
}

// Check what rarities exist
const all = await get(`/cards?game=${GAME}&orderBy=price&order=desc&limit=20`);
const rarities = [...new Set(all.map(c => c.rarity))];
console.log('Rarities in sample:', rarities);
console.log('Sample names:', all.map(c => `[${c.rarity}] ${c.name}`));

// Check if rarity filter works
const rare = await get(`/cards?game=${GAME}&rarity=Rare&orderBy=price&order=desc&limit=5`);
console.log('\nWith rarity=Rare filter:');
console.log(rare.map(c => `[${c.rarity}] ${c.name}`));
