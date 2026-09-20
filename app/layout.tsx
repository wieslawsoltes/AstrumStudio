import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astrum Studio",
  description: "3D modeling, procedural motion design, animation and rendering.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
