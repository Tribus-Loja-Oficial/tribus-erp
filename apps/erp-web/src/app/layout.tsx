import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tribus ERP",
  description: "Sistema de gestão operacional da Tribus Antigravity",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
