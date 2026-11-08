import type { Metadata, Viewport } from "next";
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
  authors: [{ name: "研墨 AI" }]
};

export const viewport: Viewport = {
  themeColor: "#f8f9fa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
