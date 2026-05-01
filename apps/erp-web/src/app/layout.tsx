import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tribus ERP",
  description: "Plataforma operacional de gestão da Tribus",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
