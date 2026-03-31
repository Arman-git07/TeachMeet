"use client";
import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js") // ✅ IMPORTANT: correct file
        .then((reg) => {
          console.log("✅ Service Worker Registered", reg);
        })
        .catch((err) => {
          console.error("❌ Service Worker Error", err);
        });
    }
  }, []);

  return null;
}
