import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PersonalWish — I tuoi desideri, condivisi a modo tuo",
  description: "Crea liste dei desideri e condividile con chi vuoi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}
