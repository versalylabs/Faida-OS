import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from "next/font/google";
import { preload } from "react-dom";
import "./globals.css";

import { AppShell } from "@/components/layout/AppShell";

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05070f",
};

export const metadata: Metadata = {
  title: "Faida OS — Personal Operating System",
  description: "Personal second brain, execution engine, and digital assistant.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Faida OS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Start fetching the backdrop with the HTML so it is already there when the page paints
  preload("/bg/scene.webp", { as: "image" });

  return (
    <html lang="en" className={`dark ${uiFont.variable} ${displayFont.variable}`}>
      <body className="text-slate-100 flex min-h-screen antialiased">
        <div className="scene" aria-hidden="true">
          <div className="scene-grade" />
        </div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
