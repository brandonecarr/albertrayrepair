import type { MetadataRoute } from "next";
import { site } from "@/lib/site-config";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || site.url;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
