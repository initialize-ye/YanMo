export type ExamId = "english1" | "english2";
export type EssayKind = "letter" | "essay";
export type LevelId = "foundation" | "steady" | "advanced";

export type ErrorCategory =
  | "grammar"
  | "vocab"
  | "spelling"
  | "cohesion"
  | "logic"
  | "register"
  | "task";

export type Severity = "high" | "medium" | "low";
export type Impact = "high" | "medium" | "low";

export interface EssayMeta {
  exam: ExamId;
  kind: EssayKind;
  topicTitle: string;
  topicPrompt: string;
  targetScore: number;
  level: LevelId;
}

export interface DimensionScore {
  key: "task" | "accuracy" | "lexis" | "structure";
  name: string;
  score: number;
  comment: string;
}

export interface Annotation {
  id: string;
  quote: string;
  suggestion: string;
  category: ErrorCategory;
  severity: Severity;
  explanation: string;
}

export interface ParagraphRewrite {
  index: number;
  original: string;
  revised: string;
  note: string;
}

export interface Suggestion {
  title: string;
  why: string;
  action: string;
  impact: Impact;
}

export interface NextStep {
  title: string;
  detail: string;
  minutes: number;
}

export interface GradeResult {
  version: 1;
  id: string;
  createdAt: string;
  meta: EssayMeta & { maxScore: number };
  text: string;
  score: {
    total: number;
    band: string;
    predicted: [number, number];
    verdict: string;
    dimensions: DimensionScore[];
  };
  overview: {
    strengths: string[];
    weaknesses: string[];
  };
  annotations: Annotation[];
  rewrites: ParagraphRewrite[];
  modelEssay: { text: string; notes: string[] } | null;
  suggestions: Suggestion[];
  nextSteps: NextStep[];
  stats: {
    words: number;
    sentences: number;
    paragraphs: number;
  };
  source: "ai";
  model?: string;
}

export interface UserProfile {
  exam: ExamId;
  level: LevelId;
  targetScore: number;
  examDate: string;
}

/** 对外暴露的用户信息（不含密码哈希与会话），服务端与浏览器共用同一份定义。 */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AiConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiStatus {
  serverConfigured: boolean;
  model: string | null;
  source: "env" | "browser" | "none";
}

export interface OcrResult {
  text: string;
  confidence: number;
  warnings: string[];
  model?: string;
}

export interface TopicImageResult {
  title: string;
  prompt: string;
  kindHint: "essay" | "letter" | "unknown";
  confidence: number;
  warnings: string[];
  model?: string;
}

export interface HistoryInsight {
  total: number;
  recentScores: { score: number; max: number }[];
  topIssues: { category: ErrorCategory; count: number }[];
}

export interface GradeRequestBody {
  text: string;
  meta: EssayMeta;
  history?: HistoryInsight;
}

export interface TopicPreset {
  id: string;
  title: string;
  prompt: string;
}
