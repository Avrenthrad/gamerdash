// Real camera barcode decoding via the browser's native
// BarcodeDetector API (Shape Detection API — ships in Chrome/Edge/
// most Android browsers; not in Safari/Firefox as of this writing).
// ISBN-13 barcodes are encoded as real EAN-13 barcodes with a 978/979
// prefix — detecting that format and filtering to ISBN-shaped values
// is the correct, real approach, not OCR.
//
// Always offers manual ISBN entry alongside the scanner, per the
// honest-fallback principle — a browser without BarcodeDetector, a
// denied camera permission, or a bad-lighting scan all fall back to
// the same manual path rather than dead-ending.

import { useEffect, useRef, useState } from "react";

export default function BookBarcodeScanner({ onDetected, onManualEntry }) {
  const videoRef = useRef(null);
  const [supported] = useState(typeof window !== "undefined" && "BarcodeDetector" in window);
  const [status, setStatus] = useState("idle"); // idle | starting | scanning | error
  const [manualValue, setManualValue] = useState("");
  // Holds the latest onDetected without it being a dependency of the
  // camera-setup effect below — the parent passes a new function
  // identity on every render, and re-running that effect on every
  // render would tear down and restart the live camera stream.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let rafId = null;
    let stream = null;
    let detector = null;

    async function start() {
      setStatus("starting");
      try {
        detector = new window.BarcodeDetector({ formats: ["ean_13"] });
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
        scanLoop();
      } catch (err) {
        console.error("Failed to start barcode scanner:", err);
        if (!cancelled) setStatus("error");
      }
    }

    async function scanLoop() {
      if (cancelled || !videoRef.current) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        // Real ISBN-13 values always start with 978 or 979 — filters
        // out any other EAN-13 product barcode that isn't a book.
        const isbnMatch = barcodes.find((b) => /^97[89]\d{10}$/.test(b.rawValue));
        if (isbnMatch) {
          onDetectedRef.current(isbnMatch.rawValue);
          return;
        }
      } catch {
        // Transient "no barcode in this frame" — normal, not an error.
      }
      rafId = requestAnimationFrame(scanLoop);
    }

    start();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [supported]);

  function handleManualSubmit(e) {
    e.preventDefault();
    const cleaned = manualValue.replace(/[^0-9Xx]/g, "");
    if (cleaned.length >= 10) onManualEntry(cleaned);
  }

  return (
    <div className="barcode-scanner">
      {supported ? (
        <>
          <div className="barcode-scanner__frame">
            <video ref={videoRef} className="barcode-scanner__video" playsInline muted />
          </div>
          {status === "starting" && <p className="panel__status">Starting camera…</p>}
          {status === "scanning" && <p className="panel__status">Point your camera at a book's barcode.</p>}
          {status === "error" && (
            <p className="panel__status panel__status--error">Couldn't access your camera — enter the ISBN manually below.</p>
          )}
        </>
      ) : (
        <p className="panel__status">
          Camera barcode scanning isn't supported in this browser — enter the ISBN manually below.
        </p>
      )}

      <form className="price-search" onSubmit={handleManualSubmit}>
        <input
          className="price-search__input"
          type="text"
          placeholder="Or type the ISBN (10 or 13 digits)…"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
        />
        <button type="submit" className="price-search__button">Look up</button>
      </form>
    </div>
  );
}
