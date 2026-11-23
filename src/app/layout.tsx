import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MX RIVALS — Creado por Ever Baruc",
  description: "Shooter competitivo por equipos en primera persona ambientado en México. Creado por: Ever Baruc.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
