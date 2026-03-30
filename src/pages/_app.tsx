import { useEffect } from "react";

export default function MyApp({ Component, pageProps }) {

  useEffect(() => {
  console.log("Trying to register SW...");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("✅ SW registered:", reg))
      .catch((err) => console.log("❌ SW failed:", err));
  } else {
    console.log("❌ Service Worker not supported");
  }
}, []);

  return <Component {...pageProps} />;
}
