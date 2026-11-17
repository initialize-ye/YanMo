import type {
  ErrorCategory,
  EssayKind,
  EssayMeta,
  ExamId,
  Impact,
  LevelId,
  Severity,
  TopicPreset,
  UserProfile
} from "./types";

export const EXAMS: { id: ExamId; label: string; short: string; note: string }[] = [
  { id: "english1", label: "英语一", short: "英一", note: "图画 / 书信 · 阅读要求更高" },
  { id: "english2", label: "英语二", short: "英二", note: "图表 / 书信 · 表达重准确" }
];

export const KINDS: { id: EssayKind; label: string; sub: string }[] = [
  { id: "essay", label: "大作文", sub: "短文写作" },
  { id: "letter", label: "小作文", sub: "应用文写作" }
];

export const LEVELS: { id: LevelId; label: string; desc: string }[] = [
  { id: "foundation", label: "基础起步", desc: "句子常出错，先求写对" },
  { id: "steady", label: "稳定及格", desc: "结构清楚，想稳定上分" },
  { id: "advanced", label: "冲击高分", desc: "表达流畅，想拉开差距" }
];

export const DIMENSION_ORDER = ["task", "accuracy", "lexis", "structure"] as const;

export const DIMENSION_NAMES: Record<string, string> = {
  task: "内容与任务",
  accuracy: "语言准确性",
  lexis: "词汇与句式",
  structure: "结构与衔接"
};

export const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  grammar: "语法",
  vocab: "用词",
  spelling: "拼写",
  cohesion: "衔接",
  logic: "逻辑",
  register: "语域",
  task: "任务"
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "影响分数",
  medium: "值得注意",
  low: "细节优化"
};

export const IMPACT_LABELS: Record<Impact, string> = {
  high: "优先处理",
  medium: "本轮改进",
  low: "有余力再做"
};

export function examLabel(exam: ExamId): string {
  return EXAMS.find((item) => item.id === exam)?.label ?? "英语一";
}

export function kindLabel(kind: EssayKind): string {
  return KINDS.find((item) => item.id === kind)?.label ?? "大作文";
}

export function levelLabel(level: LevelId): string {
  return LEVELS.find((item) => item.id === level)?.label ?? "稳定及格";
}

export function maxScoreFor(exam: ExamId, kind: EssayKind): number {
  if (kind === "letter") return 10;
  return exam === "english1" ? 20 : 15;
}

export function targetOptions(exam: ExamId, kind: EssayKind): number[] {
  const max = maxScoreFor(exam, kind);
  const picks = [0.6, 0.7, 0.8, 0.9].map((ratio) => Math.round(max * ratio * 2) / 2);
  return Array.from(new Set(picks));
}

export function bandFor(total: number, max: number): string {
  const ratio = max > 0 ? total / max : 0;
  if (ratio >= 0.9) return "优秀档";
  if (ratio >= 0.75) return "良好档";
  if (ratio >= 0.62) return "中等档";
  if (ratio >= 0.45) return "及格档";
  return "基础档";
}

export function predictedRange(total: number, max: number): [number, number] {
  const low = Math.max(0, Math.round((total - 1) * 2) / 2);
  const high = Math.min(max, Math.round((total + 1) * 2) / 2);
  return [low, high];
}

export const DEFAULT_PROFILE: UserProfile = {
  exam: "english1",
  level: "steady",
  targetScore: 14,
  examDate: ""
};

export const TOPICS: Record<ExamId, Record<EssayKind, TopicPreset[]>> = {
  english1: {
    essay: [
      {
        id: "e1-cooperation",
        title: "图画作文 · 合作攀登",
        prompt:
          "图画中两名登山者互相拉扶，共同攀登峭壁。请描述图画、解释其寓意，并给出你的看法。不少于 160 词。"
      },
      {
        id: "e1-reading",
        title: "图画作文 · 手机与阅读",
        prompt:
          "图画中一个人被手机屏幕包围，身旁的书本落满灰尘。请描述图画、解释其寓意，并给出你的看法。不少于 160 词。"
      },
      {
        id: "e1-persistence",
        title: "图画作文 · 坚持与放弃",
        prompt:
          "图画中一个人在半途放下镐头，而另一个人仍在向山顶挖掘。请描述图画、解释其寓意，并给出你的看法。不少于 160 词。"
      }
    ],
    letter: [
      {
        id: "e1-invite",
        title: "书信 · 邀请外教担任评委",
        prompt:
          "Write a letter to Professor Smith, inviting him to be a judge of the English Speech Contest held by your university. Tell him the time, place and topic of the contest. About 100 words. Do not sign your own name; use Li Ming instead."
      },
      {
        id: "e1-library",
        title: "书信 · 向图书馆提建议",
        prompt:
          "Write a letter to the university library to suggest how to improve its service, explaining the current problems and your suggestions. About 100 words. Do not sign your own name; use Li Ming instead."
      },
      {
        id: "e1-book",
        title: "书信 · 向学弟推荐一本书",
        prompt:
          "Write a letter to a junior schoolmate recommending a book, introducing what the book is about and why it is worth reading. About 100 words. Do not sign your own name; use Li Ming instead."
      }
    ]
  },
  english2: {
    essay: [
      {
        id: "e2-online",
        title: "图表作文 · 大学生在线学习",
        prompt:
          "柱状图显示 2019—2024 年大学生每周在线学习时长从 3.2 小时增长到 9.6 小时。请描述图表、分析原因，并给出你的看法。不少于 150 词。"
      },
      {
        id: "e2-reading",
        title: "图表作文 · 阅读方式变化",
        prompt:
          "图表显示纸质书阅读比例逐年下降，电子阅读比例逐年上升。请描述图表、分析原因，并给出你的看法。不少于 150 词。"
      },
      {
        id: "e2-parttime",
        title: "图表作文 · 学生兼职比例",
        prompt:
          "图表显示近五年大学生兼职比例持续上升。请描述图表、分析原因，并给出你的看法。不少于 150 词。"
      }
    ],
    letter: [
      {
        id: "e2-volunteer",
        title: "通知 · 志愿者招募",
        prompt:
          "Write a notice for the Student Union to recruit volunteers for an international conference, including the requirements and how to apply. About 100 words. Do not sign your own name; use Li Ming instead."
      },
      {
        id: "e2-thanks",
        title: "书信 · 感谢同学帮助",
        prompt:
          "Write a letter to your classmate Zhang Wei to thank him for helping you prepare for an important interview. About 100 words. Do not sign your own name; use Li Ming instead."
      },
      {
        id: "e2-canteen",
        title: "书信 · 对食堂的建议",
        prompt:
          "Write a letter to the canteen manager to make suggestions on improving food quality and service. About 100 words. Do not sign your own name; use Li Ming instead."
      }
    ]
  }
};

export const DEFAULT_TOPIC: Record<EssayKind, TopicPreset> = {
  essay: TOPICS.english1.essay[0],
  letter: TOPICS.english1.letter[0]
};

export function findTopic(exam: ExamId, kind: EssayKind, id: string): TopicPreset | undefined {
  return TOPICS[exam][kind].find((topic) => topic.id === id);
}

export function defaultMeta(profile: UserProfile = DEFAULT_PROFILE): EssayMeta {
  const topics = TOPICS[profile.exam];
  const topic = topics.essay[0];
  return {
    exam: profile.exam,
    kind: "essay",
    topicTitle: topic.title,
    topicPrompt: topic.prompt,
    targetScore: Math.min(profile.targetScore, maxScoreFor(profile.exam, "essay")),
    level: profile.level
  };
}

export const MAX_REPORTS = 100;
