// Shared by the build script and every source adapter — a real,
// descriptive User-Agent (Scryfall's own API guidelines ask for one;
// good practice for the others regardless) plus retry-with-backoff on
// transient failures, so one upstream blip over a multi-hour run
// doesn't crash the whole index build.

export const USER_AGENT_HEADERS = {
  "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app; card-scanner index builder)",
  Accept: "application/json",
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export async function fetchWithRetry(url, options, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      if (attempt === attempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    if (res.ok) return res;
    if (!RETRYABLE_STATUS.has(res.status) || attempt === attempts) {
      throw new Error(`fetch failed: ${res.status} for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}
