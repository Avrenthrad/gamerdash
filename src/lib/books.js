// Real, user-owned book tracking: TBR / reading / finished / owned,
// plus named custom lists. Distinct from lib/entertainment.js's
// simple want/watching/completed tracking — this is the barcode-scan
// -> TBR/owned/list flow specifically (see schema.sql for why these
// are separate tables).

import { supabase } from "./supabaseClient";

export async function fetchUserBooks(userId) {
  const { data, error } = await supabase
    .from("user_books")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addUserBook(userId, book, { status = "tbr", source = "manual" } = {}) {
  const { data, error } = await supabase
    .from("user_books")
    .insert({
      user_id: userId,
      isbn: book.isbn || null,
      title: book.title,
      author: book.author || null,
      cover_url: book.coverUrl || null,
      status,
      source,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUserBook(bookId, patch) {
  const { error } = await supabase
    .from("user_books")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", bookId);
  if (error) throw error;
}

export async function removeUserBook(bookId) {
  const { error } = await supabase.from("user_books").delete().eq("id", bookId);
  if (error) throw error;
}

// ---------- Named lists ----------

export async function fetchBookLists(userId) {
  const { data, error } = await supabase
    .from("book_lists")
    .select("*, book_list_items(id, book_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBookList(userId, name) {
  const { data, error } = await supabase
    .from("book_lists")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBookList(listId) {
  const { error } = await supabase.from("book_lists").delete().eq("id", listId);
  if (error) throw error;
}

export async function addBookToList(listId, bookId) {
  const { error } = await supabase
    .from("book_list_items")
    .insert({ list_id: listId, book_id: bookId })
    .select()
    .maybeSingle();
  // A duplicate (already on this list) isn't a real error — the
  // unique constraint just means nothing to do.
  if (error && error.code !== "23505") throw error;
}

export async function removeBookFromList(listId, bookId) {
  const { error } = await supabase
    .from("book_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("book_id", bookId);
  if (error) throw error;
}
