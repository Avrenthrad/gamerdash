-- Lykodex — initial Supabase schema for real, persistent accounts.
-- Run this once in Supabase Dashboard > SQL Editor > New query > Run.
--
-- Two tables:
--   profiles       — one row per user, everything from Account Settings
--                    (name, avatar, theme, currency, linked Steam ID, GD Score)
--   wishlist_items — one row per wishlisted game
--
-- Both use Row Level Security so each person can only ever see/edit
-- their own data — Supabase enforces this at the database level based
-- on who's actually logged in, not just something the app promises to
-- respect.

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  theme_mode text default 'dark',
  accent_color text default 'red',
  currency text default 'AUD',
  gd_score integer default 0,
  linked_steam_id text,
  dashboard_layout jsonb,
  platform_order jsonb,
  xbxprices_key text,
  platprices_key text,
  dashfeed_games jsonb,
  dashfeed_stores jsonb,
  dashfeed_platforms jsonb,
  profile_details jsonb,
  selected_colleges jsonb,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-creates a blank profile row the moment someone signs up, so
-- the app never has to worry about a missing profile for a real user.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.wishlist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  added_at timestamptz default now()
);

alter table public.wishlist_items enable row level security;

create policy "Users can view their own wishlist"
  on public.wishlist_items for select
  using (auth.uid() = user_id);

create policy "Users can insert into their own wishlist"
  on public.wishlist_items for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own wishlist items"
  on public.wishlist_items for delete
  using (auth.uid() = user_id);

create index wishlist_items_user_id_idx on public.wishlist_items (user_id);

-- Cross-platform playtime, aggregated by the Discord presence bot (see
-- /discord-bot). Steam hours are NEVER written here — Steam already
-- has its own official, complete playtime_forever number (fetched
-- directly from Steam's API), so tracking Steam sessions here too
-- would double-count. This table exists specifically for the two
-- platforms with no official playtime API of their own: Xbox and
-- PlayStation. Hours here can only start accumulating from the
-- moment someone links Discord and joins the tracking server — there
-- is no way to backfill time played before that point, on any platform,
-- because no such historical data source exists for consoles anywhere.
create table public.platform_playtime (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  platform text not null check (platform in ('xbox', 'playstation', 'unknown')),
  game_name text not null,
  total_minutes integer not null default 0,
  updated_at timestamptz default now(),
  unique (user_id, platform, game_name)
);

alter table public.platform_playtime enable row level security;

-- Read access is broader than most tables here on purpose — the
-- Friends dashboard needs to show a friend's cross-platform hours,
-- not just your own, the same way Discord itself shows this
-- information to anyone who can see the person's activity status.
create policy "Anyone signed in can view platform playtime"
  on public.platform_playtime for select
  using (auth.role() = 'authenticated');

-- Deliberately NO insert/update policy for regular users — only the
-- bot (using the service_role key, which bypasses RLS entirely) is
-- ever meant to write to this table. The service_role key must never
-- reach the browser or any Vercel client-facing function — it only
-- lives in the bot's own separate hosting environment.
create index platform_playtime_user_id_idx on public.platform_playtime (user_id);

-- Live "currently playing" status, written by the same bot. Kept as
-- its own table rather than adding columns to profiles specifically
-- because profiles also stores personal API keys (xbxprices_key,
-- platprices_key) — broadening that table's read policy so friends
-- could see each other's activity would also broaden it to expose
-- everyone's personal keys to every other signed-in user, which is a
-- real security mistake worth deliberately avoiding here.
create table public.current_activity (
  user_id uuid references auth.users on delete cascade primary key,
  platform text check (platform in ('xbox', 'playstation', 'steam', 'unknown')),
  game_name text,
  updated_at timestamptz default now()
);

alter table public.current_activity enable row level security;

create policy "Anyone signed in can view current activity"
  on public.current_activity for select
  using (auth.role() = 'authenticated');

-- Maps a Discord snowflake ID to a Lykodex account, so the bot can
-- look up "which Lykodex user is this Discord presence update
-- about" with one simple indexed query, using the service_role key,
-- rather than needing risky direct access to Supabase's internal
-- auth schema tables. Populated by the frontend right after a
-- successful Discord link (see AccountLinkingPage.jsx).
create table public.discord_links (
  user_id uuid references auth.users on delete cascade primary key,
  discord_user_id text unique not null,
  updated_at timestamptz default now()
);

alter table public.discord_links enable row level security;

create policy "Users can manage their own Discord link"
  on public.discord_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Backlog / To Be Played list. steam_appid is stored directly at add
-- time (from search or library-import results) rather than resolved
-- by title later — more reliable, and avoids an extra lookup every
-- time the list renders. hours_estimate is explicitly self-reported:
-- there's no legitimate public API for "how long does this game take
-- to beat" (HowLongToBeat has never published one — every wrapper
-- library for it is an unofficial scrape of their private search
-- endpoint, which this project deliberately doesn't use). Letting
-- people type in their own number, clearly labeled as their own
-- estimate, is the honest way to get a sortable "length" value.
--
-- status: matches the same 4-state model every competitor backlog
-- tracker uses (Backloggd, Grouvee, Playlogged) — Backlog/Playing/
-- Completed/Dropped, confirmed via real research rather than assumed.
-- Also what makes a genuine "what should I play next" feature
-- possible — picking a random suggestion only makes sense from the
-- "backlog" status specifically, not from games already finished.
create table public.backlog_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  steam_appid text,
  hours_estimate numeric,
  status text default 'backlog' check (status in ('backlog', 'playing', 'completed', 'dropped')),
  added_at timestamptz default now()
);

alter table public.backlog_items enable row level security;

create policy "Users can view their own backlog"
  on public.backlog_items for select
  using (auth.uid() = user_id);

create policy "Users can add to their own backlog"
  on public.backlog_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own backlog items"
  on public.backlog_items for update
  using (auth.uid() = user_id);

create policy "Users can remove their own backlog items"
  on public.backlog_items for delete
  using (auth.uid() = user_id);

create index backlog_items_user_id_idx on public.backlog_items (user_id);

-- If you already ran an earlier version of this schema (before
-- dashboard_layout/platform_order/xbxprices_key/platprices_key
-- existed), run this instead of the CREATE TABLE above to add the new
-- columns without losing existing data:
--   alter table public.profiles add column if not exists dashboard_layout jsonb;
--   alter table public.profiles add column if not exists platform_order jsonb;
--   alter table public.profiles add column if not exists xbxprices_key text;
--   alter table public.profiles add column if not exists platprices_key text;
--   alter table public.profiles add column if not exists dashfeed_games jsonb;
--   alter table public.profiles add column if not exists dashfeed_stores jsonb;
--   alter table public.profiles add column if not exists dashfeed_platforms jsonb;
--   alter table public.profiles add column if not exists profile_details jsonb;
--   alter table public.profiles add column if not exists selected_colleges jsonb;
--
-- The four new tables (platform_playtime, current_activity,
-- discord_links, backlog_items) can't be added via a simple alter
-- table — if you already ran an earlier schema version, just run each
-- one's "create table" block (and the policy right after it)
-- directly; they're additive and won't affect anything else.
--
-- Trading Cards — Phase 1: Magic the Gathering (collection, deck
-- building, pricing). Real card data throughout, via Scryfall's
-- genuine free public API — see lib/scryfall.js. scryfall_id is
-- stored directly at add time (search/autocomplete results already
-- carry it) rather than resolved by name later, same reasoning as
-- backlog_items.steam_appid.
create table public.mtg_collection (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  scryfall_id text not null,
  card_name text not null,
  set_code text,
  quantity integer default 1,
  foil boolean default false,
  condition text default 'Near Mint',
  added_at timestamptz default now()
);

alter table public.mtg_collection enable row level security;

create policy "Users can view their own MTG collection"
  on public.mtg_collection for select
  using (auth.uid() = user_id);

create policy "Users can add to their own MTG collection"
  on public.mtg_collection for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own MTG collection"
  on public.mtg_collection for update
  using (auth.uid() = user_id);

create policy "Users can remove from their own MTG collection"
  on public.mtg_collection for delete
  using (auth.uid() = user_id);

create index mtg_collection_user_id_idx on public.mtg_collection (user_id);

create table public.mtg_decks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  format text default 'commander',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mtg_decks enable row level security;

create policy "Users can manage their own MTG decks"
  on public.mtg_decks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.mtg_deck_cards (
  id uuid default gen_random_uuid() primary key,
  deck_id uuid references public.mtg_decks on delete cascade not null,
  scryfall_id text not null,
  card_name text not null,
  quantity integer default 1,
  is_sideboard boolean default false
);

alter table public.mtg_deck_cards enable row level security;

-- Owned indirectly through the parent deck, not a direct user_id
-- column — the policy checks the deck this card belongs to is
-- actually owned by the current user.
create policy "Users can manage cards in their own MTG decks"
  on public.mtg_deck_cards for all
  using (exists (select 1 from public.mtg_decks where mtg_decks.id = mtg_deck_cards.deck_id and mtg_decks.user_id = auth.uid()))
  with check (exists (select 1 from public.mtg_decks where mtg_decks.id = mtg_deck_cards.deck_id and mtg_decks.user_id = auth.uid()));

create index mtg_deck_cards_deck_id_idx on public.mtg_deck_cards (deck_id);


-- Guilds — real social groups of Lykodex users. NOT the same as the
-- 5 top-level "Colleges" (Gaming/TCG/Entertainment/Collectibles/
-- Tabletop) — a Guild is a small crew of people, cutting across all
-- of them. Deliberately real-data-only: the activity feed surfaces
-- things Lykodex already genuinely tracks (achievements, GD Score,
-- backlog status, wishlist adds, MTG collection adds) rather than
-- inventing new stats. No per-game "raids won"/"K:D ratio" style
-- data — most games don't expose that to third parties, and faking
-- it would violate the core honesty principle held everywhere else
-- in this project.
create table public.guilds (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

alter table public.guilds enable row level security;

create policy "Any signed-in user can browse guilds"
  on public.guilds for select
  using (auth.uid() is not null);

create policy "Any signed-in user can create a guild"
  on public.guilds for insert
  with check (auth.uid() = created_by);

create policy "Only the creator can update or delete their guild"
  on public.guilds for update
  using (auth.uid() = created_by);

create policy "Only the creator can delete their guild"
  on public.guilds for delete
  using (auth.uid() = created_by);

create table public.guild_members (
  id uuid default gen_random_uuid() primary key,
  guild_id uuid references public.guilds on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamptz default now(),
  unique (guild_id, user_id)
);

alter table public.guild_members enable row level security;

create policy "Any signed-in user can view guild rosters"
  on public.guild_members for select
  using (auth.uid() is not null);

-- v1 deliberately has no kick/roles system — a member can only add
-- or remove themselves, not manage anyone else's membership.
create policy "Users can join a guild themselves"
  on public.guild_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave a guild themselves"
  on public.guild_members for delete
  using (auth.uid() = user_id);

-- The shared activity feed. Members-only visibility (real personal
-- activity, not something to make publicly browsable) — event_data is
-- a small jsonb payload (e.g. { "title": "Elden Ring" }) rather than a
-- rigid column-per-event-type schema, since new real event types will
-- likely be added over time.
create table public.guild_activity (
  id uuid default gen_random_uuid() primary key,
  guild_id uuid references public.guilds on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  event_type text not null check (event_type in (
    'achievement_unlocked', 'gd_score_milestone', 'backlog_status_change',
    'wishlist_added', 'mtg_card_added', 'joined_guild'
  )),
  event_data jsonb,
  created_at timestamptz default now()
);

alter table public.guild_activity enable row level security;

create policy "Guild members can view their guild's activity feed"
  on public.guild_activity for select
  using (exists (select 1 from public.guild_members where guild_members.guild_id = guild_activity.guild_id and guild_members.user_id = auth.uid()));

-- Users can only ever log their OWN real activity, and only into a
-- guild they're actually a member of — never on someone else's behalf.
create policy "Members can log their own real activity"
  on public.guild_activity for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.guild_members where guild_members.guild_id = guild_activity.guild_id and guild_members.user_id = auth.uid())
  );

create index guild_members_guild_id_idx on public.guild_members (guild_id);
create index guild_members_user_id_idx on public.guild_members (user_id);
create index guild_activity_guild_id_idx on public.guild_activity (guild_id, created_at desc);

-- Entertainment College — first real slice: movies and TV via TMDB's
-- genuine free API (see lib/tmdb.js). Anime (AniList) and books (Open
-- Library) are researched and approved but not yet built — this table
-- shape already accommodates them (media_kind/source are open to
-- anime/book values) so adding those sources later won't need a
-- schema change, just new source integrations.
create table public.entertainment_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  media_kind text not null check (media_kind in ('movie', 'tv', 'anime', 'book')),
  source text not null check (source in ('tmdb', 'anilist', 'open_library', 'manual')),
  source_item_id text,
  title text not null,
  status text not null default 'want_to_watch' check (status in ('want_to_watch', 'watching', 'completed', 'dropped')),
  cover_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.entertainment_entries enable row level security;

create policy "Users can manage their own entertainment entries"
  on public.entertainment_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index entertainment_entries_user_id_idx on public.entertainment_entries (user_id);

-- If you already ran backlog_items before the status column existed:
--   alter table public.backlog_items add column if not exists status text default 'backlog' check (status in ('backlog', 'playing', 'completed', 'dropped'));
--
-- The three new MTG tables (mtg_collection, mtg_decks, mtg_deck_cards)
-- are additive, same as the tables above — if you already ran an
-- earlier schema version, just run each "create table" block (and the
-- policy right after it) directly.
--
-- Collectibles College — Phase 1 of an approved design: a real
-- personal physical inventory (shelf + hardware), not a fake browsable
-- catalogue. No general catalogue API exists for most of these types
-- (Funko, statues, pins) — verified during scoping — so this is
-- honest structured user entry by design, not a placeholder waiting
-- for an API that doesn't exist. package_state and condition are
-- separate, first-class fields (a set can be genuinely sealed OR
-- built, a Pop boxed OR loose) rather than one vague "condition"
-- field, since collectors actually track these as distinct facts.
-- source is already 'user'-only right now but includes real future
-- integrations (Rebrickable, Discogs, IGDB — all independently
-- confirmed real) approved for later phases, so the column won't
-- need to change shape when those land.
create table public.collectible_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in (
    'figure', 'statue', 'funko_pop', 'lego_set', 'model_kit', 'amiibo', 'prop', 'pin',
    'vinyl_music', 'print', 'collectors_edition', 'console', 'controller', 'accessory', 'other'
  )),
  title text not null,
  identifier text,
  package_state text not null default 'sealed' check (package_state in (
    'sealed', 'opened_boxed', 'loose', 'boxed_complete', 'boxed_incomplete', 'discarded_box'
  )),
  condition text not null default 'mint' check (condition in ('mint', 'near_mint', 'good', 'fair', 'poor')),
  qty integer not null default 1,
  price_paid numeric,
  currency text,
  acquired_at date,
  notes text,
  source text not null default 'user' check (source in ('user', 'rebrickable', 'brickset', 'discogs', 'igdb', 'amiiboapi')),
  is_wishlist boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.collectible_entries enable row level security;

create policy "Users can manage their own collectible entries"
  on public.collectible_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index collectible_entries_user_id_idx on public.collectible_entries (user_id);

-- If you already ran backlog_items before the status column existed:
--   alter table public.backlog_items add column if not exists status text default 'backlog' check (status in ('backlog', 'playing', 'completed', 'dropped'));
--
-- The three new MTG tables (mtg_collection, mtg_decks, mtg_deck_cards)
-- are additive, same as the tables above — if you already ran an
-- earlier schema version, just run each "create table" block (and the
-- policy right after it) directly.
--
-- Tabletop College — real RPG and wargame tracking. Deliberately
-- scoped down from an earlier, much larger design that included
-- infrastructure for two unbuilt future products (a Discord
-- integration and a digital VTT app) — those are real future ideas,
-- but building schema for products that don't exist yet risks
-- reworking live tables once they're actually scoped for real. This
-- is the same "prove out the core first" approach used for every
-- other College. campaign/character link-out URL fields ARE kept,
-- since "link to your existing D&D Beyond campaign" is genuinely
-- useful today, unlike the Discord-specific hooks.
create table public.tabletop_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  system_key text not null,
  role text not null default 'player' check (role in ('gm', 'player', 'both')),
  status text not null default 'planning' check (status in ('planning', 'active', 'hiatus', 'concluded')),
  summary text,
  next_session_at timestamptz,
  external_vtt_url text,
  dndbeyond_campaign_url text,
  total_session_minutes integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tabletop_campaigns enable row level security;

create policy "Users can manage their own campaigns"
  on public.tabletop_campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.tabletop_characters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  campaign_id uuid references public.tabletop_campaigns on delete set null,
  name text not null,
  system_key text not null,
  player_name text,
  level_or_tier text,
  class_or_playbook text,
  sheet_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tabletop_characters enable row level security;

create policy "Users can manage their own characters"
  on public.tabletop_characters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.tabletop_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  campaign_id uuid references public.tabletop_campaigns on delete cascade not null,
  played_at date,
  duration_minutes integer,
  recap text,
  created_at timestamptz default now()
);

alter table public.tabletop_sessions enable row level security;

create policy "Users can manage their own sessions"
  on public.tabletop_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.wargame_armies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  system_key text not null,
  name text not null,
  faction text,
  points_limit integer,
  status text not null default 'collecting' check (status in ('collecting', 'building', 'playable', 'archived')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.wargame_armies enable row level security;

create policy "Users can manage their own armies"
  on public.wargame_armies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.wargame_units (
  id uuid default gen_random_uuid() primary key,
  army_id uuid references public.wargame_armies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  datasheet_name text,
  model_count integer not null default 1,
  points_cost integer,
  painted_status text not null default 'unassembled' check (painted_status in ('unassembled', 'assembled', 'primed', 'partial', 'finished')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.wargame_units enable row level security;

create policy "Users can manage their own units"
  on public.wargame_units for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.wargame_games (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  system_key text not null,
  army_id uuid references public.wargame_armies on delete set null,
  played_at date,
  opponent_name text,
  opponent_faction text,
  points_level integer,
  result text not null check (result in ('win', 'loss', 'draw', 'unfinished')),
  score_us integer,
  score_them integer,
  notes text,
  created_at timestamptz default now()
);

alter table public.wargame_games enable row level security;

create policy "Users can manage their own game results"
  on public.wargame_games for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index tabletop_campaigns_user_id_idx on public.tabletop_campaigns (user_id);
create index tabletop_characters_user_id_idx on public.tabletop_characters (user_id);
create index tabletop_sessions_campaign_id_idx on public.tabletop_sessions (campaign_id);
create index wargame_armies_user_id_idx on public.wargame_armies (user_id);
create index wargame_units_army_id_idx on public.wargame_units (army_id);
create index wargame_games_user_id_idx on public.wargame_games (user_id);

-- If you already ran backlog_items before the status column existed:
--   alter table public.backlog_items add column if not exists status text default 'backlog' check (status in ('backlog', 'playing', 'completed', 'dropped'));
--
-- The three new MTG tables (mtg_collection, mtg_decks, mtg_deck_cards)
-- are additive, same as the tables above — if you already ran an
-- earlier schema version, just run each "create table" block (and the
-- policy right after it) directly.
--
-- The three new Guild tables (guilds, guild_members, guild_activity)
-- are additive too, same pattern.
--
-- Avatar storage — a real, genuine fix for a bug that's been present
-- since very early in this project: avatar "upload" was only ever
-- creating a browser-local blob: URL (URL.createObjectURL), which
-- looks like it works for a moment but is never actually saved
-- anywhere — it goes dead on any refresh, new session, or different
-- device. This creates a real public storage bucket and RLS scoping
-- each user to only write inside their own user-id-named folder,
-- matching every other table's ownership pattern in this project.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- entertainment_entries is additive too, same pattern.
--
-- collectible_entries is additive too, same pattern.
--
-- The six new Tabletop/Wargame tables are additive too, same pattern.
--
-- The avatars storage bucket + policies are additive too — if you
-- already have an "avatars" bucket, the "on conflict do nothing"
-- above means it's safe to run this again.
--
-- If you already ran collectible_entries before is_wishlist existed:
--   alter table public.collectible_entries add column if not exists is_wishlist boolean not null default false;

-- ---------- TCG: Binders & Set Lists (additive) ----------
-- A "binder" is a user-named group of cards (with labels + an optional
-- cover photo) separate from the flat mtg_collection list — e.g. "EDH
-- staples" or "Trade box". A "set list" is the same table with kind =
-- 'set_list': it's pinned to one real Scryfall set (set_code/set_name/
-- scryfall_set_icon_url all come straight from Scryfall's own Set API,
-- never invented) and mtg_binder_cards under it doubles as that set's
-- owned-quantity checklist.
create table public.mtg_binders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  labels jsonb default '[]'::jsonb,
  cover_image_url text,
  kind text not null default 'binder' check (kind in ('binder', 'set_list')),
  set_code text,
  set_name text,
  scryfall_set_icon_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mtg_binders enable row level security;

create policy "Users can manage their own binders"
  on public.mtg_binders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index mtg_binders_user_id_idx on public.mtg_binders (user_id);

-- One row per distinct card per binder (quantity holds the count),
-- same "stable id at add time, live data resolved later" pattern as
-- mtg_collection — never a stored price/text snapshot that goes stale.
create table public.mtg_binder_cards (
  id uuid default gen_random_uuid() primary key,
  binder_id uuid references public.mtg_binders on delete cascade not null,
  scryfall_id text not null,
  card_name text not null,
  set_code text,
  quantity integer not null default 1,
  foil boolean default false,
  added_at timestamptz default now(),
  unique (binder_id, scryfall_id)
);

alter table public.mtg_binder_cards enable row level security;

-- Owned indirectly through the parent binder, same pattern as
-- mtg_deck_cards -> mtg_decks.
create policy "Users can manage cards in their own binders"
  on public.mtg_binder_cards for all
  using (exists (select 1 from public.mtg_binders where mtg_binders.id = mtg_binder_cards.binder_id and mtg_binders.user_id = auth.uid()))
  with check (exists (select 1 from public.mtg_binders where mtg_binders.id = mtg_binder_cards.binder_id and mtg_binders.user_id = auth.uid()));

create index mtg_binder_cards_binder_id_idx on public.mtg_binder_cards (binder_id);

-- Decks get the same labels + cover treatment as binders, for visual
-- consistency across the TCG My Collection hub tabs.
alter table public.mtg_decks add column if not exists labels jsonb default '[]'::jsonb;
alter table public.mtg_decks add column if not exists cover_image_url text;

-- Cover photo storage for binders/set lists/decks — identical pattern
-- to the avatars bucket above (public read, write scoped to the
-- uploader's own user-id folder).
insert into storage.buckets (id, name, public)
values ('mtg-covers', 'mtg-covers', true)
on conflict (id) do nothing;

create policy "MTG cover images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'mtg-covers');

create policy "Users can upload their own MTG cover images"
  on storage.objects for insert
  with check (bucket_id = 'mtg-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own MTG cover images"
  on storage.objects for update
  using (bucket_id = 'mtg-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own MTG cover images"
  on storage.objects for delete
  using (bucket_id = 'mtg-covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Game Mastery Score ----------
-- Cross-platform "Gamerscore equivalent". Steam's half is fully real
-- and live-computed (unlocked achievements + Steam's own global
-- unlock-percent rarity, via the existing ISteamUserStats endpoints —
-- see lib/steam.js). Xbox and PlayStation have no public API for a
-- person's own earned achievements/trophies at all (see
-- AccountLinkingPage.jsx's honest "not available" listing for both),
-- so their inputs are real numbers the person types in themselves —
-- self-reported, not scraped, and labeled as such in the UI. See
-- lib/gameMastery.js for the pure scoring math and
-- lib/gameMasteryData.js for how these inputs get combined.
create table public.mastery_inputs (
  user_id uuid references auth.users on delete cascade primary key,
  xbox_gamerscore integer,
  xbox_updated_at timestamptz,
  -- { bronze: {common,rare,very_rare,ultra_rare}, silver: {...}, gold: {...}, platinum: {...} },
  -- each a real trophy count the person read off their own PSN trophy
  -- case (Sony's own trophy UI already breaks trophies down exactly
  -- this way by tier x rarity).
  ps_trophy_counts jsonb,
  ps_updated_at timestamptz,
  updated_at timestamptz default now()
);

alter table public.mastery_inputs enable row level security;

create policy "Users can manage their own mastery inputs"
  on public.mastery_inputs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cached result on the profile, same pattern as gd_score — recomputed
-- (see lib/gameMasteryData.js's recomputeMastery) whenever a linked
-- platform's data changes, not on every page load.
alter table public.profiles add column if not exists mastery_score numeric default 0;
alter table public.profiles add column if not exists mastery_xp integer default 0;
alter table public.profiles add column if not exists mastery_level integer default 0;
-- Per-platform breakdown for the UI: raw score, normalized score,
-- data source, and "as of" time per linked platform — never just the
-- final number with no way to see where it came from.
alter table public.profiles add column if not exists mastery_breakdown jsonb;
alter table public.profiles add column if not exists mastery_computed_at timestamptz;
