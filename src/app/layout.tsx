import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Digest Aggregator",
  description: "Uma base inicial para o AI Digest Aggregator.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
