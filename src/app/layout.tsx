import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { site, testimonials } from "@/lib/site-config";

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

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || site.url;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  alternates: { canonical: "/" },
  icons: { icon: "/brand/badge.svg", apple: "/brand/badge.svg" },
  openGraph: {
    title: site.name,
    description: site.description,
    url: baseUrl,
    siteName: site.name,
    locale: "en_US",
    type: "website",
    images: [{ url: "/brand/logo.png", width: 610, height: 409, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
    images: ["/brand/logo.png"],
  },
};

/** LocalBusiness structured data — helps Google show rich local results. */
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: site.name,
  description: site.description,
  url: baseUrl,
  telephone: site.phoneE164,
  email: site.email,
  image: `${baseUrl}/brand/logo.png`,
  priceRange: "$$",
  areaServed: site.serviceArea.nearby.map((city) => ({
    "@type": "City",
    name: city,
  })),
  address: {
    "@type": "PostalAddress",
    addressLocality: site.serviceArea.primaryCity,
    addressRegion: "CA",
    addressCountry: "US",
  },
  geo: { "@type": "GeoCoordinates", latitude: 34.5008, longitude: -117.1858 },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    bestRating: "5",
    reviewCount: testimonials.length,
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
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
