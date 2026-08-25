// Real camera barcode decoding via ZXing (@zxing/browser) — a pure
// JS/canvas decoder, not the browser's native BarcodeDetector (Shape
// Detection API). Switched away from BarcodeDetector because its
// support is genuinely inconsistent across Android WebViews: the
// constructor can exist (so a feature-check passes) while the
// underlying on-device ML model is missing, so detect() just never
// finds anything — the camera runs, "point your camera" shows
// forever, and nothing is ever detected. ZXing decodes frames itself,
// so it works the same way on every platform this app ships to.
//
// ISBN-13 barcodes are encoded as real EAN-13 barcodes with a 978/979
// prefix — detecting that format and filtering to ISBN-shaped values
// is the correct, real approach, not OCR.
//
// Always offers manual ISBN entry alongside the scanner, per the
// honest-fallback principle — a denied camera permission or a
// bad-lighting scan both fall back to the same manual path rather
// than dead-ending.

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

const ISBN_PATTERN = /^97[89]\d{10}$/;

export default function BookBarcodeScanner({ onDetected, onManualEntry }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | error
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
    let cancelled = false;
    let controls = null;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
    const reader = new BrowserMultiFormatReader(hints);

    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current, (result) => {
        // Called on every scan attempt, successful or not — result is
        // undefined on the (very common) "no barcode in this frame"
        // case, which isn't an error, same as the old implementation.
        if (cancelled || !result) return;
        const value = result.getText();
        // Real ISBN-13 values always start with 978 or 979 — filters
        // out any other EAN-13 product barcode that isn't a book.
        if (!ISBN_PATTERN.test(value)) return;
        onDetectedRef.current(value);
        controls?.stop();
      })
      .then((c) => {
        if (cancelled) {
          c.stop();
          return;
        }
        controls = c;
        setStatus("scanning");
      })
      .catch((err) => {
        console.error("Failed to start barcode scanner:", err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  function handleManualSubmit(e) {
    e.preventDefault();
    const cleaned = manualValue.replace(/[^0-9Xx]/g, "");
    if (cleaned.length >= 10) onManualEntry(cleaned);
  }

  return (
    <div className="barcode-scanner">
      <div className="barcode-scanner__frame">
        <video ref={videoRef} className="barcode-scanner__video" playsInline muted />
      </div>
      {status === "starting" && <p className="panel__status">Starting camera…</p>}
      {status === "scanning" && <p className="panel__status">Point your camera at a book's barcode.</p>}
      {status === "error" && (
        <p className="panel__status panel__status--error">Couldn't access your camera — enter the ISBN manually below.</p>
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
