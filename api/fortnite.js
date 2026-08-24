// Vercel serverless function — proxies fortnite-api.com's shop
// endpoint. Their own docs show this being fetched directly from
// browser JS (suggesting they support CORS), but given CheapShark's
// docs said the same thing and turned out to be wrong when actually
// tested, this routes through our own proxy anyway to be safe and
// consistent with everything else in this project. No API key is
// required for the basic shop endpoint as of their current docs.

import { allowCors } from "./_cors.js";

const BASE_URL = "https://fortnite-api.com/v2/shop";

export default async function handler(req, res) {
  allowCors(res);
  try {
    const fnRes = await fetch(BASE_URL, {
      headers: {
        "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)",
        "Accept": "application/json",
      },
    });
    const data = await fnRes.json();

    if (!fnRes.ok) {
      console.error("fortnite proxy: upstream error", { status: fnRes.status, data });
      return res.status(fnRes.status).json({ error: "Fortnite API request failed", upstream: data });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("fortnite proxy: fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}
