// Desktop-oriented capture option for the MTG card scanner — a live
// webcam preview with a manual "Capture" shutter, not continuous
// auto-detect like BookBarcodeScanner's barcode loop. A barcode is a
// clean structured target worth scanning frame-by-frame; a card needs
// the person to actually frame it well first, so a deliberate shutter
// click (grabbing one canvas snapshot from the live video) is the
// honest fit here, not a false "auto-detected!" moment.

import { useEffect, useRef, useState } from "react";

export default function MtgCardWebcamCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | ready | error

  useEffect(() => {
    let cancelled = false;
    let stream = null;

    async function start() {
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
        setStatus("ready");
      } catch (err) {
        console.error("Failed to start webcam:", err);
        if (!cancelled) setStatus("error");
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div className="barcode-scanner">
      <div className="barcode-scanner__frame">
        <video ref={videoRef} className="barcode-scanner__video" playsInline muted />
      </div>
      {status === "starting" && <p className="panel__status">Starting camera…</p>}
      {status === "error" && (
        <p className="panel__status panel__status--error">Couldn't access your camera — try uploading a photo instead.</p>
      )}
      <div className="backlog-add">
        <button type="button" className="linking-row__connect" onClick={handleCapture} disabled={status !== "ready"}>
          Capture
        </button>
        <button type="button" className="quickdash-reset-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
