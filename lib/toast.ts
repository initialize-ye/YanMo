export type ToastType = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  message: string;
  type?: ToastType;
  action?: ToastAction;
  duration?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
  duration: number;
}

const TOAST_EVENT = "yanmo:toast";

/** 全局通知：任何客户端组件都可以调用，实际渲染由 components/toaster.tsx 负责。 */
export function notify(input: ToastInput): string {
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const item: ToastItem = {
    id,
    message: input.message,
    type: input.type ?? "info",
    action: input.action,
    duration: input.duration ?? (input.type === "error" ? 9000 : 5000)
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail: item }));
  }
  return id;
}

export function onToast(handler: (item: ToastItem) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<ToastItem>).detail);
  };
  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
}

export const toast = {
  success: (message: string, action?: ToastAction) =>
    notify({ type: "success", message, action }),
  error: (message: string, action?: ToastAction) => notify({ type: "error", message, action }),
  info: (message: string, action?: ToastAction) => notify({ type: "info", message, action })
};
