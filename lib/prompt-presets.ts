export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  instructions: string;
  builtin: boolean;
}

/**
 * 内置批改风格。instructions 会追加到基础提示词之后，
 * 但不会改变 JSON 结构、分数范围与批注字段。
 */
export const BUILTIN_PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "standard",
    name: "标准阅卷",
    description: "平衡语言、内容与结构，按考研阅卷标准给出完整诊断。",
    instructions: "",
    builtin: true
  },
  {
    id: "language",
    name: "语法优先",
    description: "逐句扫描语法、拼写、用词与搭配，尽可能列出全部确定错误。",
    instructions:
      "本次任务以语法、拼写、用词和搭配错误为最高优先级。请逐句扫描并列出所有确定的语言错误，annotations 允许 10—20 条，不要为了凑数编造；结构、逻辑和语域建议最多保留 2 条。每条 explanation 直接点出语法点或搭配，不要展开成长篇讲解。",
    builtin: true
  },
  {
    id: "concise",
    name: "简洁高效",
    description: "更少批注、更短解释，适合快速过一遍或复盘高频错误。",
    instructions:
      "本次输出必须短：annotations 控制在 4—8 条，只保留最影响分数的语言错误；rewrites 最多 1 段；modelEssay 设为 null；suggestions 1—2 条；nextSteps 1—2 条；每条 explanation 不超过 40 字。仍然必须遵守 JSON 字段与分数范围。",
    builtin: true
  },
  {
    id: "strict",
    name: "严格阅卷",
    description: "严格扣分，不因水平或目标分抬分，适合冲刺阶段自测。",
    instructions:
      "本次按官方评分标准严格执行，不因学生水平、目标分或鼓励性表达抬分。每个维度的 comment 必须指出具体扣分依据；总分必须与错误密度和内容完整度一致。先列扣分点，再给一条最值得改的动作。",
    builtin: true
  }
];

export const DEFAULT_PROMPT_PRESET_ID = "standard";

export function getBuiltinPromptPreset(id: string | undefined | null): PromptPreset | undefined {
  if (!id) return undefined;
  return BUILTIN_PROMPT_PRESETS.find((preset) => preset.id === id);
}
