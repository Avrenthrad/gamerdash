// Vercel serverless function — proxies UPCitemdb's real public UPC/EAN
// barcode database (upcitemdb.com). Used by the Collectibles barcode
// scanner to identify a scanned Pop Vinyl/Lego box/other product —
// generic retail data, not brand-specific, so it's the one integration
// that covers all of them.
//
// Free trial tier is keyless (confirmed live: api.upcitemdb.com/prod/
// trial/lookup, no signup) — 100 lookups/day, shared across every
// Lykodex user since this proxy calls it from the server, not the
// browser. That's real but genuinely small for a live multi-user app.
// If UPC_LOOKUP_KEY is set (a paid UPCitemdb plan), this switches to
// their authenticated /prod/v1/lookup endpoint for a real per-account
// quota instead — see .env.example.
//
// Usage from the frontend:
//   fetch("/api/upc?barcode=012345678905")

const TRIAL_URL = "https://api.upcitemdb.com/prod/trial/lookup";
const V1_URL = "https://api.upcitemdb.com/prod/v1/lookup";

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const barcode = searchParams.get("barcode");
  if (!barcode) {
    return res.status(400).json({ error: "Missing barcode query parameter" });
  }

  const apiKey = process.env.UPC_LOOKUP_KEY;

  try {
    const upcRes = apiKey
      ? await fetch(`${V1_URL}?upc=${encodeURIComponent(barcode)}`, {
          headers: { user_key: apiKey, key_type: "3scale" },
        })
      : await fetch(`${TRIAL_URL}?upc=${encodeURIComponent(barcode)}`);

    if (!upcRes.ok) {
      return res.status(upcRes.status).json({ error: "UPC lookup failed" });
    }
    const data = await upcRes.json();
    return res.status(200).json(data); // { items: [{ ean, title, brand, images, ... }], ... }
  } catch (err) {
    console.error("upc proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
