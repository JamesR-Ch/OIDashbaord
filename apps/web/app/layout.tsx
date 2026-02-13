import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OIDashboard",
  description: "Gold, FX, BTC relations and CME OI/Intraday intelligence",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
