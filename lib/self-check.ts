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

function countMatches(text: string, word: string): number {
  return text.match(new RegExp(`\\b${word}\\b`, "g"))?.length ?? 0;
}

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

  const lower = trimmed.toLowerCase();
  const misspellings = Object.entries(MISSPELLINGS)
    .map(([word, suggestion]) => ({ word, suggestion, count: countMatches(lower, word) }))
    .filter((item) => item.count > 0);

  const wordCounts = new Map<string, number>();
  const tokens = lower.match(/[a-z]+(?:['’-][a-z]+)*/g) ?? [];
  tokens.forEach((token) => {
    const word = token.replace(/['’-].*$/, "");
    if (word.length < 4 || STOP_WORDS.has(word)) return;
    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
  });
  const repeatedWords = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => ({ word, count }));

  const intensifiers = INTENSIFIERS.map((word) => ({
    word,
    count: countMatches(lower, word)
  }))
    .filter((item) => item.count >= 3)
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
