import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "研墨 AI · 考研英语手写作文批改",
    short_name: "研墨 AI",
    description:
      "上传手写英语作文或粘贴文字稿，按考研英语一、英语二标准逐句批改，标出错误并给出练习建议。",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f9fa",
    theme_color: "#1a73e8",
    lang: "zh-CN",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
