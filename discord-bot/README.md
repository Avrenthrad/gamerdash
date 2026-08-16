# Lykodex Presence Bot

Tracks cross-platform "currently playing" status and Xbox/PlayStation
playtime for linked Lykodex accounts, using Discord's own official
Xbox/PlayStation/Steam presence integrations as the data source.

**This is a genuinely separate project from the main Lykodex app.**
It needs a persistent, always-on connection to Discord (the Gateway),
which doesn't fit inside a Vercel serverless function — those spin up
per-request and shut down, they can't hold a connection open. This
needs its own long-running host.

## One-time setup

### 1. Create the bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Either use the existing Lykodex application (the one already set
   up for "Sign in with Discord"), or create a new one
3. Go to the **Bot** tab → **Add Bot** if there isn't one yet
4. Copy the **bot token** — this goes in `.env` as `DISCORD_BOT_TOKEN`
5. On the same page, under **Privileged Gateway Intents**, toggle on
   **Presence Intent**. The bot silently receives nothing without this.

### 2. Create a Lykodex Discord server

A bot can only see presence for people it shares a server with —
there's no way around this, it's how Discord's permission model works.
Create a dedicated server (or use an existing Lykodex community
server) and invite the bot to it. Testers need to actually join this
server for tracking to work for them.

To invite the bot: Developer Portal → your app → **OAuth2** → **URL
Generator** → check `bot` scope → check the permissions it needs
(just needs to view the server and its members' presence, nothing
else) → open the generated URL → select your server.

### 3. Get the Supabase service_role key

Supabase dashboard → **Settings → API** → the **`service_role`
`secret`** key (not the anon/publishable one used everywhere else).
Goes in `.env` as `SUPABASE_SERVICE_ROLE_KEY`. Treat this like a
master password — it bypasses every Row Level Security rule in the
database.

### 4. Run it

```
npm install
npm start
```

For real use, this needs to run continuously somewhere — a small
always-on host like Railway, Fly.io, Render, or a basic VPS all work
fine for a single lightweight bot like this. `npm start` locally is
fine for testing it, but it'll stop the moment you close the terminal.

## What it does and doesn't do

- Shows real-time "currently playing X" for Xbox, PlayStation, and
  Steam/PC, sourced from Discord's own official platform integrations
- Accumulates actual playtime hours for Xbox/PlayStation specifically
  (Steam already has its own official number from Steam's own API —
  this deliberately doesn't duplicate that)
- **Cannot backfill hours played before someone links up** — there's
  no historical console playtime data anywhere to pull from, on any
  platform, official or unofficial. Tracking only ever starts counting
  forward from the moment it begins.
- Platform attribution (is this really Xbox vs PlayStation vs PC) relies
  on a Discord field their own docs admit can be unreliable — falls
  back to "unknown" rather than guessing when it's not confident.
