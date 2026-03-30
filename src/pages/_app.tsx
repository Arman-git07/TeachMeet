import { useEffect } from "react";

export default function MyApp({ Component, pageProps }) {

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("SW registered:", reg))
        .catch((err) => console.log("SW failed:", err));
    }
  }, []);

  return <Component {...pageProps} />;
}
