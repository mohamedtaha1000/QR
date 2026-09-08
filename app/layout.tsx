import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STM QR Studio",
  description: "Bulk-generate vCard and ID QR codes from a staff sheet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded by the browser, not at build time — if the network blocks
            Google Fonts the fallback stack in globals.css takes over. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
