import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { site } from "@/lib/site-config";

const display = Bricolage_Grotesque({
  variable: "--ff-display",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

const label = Hanken_Grotesk({
  variable: "--ff-label",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const body = Hanken_Grotesk({
  variable: "--ff-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  icons: { icon: "/brand/badge.svg" },
  openGraph: {
    title: site.name,
    description: site.description,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${label.variable} ${body.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
