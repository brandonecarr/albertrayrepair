import type { MetadataRoute } from "next";
import { site } from "@/lib/site-config";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || site.url;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
