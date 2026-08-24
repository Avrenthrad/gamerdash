// Your own celebratory milestones — the ONLY kind of activity someone
// should ever see notified about their own account (see
// CELEBRATORY_EVENT_TYPES in lib/guilds.js). Deliberately sourced from
// game_completions/backlog_completions directly, not guild_activity —
// those two tables are guild-independent (a person with zero guilds
// still gets their own achievements recorded there), while
// guild_activity's write path only fans out to guilds someone's
// actually in. Sourcing from here means your own celebrations show up
// regardless of guild membership, exactly as they should.
import { supabase } from "./supabaseClient";

export async function fetchMyCelebrations(userId, limit = 10) {
  const [gameCompletions, backlogCompletions] = await Promise.all([
    supabase
      .from("game_completions")
      .select("id, game_name, appid, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(limit),
    supabase
      .from("backlog_completions")
      .select("id, title, backlog_item_id, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(limit),
  ]);
  if (gameCompletions.error) throw gameCompletions.error;
  if (backlogCompletions.error) throw backlogCompletions.error;

  const merged = [
    ...(gameCompletions.data || []).map((row) => ({
      id: `game-${row.id}`,
      type: "game_completed",
      title: row.game_name,
      completedAt: row.completed_at,
    })),
    ...(backlogCompletions.data || []).map((row) => ({
      id: `backlog-${row.id}`,
      type: "backlog_completed",
      title: row.title,
      completedAt: row.completed_at,
    })),
  ];

  merged.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return merged.slice(0, limit);
}
