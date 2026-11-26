import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyPersonalWish — Crea, condividi e realizza i tuoi desideri",
  description: "Crea, condividi e realizza le tue liste dei desideri con amici e familiari.",
  icons: { icon: "/mypersonalwish-logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}
