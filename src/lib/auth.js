// Real email/password auth via Supabase.
// Deliberately skipping email confirmation and OAuth providers for
// the first testing pass — both need real redirect URLs (once
// deployed) and add friction that isn't worth it for a small trusted
// test group. Plain email/password gets testers in fastest; harden
// this later (email confirmation, Google/Discord OAuth) once there's
// a real deployed URL to register with those providers.

import { supabase } from "./supabaseClient";

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Real OAuth sign-in (not linking — see linkIdentity below for that).
// Supabase's signInWithOAuth() redirects the browser to the provider
// itself by default, so this "returns" only if kicking off the
// redirect fails (provider not enabled in Supabase, etc.) — a
// successful call never resolves here, the page navigates away.
//
// Setup needed per provider (Supabase dashboard, not code):
//   Authentication > Providers > enable it, paste the Client ID/Secret
//   from that provider's own developer console, and add this app's
//   real deployed URL (now that one exists) as an authorized redirect
//   there. Apple additionally requires a Services ID + a private key
//   generated in Apple's developer portal, not just a client secret.
export async function signInWithOAuth(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}${window.location.pathname}#/dashboard` },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Real OAuth account linking (Discord, Twitch) — genuinely different
// from the Bungie/Destiny 2 OAuth built earlier: that needed OUR
// deployed URL registered with Bungie directly. This uses Supabase's
// own built-in OAuth handling, whose callback URL is Supabase's own
// fixed domain (doesn't depend on our deployment at all) — meaning
// this can actually be set up and tested during local dev right now,
// not blocked on deployment like Destiny 2 was.
//
// Setup needed (one-time, in Supabase's dashboard, not code):
//   1. Authentication > Providers > enable Discord/Twitch, paste in
//      the Client ID/Secret from each platform's own developer portal
//   2. Authentication > Settings > enable "Allow manual linking"
//      (required specifically for linkIdentity, not just normal login)
// Each provider's app registration needs Supabase's callback URL
// added as an allowed redirect — that's shown right on the same
// Supabase provider settings page once you're there.
export async function linkIdentity(provider) {
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${window.location.origin}${window.location.pathname}#/linking` },
  });
  if (error) throw error;
  return data; // { url } — caller should redirect the browser here
}

export async function unlinkProviderIdentity(provider) {
  const { data: identitiesData, error: listError } = await supabase.auth.getUserIdentities();
  if (listError) throw listError;
  const identity = identitiesData.identities.find((i) => i.provider === provider);
  if (!identity) return;
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw error;
}

export async function getLinkedProviders() {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return data.identities.map((i) => i.provider);
}

// Records the Discord snowflake ID in discord_links right after a
// successful link — this is what lets the presence bot (running
// separately, using the service_role key) match a Discord presence
// update back to a Lykodex account. Self-contained — fetches its
// own session rather than requiring a userId param, so it's safe to
// call from anywhere right after checking Discord is linked.
//
// Field priority: Supabase's own top-level Identity.id is documented
// as "the provider identifier of the user" (the cleanest, most
// abstracted source) — checked first. identity_data.id is the second
// choice since Discord's own raw OAuth user object (what identity_data
// actually holds) genuinely uses the field name "id" for the snowflake
// per Discord's API docs, not "provider_id"/"sub" (those aren't real
// Discord field names — kept only as a last-resort fallback in case
// Supabase normalizes the payload differently than expected). Never
// tested against a real live Discord link, so the warning below logs
// the raw shape if all of these come up empty, rather than failing
// silently with no way to diagnose it.
export async function syncDiscordLink() {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;

  const discordIdentity = data.identities.find((i) => i.provider === "discord");
  if (!discordIdentity) return; // not linked (yet, or unlinked) — nothing to sync

  const discordUserId =
    discordIdentity.id ||
    discordIdentity.identity_data?.id ||
    discordIdentity.identity_data?.provider_id ||
    discordIdentity.identity_data?.sub;
  if (!discordUserId) {
    console.warn(
      "Couldn't find a Discord user ID in the linked identity — raw identity for debugging:",
      discordIdentity
    );
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return;

  const { error: upsertError } = await supabase
    .from("discord_links")
    .upsert({ user_id: userId, discord_user_id: String(discordUserId), updated_at: new Date().toISOString() });
  if (upsertError) throw upsertError;
}

export async function removeDiscordLink(userId) {
  const { error } = await supabase.from("discord_links").delete().eq("user_id", userId);
  if (error) throw error;
}
