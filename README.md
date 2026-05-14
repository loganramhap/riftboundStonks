# Riftbound Discord Bot

Posts a daily Riftbound card market report to Discord. Users add the bot to their server and pick a channel with a slash command — no config files, no technical knowledge required.

## What gets posted daily

- Top 5 biggest 1-day gainers & losers
- Top 5 biggest 7-day movers
- Top 5 biggest 30-day movers
- Top 5 priced cards per rarity

## Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- A [Discord application](https://discord.com/developers/applications)
- A [JustTCG API key](https://justtcg.com)

---

# Setup

## 1. Create the Discord bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Name it, then go to the **Bot** tab → **Add Bot**
3. Copy the **Token** — this is your `DISCORD_TOKEN`
4. Go to **General Information** and copy the **Application ID** — this is your `DISCORD_CLIENT_ID`
5. Under **Bot**, make sure **Public Bot** is enabled if you want others to invite it

## 2. Generate an invite link

1. Go to **OAuth2 → URL Generator**
2. Check `bot` and `applications.commands`
3. Under Bot Permissions check: `Send Messages`, `View Channels`
4. Copy the generated URL — this is what you share with users

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
DISCORD_TOKEN=        # from Bot tab
DISCORD_CLIENT_ID=    # from General Information tab
JUSTTCG_API_KEY=      # from justtcg.com dashboard
CRON_SCHEDULE=0 9 * * *  # optional, defaults to 9am UTC
```

## 4. Install and run

```bash
npm install
node --env-file=.env src/index.js
```

On startup the bot registers its slash commands and begins listening. Slash commands can take up to an hour to appear globally, but show up immediately in the first server you invite the bot to.

---

# Testing

## Verify the API and discover rarities

Run this once before the first deploy. It confirms the Riftbound game slug is correct and prints the rarity names used by the API (costs 2 API calls):

```bash
node --env-file=.env src/discover.js
```

If the rarity names differ from what's in `src/report.js`, update the `RARITIES` array there.

## Trigger a report manually

Once the bot is running and in your server, use the slash command:

```
/riftbound-report
```

This posts the full report immediately without waiting for the cron. Only users with **Manage Server** permission can run it.

## Slash commands

| Command | Description |
|---|---|
| `/riftbound-setup #channel` | Enable daily reports in the chosen channel |
| `/riftbound-report` | Post a report right now |
| `/riftbound-stop` | Disable reports for this server |

All commands are restricted to members with **Manage Server** permission.

---

# Deployment

The bot is stateless and uses minimal memory. Any always-on Node host works.

## Railway (easiest)

1. Push your code to a GitHub repo
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Add your environment variables under the **Variables** tab
4. Railway auto-detects Node and runs `npm start`

For persistent guild config, go to your service → **Volumes** → add a volume mounted at `/app/data`.

## Fly.io (free tier available)

```bash
npm install -g flyctl
fly launch        # follow prompts, pick the smallest instance
fly secrets set DISCORD_TOKEN=... DISCORD_CLIENT_ID=... JUSTTCG_API_KEY=...
fly deploy
```

Add a volume for persistent storage:

```bash
fly volumes create riftbound_data --size 1
```

Then add to `fly.toml`:

```toml
[mounts]
  source = "riftbound_data"
  destination = "/app/data"
```

## VPS / home server (cheapest long-term)

```bash
npm install
npm install -g pm2
pm2 start "node --env-file=.env src/index.js" --name riftbound-bot
pm2 save
pm2 startup   # survive reboots
```

---

# API call budget (free tier)

The free JustTCG tier allows 100 calls/day and 1,000/month.

| Calls | Purpose |
|---|---|
| 4 | Movers: 24h up, 24h down, 7d, 30d |
| 1 per rarity | Top priced per rarity (5 rarities = 5 calls) |
| **~9/day total** | **~270/month** |

This leaves plenty of headroom regardless of how many Discord servers the bot is in — all servers share the same API calls since the report content is identical.
