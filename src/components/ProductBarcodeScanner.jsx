// Real camera barcode decoding via the browser's native
// BarcodeDetector API — same mechanism as BookBarcodeScanner.jsx, but
// for general retail product barcodes (Pop Vinyl, LEGO, etc.) rather
// than ISBN-shaped EAN-13s specifically. Kept as a sibling component
// rather than adding a mode prop to BookBarcodeScanner — the ISBN
// 978/979-prefix filter genuinely doesn't belong in a generic-product
// scanner, and the two are small enough that branching one component
// on both is worse than two components sharing the same CSS classes.
//
// Always offers manual barcode entry alongside the scanner, same
// honest-fallback principle as the book scanner.

import { useEffect, useRef, useState } from "react";

export default function ProductBarcodeScanner({ onDetected, onManualEntry }) {
  const videoRef = useRef(null);
  const [supported] = useState(typeof window !== "undefined" && "BarcodeDetector" in window);
  const [status, setStatus] = useState("idle"); // idle | starting | scanning | error
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let rafId = null;
    let stream = null;
    let detector = null;

    async function start() {
      setStatus("starting");
      try {
        detector = new window.BarcodeDetector({ formats: ["ean_13", "upc_a"] });
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
        if (barcodes.length > 0) {
          onDetected(barcodes[0].rawValue);
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
  }, [supported, onDetected]);

  function handleManualSubmit(e) {
    e.preventDefault();
    const cleaned = manualValue.replace(/[^0-9]/g, "");
    if (cleaned.length >= 8) onManualEntry(cleaned);
  }

  return (
    <div className="barcode-scanner">
      {supported ? (
        <>
          <div className="barcode-scanner__frame">
            <video ref={videoRef} className="barcode-scanner__video" playsInline muted />
          </div>
          {status === "starting" && <p className="panel__status">Starting camera…</p>}
          {status === "scanning" && <p className="panel__status">Point your camera at the product's barcode.</p>}
          {status === "error" && (
            <p className="panel__status panel__status--error">Couldn't access your camera — enter the barcode manually below.</p>
          )}
        </>
      ) : (
        <p className="panel__status">
          Camera barcode scanning isn't supported in this browser — enter the barcode manually below.
        </p>
      )}

      <form className="price-search" onSubmit={handleManualSubmit}>
        <input
          className="price-search__input"
          type="text"
          placeholder="Or type the barcode…"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
        />
        <button type="submit" className="price-search__button">Look up</button>
      </form>
    </div>
  );
}
