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

/** 报告上叠加的复习状态：已复习时间与已掌握的批注 id。 */
export interface ReportReview {
  reviewedAt?: string;
  mastered?: string[];
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
  tags?: string[];
  review?: ReportReview;
}

/**
 * 列表页/统计页用的报告投影：只带渲染与筛选需要的字段，
 * 不包含正文、段落改写、范文、建议与训练清单，避免每次翻档案都传输整篇作文。
 */
export interface ReportSummary {
  id: string;
  createdAt: string;
  meta: EssayMeta & { maxScore: number };
  score: {
    total: number;
    band: string;
  };
  stats: GradeResult["stats"];
  annotations: Annotation[];
  tags?: string[];
  review?: ReportReview;
}

/** PATCH /api/reports/[id] 的请求体：只允许改标签与复习状态。 */
export interface ReportPatch {
  tags?: string[];
  review?: {
    reviewed?: boolean;
    mastered?: string[];
  };
}

export interface ExplainRequest {
  text: string;
  quote: string;
  suggestion: string;
  explanation: string;
  category: ErrorCategory;
  question?: string;
}

export interface ExplainResult {
  answer: string;
  examples: string[];
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
