// Real user-owned comic issue library. No external comics catalogue
// API is wired yet — Comic Vine's real response shape couldn't be
// verified live (see schema.sql's comic_issues comment) — so this is
// honestly manual-entry-only for now, same as Collectibles' Phase 1
// before Rebrickable/Discogs/IGDB got added.

import { supabase } from "./supabaseClient";

export async function fetchComicIssues(userId) {
  const { data, error } = await supabase
    .from("comic_issues")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addComicIssue(userId, issue) {
  const { data, error } = await supabase
    .from("comic_issues")
    .insert({ user_id: userId, ...issue })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateComicIssue(issueId, patch) {
  const { error } = await supabase
    .from("comic_issues")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", issueId);
  if (error) throw error;
}

export async function removeComicIssue(issueId) {
  const { error } = await supabase.from("comic_issues").delete().eq("id", issueId);
  if (error) throw error;
}

// Cover upload — same real Supabase Storage pattern as avatars/mtg
// covers, against the shared "entertainment-covers" bucket.
export async function uploadEntertainmentCover(userId, file) {
  const nameExt = file.name.includes(".") ? file.name.split(".").pop() : "";
  const mimeExt = file.type?.split("/")?.[1];
  const ext = (nameExt || mimeExt || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("entertainment-covers")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("entertainment-covers").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
