import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
  {/* Minimal global stable meta; page-specific OG/Twitter via NextSeo */}
  <meta property="og:site_name" content="sumbersuryastore" />
        <meta property="og:locale" content="id_ID" />
  <meta name="twitter:site" content="@sumbersuryastore" />
        <meta name="theme-color" content="#b91c1c" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
