import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali, Noto_Serif_Bengali, Playfair_Display } from "next/font/google";
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

// Readable sans for dense work screens (DLO review): --font-sans in tokens.css
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bengaliSans = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "সাক্ষ্য · Verified Legal Aid Operations",
  description:
    "An evidence-grounded operational layer for Bangladesh legal aid services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className={`${playfair.variable} ${bengali.variable} ${inter.variable} ${bengaliSans.variable}`}>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}