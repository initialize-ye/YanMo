import type { EssayKind } from "./types";
import { countWords, wordRangeFor } from "./utils";

const MISSPELLINGS: Record<string, string> = {
  accomodate: "accommodate",
  acheive: "achieve",
  beleive: "believe",
  calender: "calendar",
  commitee: "committee",
  definately: "definitely",
  developement: "development",
  efficent: "efficient",
  enviroment: "environment",
  existance: "existence",
  familar: "familiar",
  goverment: "government",
  immediatly: "immediately",
  knowlege: "knowledge",
  neccessary: "necessary",
  occured: "occurred",
  prevelent: "prevalent",
  recieve: "receive",
  refered: "referred",
  seperate: "separate",
  succesful: "successful",
  thier: "their",
  tommorow: "tomorrow",
  untill: "until",
  wich: "which"
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "could",
  "does",
  "doing",
  "during",
  "each",
  "from",
  "have",
  "having",
  "here",
  "into",
  "just",
  "more",
  "most",
  "much",
  "must",
  "only",
  "other",
  "over",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "very",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your"
]);

const INTENSIFIERS = ["very", "really", "so", "quite", "totally", "extremely"];

export interface SelfCheckResult {
  words: number;
  sentences: number;
  paragraphs: number;
  averageSentenceWords: number;
  longSentences: { index: number; words: number; text: string }[];
  misspellings: { word: string; suggestion: string; count: number }[];
  repeatedWords: { word: string; count: number }[];
  intensifiers: { word: string; count: number }[];
  wordRange: [number, number];
}

const MISSPELLING_SET = new Set(Object.keys(MISSPELLINGS));
const INTENSIFIER_SET = new Set(INTENSIFIERS);

export function runSelfCheck(text: string, kind: EssayKind): SelfCheckResult {
  const trimmed = text.trim();
  const words = countWords(trimmed);
  const paragraphs = trimmed
    ? trimmed.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length
    : 0;
  const sentences = trimmed
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  const sentenceWords = sentences.map((sentence) => countWords(sentence));
  const totalSentenceWords = sentenceWords.reduce((sum, value) => sum + value, 0);

  const longSentences: SelfCheckResult["longSentences"] = [];
  sentences.forEach((sentence, index) => {
    if (sentenceWords[index] >= 35) {
      longSentences.push({
        index: index + 1,
        words: sentenceWords[index],
        text: sentence
      });
    }
  });

  // 一次分词后统计所有词频，避免对每个待检查单词各跑一遍正则。
  const lower = trimmed.toLowerCase();
  const tokens = lower.match(/[a-z]+(?:['’-][a-z]+)*/g) ?? [];
  const tokenCounts = new Map<string, number>();
  tokens.forEach((token) => {
    const word = token.replace(/['’-].*$/, "");
    if (!word) return;
    tokenCounts.set(word, (tokenCounts.get(word) ?? 0) + 1);
  });

  const misspellings = Array.from(tokenCounts.entries())
    .filter(([word]) => MISSPELLING_SET.has(word))
    .map(([word, count]) => ({ word, suggestion: MISSPELLINGS[word], count }))
    .sort((a, b) => b.count - a.count);

  const repeatedWords = Array.from(tokenCounts.entries())
    .filter(([word, count]) => count >= 4 && word.length >= 4 && !STOP_WORDS.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => ({ word, count }));

  const intensifiers = Array.from(tokenCounts.entries())
    .filter(([word, count]) => count >= 3 && INTENSIFIER_SET.has(word))
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  return {
    words,
    sentences: sentences.length,
    paragraphs,
    averageSentenceWords: sentences.length
      ? Math.round((totalSentenceWords / sentences.length) * 10) / 10
      : 0,
    longSentences: longSentences.slice(0, 3),
    misspellings,
    repeatedWords,
    intensifiers,
    wordRange: wordRangeFor(kind)
  };
}
