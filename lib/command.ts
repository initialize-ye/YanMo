export type CommandGroup = "跳转" | "操作" | "报告";

export interface CommandItem {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  /** 执行动作；返回 true 表示已处理（面板会自动关闭）。 */
  run: () => void | Promise<void>;
}

export interface StaticCommand {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  href?: string;
}

/** 命令面板里的固定项（页面跳转 + 常用操作）。 */
export const STATIC_COMMANDS: StaticCommand[] = [
  { id: "nav-grade", group: "跳转", label: "批改台", hint: "上传作文并批改", href: "/grade" },
  { id: "nav-mistakes", group: "跳转", label: "错题本", hint: "汇总历次错误", href: "/mistakes" },
  { id: "nav-history", group: "跳转", label: "写作档案", hint: "分数趋势与记录", href: "/history" },
  { id: "nav-settings", group: "跳转", label: "设置", hint: "AI 接入与个人水平", href: "/settings" },
  { id: "nav-account", group: "跳转", label: "账号设置", hint: "密码与登录设备", href: "/account" },
  { id: "act-grade", group: "操作", label: "新建批改", hint: "开始一篇新的作文", href: "/grade" },
  { id: "act-import", group: "操作", label: "导入备份", hint: "从 JSON 恢复写作档案", href: "/history?import=1" },
  { id: "act-export", group: "操作", label: "导出备份", hint: "下载全部报告为 JSON", href: "/history?export=1" }
];
