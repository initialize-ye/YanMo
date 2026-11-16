import type { Metadata, Viewport } from "next";
import { DropGuard } from "@/components/drop-guard";
import { PWARegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "研墨 AI · 考研英语手写作文批改",
    template: "%s · 研墨 AI"
  },
  description:
    "上传手写英语作文或粘贴文字稿，按考研英语一、英语二标准逐句批改，标出错误并给出练习建议。",
  keywords: ["考研英语", "英语作文批改", "手写识别", "AI 批改", "英语写作"],
  applicationName: "研墨 AI",
  authors: [{ name: "研墨 AI" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "研墨 AI",
    statusBarStyle: "default"
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: "#f8f9fa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <DropGuard />
        <PWARegister />
      </body>
    </html>
  );
}
