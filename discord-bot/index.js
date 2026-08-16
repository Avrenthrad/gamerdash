// Lykodex Presence Bot
//
// A standalone, always-on Discord bot — genuinely separate from the
// main Lykodex app on purpose. Discord presence data is only
// available through a persistent Gateway (WebSocket) connection, not
// a normal request/response API call, so it can't live inside a
// Vercel serverless function the way everything else in this project
// does. This needs its own always-on hosting (Railway, Fly.io, a
// small VPS — anywhere that runs a long-lived Node process).
//
// What it does:
//   1. Watches presence for every Discord user who has linked their
//      Lykodex account (via discord_links, populated by the
//      frontend after a successful Discord OAuth link).
//   2. Writes their LIVE "currently playing" status to
//      current_activity — shown as real-time activity on the website.
//   3. For Xbox/PlayStation specifically, measures session duration
//      itself (start-to-end, timestamped locally) and accumulates it
//      into platform_playtime. Steam is deliberately excluded here —
//      Steam already has its own official, complete playtime number
//      fetched directly from Steam's API, so tracking it again here
//      would double-count.
//
// Honest limitation, not a bug: hours can only start accumulating
// from the moment someone links Discord and joins the tracking
// server. There's no way to backfill time played before that point on
// Xbox or PlayStation — no such historical data exists anywhere,
// official or otherwise. Steam remains the only platform with real
// history, because Steam is the only one that actually publishes it.

import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const { DISCORD_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!DISCORD_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars — see .env.example in this folder.");
  process.exit(1);
}

// IMPORTANT: this is the service_role key, which bypasses Row Level
// Security entirely — that's necessary here because the bot writes
// data on behalf of users who aren't the ones making the request, but
// it means this key must NEVER be reused anywhere client-facing (not
// in the Vercel app, not in the browser). It only belongs here, in
// this bot's own separate environment.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences, // privileged — must also be toggled on for this bot in the Discord Developer Portal
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.User, Partials.GuildMember],
});

// In-memory "what is this person doing right now" state, keyed by
// Discord user ID. Only Xbox/PlayStation sessions accumulate into
// platform_playtime; every platform (including Steam/PC) still
// updates the live current_activity display.
const activeSessions = new Map();

// discord_links lookups happen often (every presence update from
// every tracked user) — a short in-memory cache avoids hammering
// Supabase for a mapping that essentially never changes.
const linkCache = new Map();
const LINK_CACHE_TTL_MS = 10 * 60 * 1000;

async function findLykodexUserId(discordUserId) {
  const cached = linkCache.get(discordUserId);
  if (cached && Date.now() - cached.cachedAt < LINK_CACHE_TTL_MS) {
    return cached.userId;
  }

  const { data, error } = await supabase
    .from("discord_links")
    .select("user_id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) {
    console.error("discord_links lookup failed:", error);
    return null;
  }

  const userId = data?.user_id ?? null;
  linkCache.set(discordUserId, { userId, cachedAt: Date.now() });
  return userId;
}

// Discord's own console/Xbox/PlayStation integrations surface as a
// normal "Playing" activity (type 0) with a platform field — 'xbox',
// 'playstation', or otherwise (desktop-native games, or Steam/PC
// detection, fall under other platform values). Discord's own docs
// note this field can be unreliable, so anything unexpected here
// deliberately falls back to "unknown" rather than guessing.
function normalizePlatform(activity) {
  const raw = (activity?.platform || "").toLowerCase();
  if (raw === "xbox") return "xbox";
  if (raw === "playstation") return "playstation";
  if (raw === "desktop" || raw === "steam") return "steam";
  return "unknown";
}

function currentGameActivity(presence) {
  if (!presence?.activities) return null;
  // Type 0 = "Playing" — excludes Spotify (2), Custom Status (4),
  // Watching (3), etc., which aren't games.
  return presence.activities.find((a) => a.type === 0) || null;
}

async function updateCurrentActivity(userId, activity) {
  await supabase.from("current_activity").upsert({
    user_id: userId,
    platform: activity ? normalizePlatform(activity) : null,
    game_name: activity?.name || null,
    updated_at: new Date().toISOString(),
  });
}

async function accumulatePlaytime(userId, platform, gameName, startedAt) {
  if (platform !== "xbox" && platform !== "playstation") return; // Steam/unknown never accumulate here

  const minutes = Math.round((Date.now() - startedAt) / 60000);
  if (minutes <= 0) return;

  const { data: existing } = await supabase
    .from("platform_playtime")
    .select("total_minutes")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("game_name", gameName)
    .maybeSingle();

  const newTotal = (existing?.total_minutes || 0) + minutes;

  await supabase.from("platform_playtime").upsert({
    user_id: userId,
    platform,
    game_name: gameName,
    total_minutes: newTotal,
    updated_at: new Date().toISOString(),
  });
}

client.on("presenceUpdate", async (_oldPresence, newPresence) => {
  const discordUserId = newPresence.userId;
  const userId = await findLykodexUserId(discordUserId);
  if (!userId) return; // this Discord user hasn't linked a Lykodex account

  const activity = currentGameActivity(newPresence);
  const platform = activity ? normalizePlatform(activity) : null;
  const gameName = activity?.name || null;

  const prevSession = activeSessions.get(discordUserId);

  const sessionChanged =
    prevSession?.gameName !== gameName || prevSession?.platform !== platform;

  if (sessionChanged) {
    // Close out whatever was running before.
    if (prevSession) {
      await accumulatePlaytime(userId, prevSession.platform, prevSession.gameName, prevSession.startedAt);
    }
    // Open a new session if they're playing something now.
    if (activity) {
      activeSessions.set(discordUserId, { platform, gameName, startedAt: Date.now() });
    } else {
      activeSessions.delete(discordUserId);
    }
  }

  await updateCurrentActivity(userId, activity);
});

client.once("ready", () => {
  console.log(`Lykodex Presence Bot online as ${client.user.tag}`);
});

client.on("error", (err) => console.error("Discord client error:", err));

// Safety net: if the process gets killed, close out any open sessions
// so their time isn't silently lost (capped at whatever's accrued so
// far — better to under-count by a few seconds than lose a session).
async function shutdown() {
  console.log("Shutting down — closing open sessions…");
  for (const [discordUserId, session] of activeSessions.entries()) {
    const userId = await findLykodexUserId(discordUserId);
    if (userId) {
      await accumulatePlaytime(userId, session.platform, session.gameName, session.startedAt);
    }
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

client.login(DISCORD_BOT_TOKEN);
