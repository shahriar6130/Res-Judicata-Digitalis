import type { Metadata } from "next";
import { Playfair_Display, Noto_Serif_Bengali } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const bengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shakkho · Verified Legal Aid Operations",
  description:
    "An evidence-grounded operational layer for Bangladesh legal aid services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className={`${playfair.variable} ${bengali.variable}`}>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
