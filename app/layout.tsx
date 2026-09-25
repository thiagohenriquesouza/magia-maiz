import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magia — Sua carta de hoje",
  description: "Transforme a sua intenção de atendimento em uma carta única."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
