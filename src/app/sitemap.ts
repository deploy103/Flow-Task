import type { MetadataRoute } from "next";
import { PUBLIC_APP_ORIGIN } from "@/features/marketing/content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: PUBLIC_APP_ORIGIN, changeFrequency: "weekly", priority: 1 },
    { url: `${PUBLIC_APP_ORIGIN}/login`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${PUBLIC_APP_ORIGIN}/signup`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${PUBLIC_APP_ORIGIN}/privacy`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
