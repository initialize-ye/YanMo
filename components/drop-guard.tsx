"use client";

import { useEffect } from "react";

/**
 * 把文件拖到上传框以外的地方时，浏览器会直接打开该文件。
 * 这里统一拦下，交给页面上真正处理的拖拽区域。
 */
export function DropGuard() {
  useEffect(() => {
    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const prevent = (event: DragEvent) => {
      if (isFileDrag(event)) event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  return null;
}
