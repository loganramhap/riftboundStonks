import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import cron from 'node-cron';
import { mkdirSync } from 'fs';
import { generateReport } from './report.js';
import { pageMessage } from './format.js';
import { snapshotPrices } from './prices.js';
import { getGuildChannel, setGuildChannel, removeGuild, getAllGuilds } from './store.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const TEST_GUILD_ID = process.env.TEST_GUILD_ID ?? null; // optional: instant command registration for testing
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '0 9 * * *';

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Missing env vars: DISCORD_TOKEN, DISCORD_CLIENT_ID');
  process.exit(1);
}

// Ensure data directory exists
mkdirSync('./data', { recursive: true });

// --- Slash commands ---
const commands = [
  new SlashCommandBuilder()
    .setName('riftbound-setup')
    .setDescription('Set the channel for daily Riftbound market reports')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('The channel to post reports in')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('riftbound-stop')
    .setDescription('Stop daily Riftbound market reports in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('riftbound-report')
    .setDescription('Post the Riftbound market report right now')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
];

// Register slash commands — guild-scoped if TEST_GUILD_ID is set (instant), otherwise global (up to 1hr)
const rest = new REST().setToken(DISCORD_TOKEN);
const commandRoute = TEST_GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

await rest.put(commandRoute, { body: commands });
console.log(`[bot] Slash commands registered (${TEST_GUILD_ID ? `guild ${TEST_GUILD_ID}` : 'global'})`);

// --- Discord client ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function postReportToGuild(guildId) {
  const channelId = getGuildChannel(guildId);
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;

    const pages = await generateReport();
    let index = 0;
    const msg = await channel.send(pageMessage(pages, index));

    // Listen for button clicks for 10 minutes
    const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });
    collector.on('collect', async (btn) => {
      await btn.deferUpdate();
      if (btn.customId === 'prev') index = Math.max(0, index - 1);
      if (btn.customId === 'next') index = Math.min(pages.length - 1, index + 1);
      await msg.edit(pageMessage(pages, index));
    });
    collector.on('end', () => {
      // Disable buttons when collector expires
      msg.edit({ components: [] }).catch(() => {});
    });

    console.log(`[bot] Report posted to guild ${guildId}`);
  } catch (err) {
    console.error(`[bot] Failed to post to guild ${guildId}:`, err.message);
  }
}

async function postDailyReportToAll() {
  const guilds = getAllGuilds();
  for (const guildId of Object.keys(guilds)) {
    await postReportToGuild(guildId);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;

  if (commandName === 'riftbound-setup') {
    const channel = interaction.options.getChannel('channel');
    setGuildChannel(guildId, channel.id);
    await interaction.reply({
      content: `✅ Daily Riftbound reports will be posted in ${channel} every day at 9am UTC.\nUse \`/riftbound-report\` to post one right now.`,
      ephemeral: true,
    });
  }

  if (commandName === 'riftbound-stop') {
    removeGuild(guildId);
    await interaction.reply({
      content: '✅ Daily Riftbound reports have been disabled for this server.',
      ephemeral: true,
    });
  }

  if (commandName === 'riftbound-report') {
    await interaction.deferReply();
    try {
      const pages = await generateReport();
      let index = 0;
      const msg = await interaction.editReply(pageMessage(pages, index));

      const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });
      collector.on('collect', async (btn) => {
        await btn.deferUpdate();
        if (btn.customId === 'prev') index = Math.max(0, index - 1);
        if (btn.customId === 'next') index = Math.min(pages.length - 1, index + 1);
        await msg.edit(pageMessage(pages, index));
      });
      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });
    } catch (err) {
      console.error('[bot] /riftbound-report failed:', err);
      await interaction.editReply({ content: `❌ Failed to generate report: ${err.message}` });
    }
  }
});

// Clean up config when bot is removed from a server
client.on('guildDelete', (guild) => {
  removeGuild(guild.id);
  console.log(`[bot] Removed from guild ${guild.id}, config cleared`);
});

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    if ((current + '\n' + line).length > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

client.once('clientReady', () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);

  // Snapshot prices at 8am UTC, report posts at 9am UTC
  cron.schedule('0 8 * * *', snapshotPrices, { timezone: 'UTC' });
  cron.schedule(CRON_SCHEDULE, postDailyReportToAll, { timezone: 'UTC' });
  console.log(`[bot] Scheduled: snapshot 08:00 UTC, report ${CRON_SCHEDULE} UTC`);

  // Take an initial snapshot on startup if none exists for today
  snapshotPrices().catch((err) => console.error('[bot] Initial snapshot failed:', err.message));
});

client.login(DISCORD_TOKEN);
