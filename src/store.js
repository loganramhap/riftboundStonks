/**
 * Simple JSON file store for per-guild config.
 * Stores: { [guildId]: { channelId: string } }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const PATH = './data/guilds.json';

function load() {
  if (!existsSync(PATH)) return {};
  try {
    return JSON.parse(readFileSync(PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  writeFileSync(PATH, JSON.stringify(data, null, 2));
}

export function getGuildChannel(guildId) {
  return load()[guildId]?.channelId ?? null;
}

export function setGuildChannel(guildId, channelId) {
  const data = load();
  data[guildId] = { channelId };
  save(data);
}

export function removeGuild(guildId) {
  const data = load();
  delete data[guildId];
  save(data);
}

export function getAllGuilds() {
  return load();
}
