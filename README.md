# Riftbound Discord Bot

Posts a daily Riftbound card market report to Discord. Users add the bot to their server and pick a channel with a slash command — no config files, no technical knowledge required.

Price data is fetched from the [TCGTracking.com open API](https://tcgtracking.com/tcgapi/) (no API key required) and stored locally. Percentage changes are calculated from your own historical snapshots.

## What gets posted daily

- Top 5 biggest 1-day gainers & losers (% change)
- Top 5 biggest 7-day movers (% change)
- Top 5 biggest 30-day movers (% change)
- Top 5 most expensive cards

> Note: % change sections require accumulated history — 24h data appears after day 1, 7d after day 7, 30d after day 30.

## Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- A [Discord application](https://discord.com/developers/applications)

---

# Setup

## 1. Create the Discord bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Name it, then go to the **Bot** tab → **Reset Token** and copy it — this is your `DISCORD_TOKEN`
3. Go to **General Information** and copy the **Application ID** — this is your `DISCORD_CLIENT_ID`
4. Under **Bot**, enable **Public Bot** if you want others to invite it

## 2. Generate an invite link

1. Go to **OAuth2 → URL Generator**
2. Check `bot` and `applications.commands`
3. Under Bot Permissions check: `Send Messages`, `View Channels`
4. Copy the generated URL and open it to invite the bot to your server

## 3. Configure environment variables

Fill in `.env`:

```
DISCORD_TOKEN=        # from Bot tab
DISCORD_CLIENT_ID=    # from General Information tab
CRON_SCHEDULE=0 9 * * *  # optional, defaults to 9am UTC
```

## 4. Install and run

```bash
npm install
node --env-file=.env src/index.js
```

On startup the bot:
- Registers its slash commands
- Takes an initial price snapshot (stored in `data/prices.json`)
- Schedules a daily snapshot at 8am UTC and report at 9am UTC

Slash commands can take up to an hour to appear globally, but show up immediately in the server you invited the bot to.

---

# Usage

## Slash commands

| Command | Description |
|---|---|
| `/riftbound-setup #channel` | Enable daily reports in the chosen channel |
| `/riftbound-report` | Post a report right now |
| `/riftbound-stop` | Disable reports for this server |

All commands require **Manage Server** permission.

## Trigger a report manually

Once the bot is running and invited to your server:

```
/riftbound-report
```

Posts the full report immediately. % change sections will show "No data" until enough price history has been collected.

---

# Deployment

## Railway (easiest)

1. Push your code to a GitHub repo
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Add `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` under the **Variables** tab
4. Railway auto-detects Node and runs `npm start`

For persistent price history, go to your service → **Volumes** → add a volume mounted at `/app/data`.

## Fly.io

```bash
npm install -g flyctl
fly launch
fly secrets set DISCORD_TOKEN=... DISCORD_CLIENT_ID=...
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

## VPS / home server

```bash
npm install
npm install -g pm2
pm2 start "node --env-file=.env src/index.js" --name riftbound-bot
pm2 save
pm2 startup
```

---

# How price tracking works

On startup and every day at 8am UTC, the bot fetches current market prices for all Riftbound cards across all sets from TCGTracking.com and saves a snapshot to `data/prices.json`. The daily report compares today's snapshot against the 1-day, 7-day, and 30-day old snapshots to compute percentage changes.

Snapshots are retained for 31 days and then pruned automatically.
