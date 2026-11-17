"use client";

import { useEffect } from "react";

/**
 * 会话过期（任意接口返回 401）时统一跳回登录页，并带上当前路径。
 * 这样报告页/设置页等页面不必各自处理 401，也不会把「登录过期」显示成「数据丢了」。
 */
export function SessionGuard() {
  useEffect(() => {
    let redirecting = false;
    const onUnauthorized = () => {
      if (redirecting) return;
      if (window.location.pathname.startsWith("/login")) return;
      redirecting = true;
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    };
    window.addEventListener("yanmo:unauthorized", onUnauthorized);
    return () => window.removeEventListener("yanmo:unauthorized", onUnauthorized);
  }, []);

  return null;
}
