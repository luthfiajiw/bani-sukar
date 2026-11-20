import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bani Sukar — Silsilah Keluarga Trah Sukar & Sadirah",
  description:
    "Pohon silsilah keluarga besar Trah Bani Sukar & Sadirah secara interaktif, lengkap dengan profil anggota dan garis keturunan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
