"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { runSelfCheck } from "@/lib/self-check";
import { cn } from "@/lib/utils";
import type { EssayKind } from "@/lib/types";

const CHECKLIST = [
  "题目要求都回应了吗？",
  "每个句子是否只有一个谓语？",
  "主谓一致、时态和单复数检查过了吗？",
  "拼写、搭配和介词检查过了吗？",
  "段落之间有没有过渡？"
];

export function SelfCheck({ text, kind }: { text: string; kind: EssayKind }) {
  const result = useMemo(() => runSelfCheck(text, kind), [text, kind]);
  const [open, setOpen] = useState(true);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  const hints = useMemo(() => {
    const list: string[] = [];
    const [min, max] = result.wordRange;
    if (result.words > 0 && result.words < min) {
      list.push(`全文 ${result.words} 词，低于建议的 ${min}–${max} 词。`);
    } else if (result.words > max) {
      list.push(`全文 ${result.words} 词，超过建议的 ${min}–${max} 词，注意不要写散。`);
    }
    if (result.paragraphs === 1) {
      list.push("全文只有 1 段，建议至少分成 3 段：描述、分析、结论。");
    }
    result.longSentences.forEach((sentence) => {
      list.push(`第 ${sentence.index} 句有 ${sentence.words} 词，可能太长，读一遍看是否需要断句。`);
    });
    result.misspellings.slice(0, 4).forEach((item) => {
      list.push(`可能拼错：${item.word} → ${item.suggestion}。`);
    });
    result.repeatedWords.slice(0, 2).forEach((item) => {
      list.push(`「${item.word}」出现了 ${item.count} 次，看看能不能换成更具体的词。`);
    });
    result.intensifiers.slice(0, 2).forEach((item) => {
      list.push(`「${item.word}」出现了 ${item.count} 次，可以换成更准确的形容词或动词。`);
    });
    return list;
  }, [result]);

  const checkedCount = checked.filter(Boolean).length;

  if (text.trim().length < 40) return null;

  return (
    <section className="mt-5 border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-[14px] font-medium text-ink">
          <ListChecks size={16} className="text-jade" /> 交卷前自查
        </span>
        <span className="inline-flex items-center gap-2 text-[13px] text-ink-mute">
          {hints.length ? `${hints.length} 项提示` : "基础检查通过"}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["词数", `${result.words}`, `建议 ${result.wordRange[0]}–${result.wordRange[1]}`],
              ["段落", `${result.paragraphs}`, "建议 3 段左右"],
              ["句子", `${result.sentences}`, `平均 ${result.averageSentenceWords} 词/句`],
              [
                "长句",
                `${result.longSentences.length}`,
                result.longSentences.length ? "超过 35 词" : "没有明显长句"
              ]
            ].map(([label, value, note]) => (
              <div key={label} className="border-t border-line pt-2.5">
                <p className="text-[12px] text-ink-mute">{label}</p>
                <p className="num mt-0.5 text-[20px] leading-none text-ink">{value}</p>
                <p className="mt-1 text-[12px] leading-4 text-ink-mute">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            {hints.length ? (
              <>
                <ul className="space-y-2">
                  {hints.slice(0, 6).map((hint) => (
                    <li key={hint} className="flex gap-2 text-[13.5px] leading-6 text-ink-soft">
                      <AlertTriangle size={14} className="mt-1 shrink-0 text-gold" />
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
                {hints.length > 6 && (
                  <p className="mt-2 text-[12px] text-ink-mute">还有 {hints.length - 6} 项提示未展开。</p>
                )}
              </>
            ) : (
              <p className="flex items-center gap-2 text-[13.5px] text-jade">
                <Check size={14} /> 基础检查没有发现问题，仍建议朗读一遍再提交。
              </p>
            )}
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-ink">自查清单</p>
              <div className="flex items-center gap-2 text-[12px] text-ink-mute">
                <span>
                  {checkedCount} / {CHECKLIST.length}
                </span>
                <button
                  type="button"
                  onClick={() => setChecked(CHECKLIST.map(() => false))}
                  className="font-medium text-ink-mute hover:text-jade"
                >
                  重置
                </button>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {CHECKLIST.map((item, index) => (
                <label
                  key={item}
                  className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-6 text-ink-soft"
                >
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() =>
                      setChecked((current) =>
                        current.map((value, itemIndex) => (itemIndex === index ? !value : value))
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-jade"
                  />
                  <span className={cn(checked[index] && "text-ink-mute line-through")}>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-ink-mute">
            这些只是基础检查，不能替代逐句批改。语法和表达是否准确，仍以批改结果为准。
          </p>
        </div>
      )}
    </section>
  );
}
