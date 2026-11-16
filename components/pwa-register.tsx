"use client";

import { useEffect } from "react";

/** 只在生产环境注册 Service Worker，避免开发时缓存旧静态资源。 */
export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 开发环境：注销可能残留的 Service Worker 并清空其缓存。
    // 生产 SW 会缓存 /_next/static/（cache-first），而 dev 下的 chunk 路径都不带 hash，
    // 一旦同一个 origin 先跑过生产包，残留 SW 就会把旧 chunk 回给 dev 页面，
    // 造成「服务端新 / 客户端旧」的 hydration 不一致（典型报错：text node 不匹配）。
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);
      if (typeof caches !== "undefined") {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      }
      return;
    }

    const register = () => {
      // updateViaCache: "none" 让浏览器每次都绕过 HTTP 缓存检查 sw.js 是否有更新，避免旧 Service Worker 长期滞留。
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // 注册失败不影响网页正常使用
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
