import { EmbedBuilder } from 'discord.js';

const GOLD = 0xC89B3C; // Riftbound-ish gold colour

function price(val) {
  if (val == null) return 'N/A';
  return `$${Number(val).toFixed(2)}`;
}

function change(val) {
  if (val == null) return '';
  const sign = val >= 0 ? '+' : '';
  return ` (${sign}${Number(val).toFixed(1)}%)`;
}

function arrow(val) {
  if (val == null || val === 0) return '➖';
  return val > 0 ? '📈' : '📉';
}

function moverRows(cards, changeKey) {
  if (!cards.length) return '*No data*';
  return cards
    .map((c, i) => {
      const pct = c[changeKey];
      return `\`${i + 1}.\` **${c.name}** — ${price(c.price)}${change(pct)} ${arrow(pct)}\n*${c.set}*`;
    })
    .join('\n');
}

function priceRows(cards) {
  if (!cards.length) return '*No data*';
  return cards
    .map((c, i) => `\`${i + 1}.\` **${c.name}** — ${price(c.price)}\n*${c.set}*`)
    .join('\n');
}

const RARITY_EMOJI = {
  Epic: '👑',
  Showcase: '✨',
  Rare: '💎',
  Uncommon: '🔷',
  Common: '⬜',
};

export function buildEmbeds({ movers24hUp, movers24hDown, movers7d, movers30d, topPriced, topByRarity }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const embeds = [];

  // --- Movers embed ---
  embeds.push(
    new EmbedBuilder()
      .setTitle(`📊 Riftbound Market Report — ${today}`)
      .setColor(GOLD)
      .addFields(
        {
          name: '🔥 1-Day Gainers',
          value: moverRows(movers24hUp, 'change24h'),
          inline: true,
        },
        {
          name: '🧊 1-Day Losers',
          value: moverRows(movers24hDown, 'change24h'),
          inline: true,
        },
        { name: '\u200b', value: '\u200b', inline: false }, // spacer
        {
          name: '📅 7-Day Movers',
          value: moverRows(movers7d, 'change7d'),
          inline: true,
        },
        {
          name: '🗓️ 30-Day Movers',
          value: moverRows(movers30d, 'change30d'),
          inline: true,
        },
      )
      .setFooter({ text: 'Prices sourced from TCGTracking · Updates every 24 hours' })
      .setTimestamp()
  );

  // --- Top priced embed ---
  if (topPriced?.length) {
    embeds.push(
      new EmbedBuilder()
        .setTitle('💎 Top 5 Most Expensive Cards')
        .setColor(GOLD)
        .setDescription(priceRows(topPriced))
        .setFooter({ text: 'Prices sourced from TCGTracking · Updates every 24 hours' })
    );
  }

  // --- Top by rarity embed ---
  if (topByRarity?.length) {
    const rarityEmbed = new EmbedBuilder()
      .setTitle('🏆 Top Cards by Rarity')
      .setColor(GOLD)
      .setFooter({ text: 'Prices sourced from TCGTracking · Updates every 24 hours' });

    for (const { rarity, cards } of topByRarity) {
      const emoji = RARITY_EMOJI[rarity] ?? '🃏';
      rarityEmbed.addFields({
        name: `${emoji} ${rarity}`,
        value: priceRows(cards),
        inline: true,
      });
    }

    embeds.push(rarityEmbed);
  }

  return embeds;
}
