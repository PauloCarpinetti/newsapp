import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "AI Digest Aggregator",
  description: "Uma base inicial para o AI Digest Aggregator.",
};

// Every route depends on client-side Firebase auth state via AuthProvider,
// so static prerendering would evaluate Firebase init without real env vars.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
