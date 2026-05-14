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
import { getGuildChannel, setGuildChannel, removeGuild, getAllGuilds } from './store.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const TEST_GUILD_ID = process.env.TEST_GUILD_ID ?? null; // optional: instant command registration for testing
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '0 9 * * *';

if (!DISCORD_TOKEN || !CLIENT_ID || !process.env.JUSTTCG_API_KEY) {
  console.error('Missing env vars: DISCORD_TOKEN, DISCORD_CLIENT_ID, JUSTTCG_API_KEY');
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

    const embeds = await generateReport();
    for (const embed of embeds) {
      await channel.send({ embeds: [embed] });
    }
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
    await interaction.deferReply({ ephemeral: true });
    try {
      const embeds = await generateReport();
      for (const embed of embeds) {
        await interaction.channel.send({ embeds: [embed] });
      }
      await interaction.editReply({ content: '✅ Report posted!' });
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
  cron.schedule(CRON_SCHEDULE, postDailyReportToAll, { timezone: 'UTC' });
  console.log(`[bot] Scheduled: ${CRON_SCHEDULE} UTC`);
});

client.login(DISCORD_TOKEN);
