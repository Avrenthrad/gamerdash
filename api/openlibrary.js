// Vercel serverless function — proxies Open Library's real, official
// book search API (run by the Internet Archive). Free, no API key
// needed at all.
//
// Confirmed real field names (docs[].key, title, author_name, cover_i,
// first_publish_year) directly against real response examples, not
// guessed from memory.
//
// Rate limit confirmed directly from Open Library's own docs: 1 req/sec
// for unidentified requests, 3 req/sec with a real identifying
// User-Agent header — set below, genuinely worth the 3x. Also using
// their documented `fields` parameter to request only what's needed,
// per their own performance guidance (unscoped requests can return up
// to 500kb and contribute to server-side errors on their end).

const BASE_URL = "https://openlibrary.org";
const USER_AGENT = "Lykodex/1.0 (contact: support@lykodex.app)";

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });

      const fields = "key,title,author_name,cover_i,first_publish_year";
      const olRes = await fetch(
        `${BASE_URL}/search.json?q=${encodeURIComponent(q)}&fields=${fields}&limit=12`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      const data = await olRes.json();
      return res.status(200).json({ results: data.docs || [] });
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("openlibrary proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
