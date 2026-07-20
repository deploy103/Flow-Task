import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Flow Task", short_name: "Flow Task", description: "동아리와 팀의 과제·퀴즈 관리", start_url: "/dashboard", display: "standalone", background_color: "#f8fafc", theme_color: "#4f46e5", lang: "ko", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] }; }
