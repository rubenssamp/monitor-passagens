import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monitor de Passagens",
  description: "Monitor de preços de passagens aéreas multi-rota",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <Link href="/" className="brand">
              ✈️ Monitor de Passagens
            </Link>
            <nav className="nav">
              <Link href="/">Visão geral</Link>
              <Link href="/routes">Rotas</Link>
              <Link href="/settings">Configurações</Link>
            </nav>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
