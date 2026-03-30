import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0f172a" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="shortcut icon" href="/favicon.ico" />
</Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
