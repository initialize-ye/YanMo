export interface AiPreset {
  id: string;
  name: string;
  vendor: string;
  baseUrl: string;
  model: string;
  vision: boolean;
  note: string;
}

/**
 * 现在只支持自定义 OpenAI 兼容接口。
 * 保留这层结构是为了兼容旧的 localStorage 配置与预设字段。
 */
const CUSTOM_PRESET: AiPreset = {
  id: "custom",
  name: "自定义接口",
  vendor: "OpenAI 兼容",
  baseUrl: "",
  model: "",
  vision: true,
  note: "填写任意兼容 /chat/completions 的服务地址、模型名称与 API Key。"
};

export const AI_PRESETS: AiPreset[] = [CUSTOM_PRESET];

export const DEFAULT_PRESET_ID = "custom";

export function getPreset(_id: string): AiPreset {
  return CUSTOM_PRESET;
}
