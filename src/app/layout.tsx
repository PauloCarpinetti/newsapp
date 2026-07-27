import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "AI Digest Aggregator",
  description: "Uma base inicial para o AI Digest Aggregator.",
};

// Every route depends on client-side Firebase auth state via AuthProvider,
// so static prerendering would evaluate Firebase init without real env vars.
export const dynamic = "force-dynamic";

// Mirrors src/lib/utils/theme.ts's resolveInitialTheme in plain JS: a blocking
// script can't import a bundled module, but must run before hydration to avoid
// a flash of the wrong theme.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AuthProvider>
          <ThemeToggle />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
