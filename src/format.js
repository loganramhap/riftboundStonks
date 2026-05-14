import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const GOLD = 0xC89B3C;

function price(val) {
  if (val == null) return 'N/A';
  return `${Number(val).toFixed(2)}`;
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

const FOOTER = 'Prices sourced from TCGTracking · Updates every 24 hours';

export function buildPages({ movers24hUp, movers24hDown, movers7d, movers30d, topPriced, topByRarity }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const pages = [];

  // Page 1 — Movers
  pages.push(
    new EmbedBuilder()
      .setTitle(`📊 Riftbound Market Report — ${today}`)
      .setColor(GOLD)
      .addFields(
        { name: '🔥 1-Day Gainers', value: moverRows(movers24hUp, 'change24h'), inline: true },
        { name: '🧊 1-Day Losers', value: moverRows(movers24hDown, 'change24h'), inline: true },
        { name: '\u200b', value: '\u200b', inline: false },
        { name: '📅 7-Day Movers', value: moverRows(movers7d, 'change7d'), inline: true },
        { name: '🗓️ 30-Day Movers', value: moverRows(movers30d, 'change30d'), inline: true },
      )
      .setTimestamp()
  );

  // Page 2 — Top priced
  if (topPriced?.length) {
    pages.push(
      new EmbedBuilder()
        .setTitle('💎 Top 5 Most Expensive Cards')
        .setColor(GOLD)
        .setDescription(priceRows(topPriced))
    );
  }

  // Page 3 — Top by rarity
  if (topByRarity?.length) {
    const rarityEmbed = new EmbedBuilder()
      .setTitle('🏆 Top Cards by Rarity')
      .setColor(GOLD);

    for (const { rarity, cards } of topByRarity) {
      rarityEmbed.addFields({
        name: `${RARITY_EMOJI[rarity] ?? '🃏'} ${rarity}`,
        value: priceRows(cards),
        inline: true,
      });
    }

    pages.push(rarityEmbed);
  }

  // Stamp footer + page number on each
  pages.forEach((p, i) =>
    p.setFooter({ text: `Page ${i + 1}/${pages.length} · ${FOOTER}` })
  );

  return pages;
}

export function pageMessage(pages, index) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === 0),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === pages.length - 1),
  );

  return { embeds: [pages[index]], components: [row] };
}
