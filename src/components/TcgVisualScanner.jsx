// Real-time visual card recognition — point the camera at a card and
// it's identified in place, no manual capture step. This is the
// actual ManaBox-style experience: a continuous camera loop hashing
// frames against a pre-built perceptual-hash index (see
// scripts/build-tcg-hash-index.mjs and lib/tcgVisualMatch.js), not
// OCR-then-search. Works identically on mobile browsers/apps and
// desktop webcams — both are just getUserMedia, no platform branch
// needed for this one.
//
// The on-screen guide rectangle exists because this hashes only the
// region inside it, not the whole frame — a live frame includes
// background, hands, table; cropping first is what keeps the hash
// meaningful instead of drowning the card in noise. No actual edge/
// boundary detection (that's a much bigger CV project) — the person
// aligns the card to the guide themselves, same as most real-world
// document/card scanners that don't do full boundary detection.
//
// A match only surfaces after CONFIRM_STREAK consecutive checks agree
// on the same top card — a single low-distance frame can be a fluke
// (motion blur landing near some unrelated card by chance); several
// in a row landing on the same card is real confidence.

import { useEffect, useRef, useState } from "react";
import { hashFromCanvasSource } from "../lib/imageHashBrowser";
import { loadTcgIndex, findBestMatches } from "../lib/tcgVisualMatch";

const CHECK_INTERVAL_MS = 350;
const CONFIRM_STREAK = 3;
const MAX_MATCH_DISTANCE = 16;
// Card aspect ratio (63mm x 88mm, real physical MTG/Pokémon/FAB card
// stock — all three games use this same standard size) — the guide
// rectangle is sized to it so alignment actually means something.
const CARD_ASPECT = 63 / 88;

export default function TcgVisualScanner({ game, onMatch, onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading-index"); // loading-index | starting | scanning | error
  const [errorMessage, setErrorMessage] = useState("");
  const streakRef = useRef({ id: null, count: 0 });

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    let intervalId = null;
    let index = null;

    async function start() {
      try {
        index = await loadTcgIndex(game);
      } catch (err) {
        console.error("Failed to load card index:", err);
        if (!cancelled) {
          setErrorMessage("Couldn't load the card index — check your connection and try again.");
          setStatus("error");
        }
        return;
      }
      if (cancelled) return;

      setStatus("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
      } catch (err) {
        console.error("Failed to start camera:", err);
        if (!cancelled) {
          setErrorMessage("Couldn't access your camera.");
          setStatus("error");
        }
        return;
      }

      intervalId = setInterval(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container || !video.videoWidth) return;

        // Map the on-screen guide rectangle (a fixed fraction of the
        // preview box) back to real video-pixel coordinates — the
        // preview element and the underlying video frame are rarely
        // the same size.
        const guideWidthFrac = 0.6;
        const guideHeightFrac = guideWidthFrac / CARD_ASPECT * (container.clientWidth / container.clientHeight);
        const sWidth = video.videoWidth * guideWidthFrac;
        const sHeight = video.videoHeight * Math.min(guideHeightFrac, 0.85);
        const sx = (video.videoWidth - sWidth) / 2;
        const sy = (video.videoHeight - sHeight) / 2;

        const hash = hashFromCanvasSource(video, { sx, sy, sWidth, sHeight });
        const matches = findBestMatches(index, hash, { limit: 1, maxDistance: MAX_MATCH_DISTANCE });
        const top = matches[0];

        if (!top) {
          streakRef.current = { id: null, count: 0 };
          return;
        }
        if (streakRef.current.id === top.id) {
          streakRef.current.count += 1;
        } else {
          streakRef.current = { id: top.id, count: 1 };
        }

        if (streakRef.current.count >= CONFIRM_STREAK) {
          streakRef.current = { id: null, count: 0 };
          onMatch(top);
        }
      }, CHECK_INTERVAL_MS);
    }

    start();
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  return (
    <div className="tcg-visual-scanner">
      <div className="tcg-visual-scanner__frame" ref={containerRef}>
        <video ref={videoRef} className="tcg-visual-scanner__video" playsInline muted />
        <div className="tcg-visual-scanner__guide" style={{ aspectRatio: CARD_ASPECT }} />
      </div>

      {status === "loading-index" && <p className="panel__status">Loading the card index…</p>}
      {status === "starting" && <p className="panel__status">Starting camera…</p>}
      {status === "scanning" && <p className="panel__status">Align a card in the frame — it'll be recognized automatically.</p>}
      {status === "error" && <p className="panel__status panel__status--error">{errorMessage}</p>}

      <button type="button" className="quickdash-reset-btn" onClick={onClose}>Cancel</button>
    </div>
  );
}
