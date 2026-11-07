"use client";

import { Fragment } from "react";
import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  annotations: Annotation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  showCorrections?: boolean;
}

export function AnnotatedEssay({
  text,
  annotations,
  activeId,
  onSelect,
  showCorrections = false
}: Props) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return (
    <div className="essay-body space-y-5">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {renderParagraph(paragraph, annotations, activeId, onSelect, showCorrections)}
        </p>
      ))}
    </div>
  );
}

function renderParagraph(
  paragraph: string,
  annotations: Annotation[],
  activeId: string | null,
  onSelect: (id: string) => void,
  showCorrections: boolean
) {
  const matches: { start: number; end: number; annotation: Annotation; number: number }[] = [];

  annotations.forEach((annotation, index) => {
    const quote = annotation.quote.replace(/\s+/g, " ").trim();
    const start = paragraph.indexOf(quote);
    if (start !== -1) {
      let end = start + quote.length;
      const nextCharacter = paragraph.slice(end, end + 1);
      if (/[.,;:!?]/.test(nextCharacter) && !/[.,;:!?]$/.test(quote)) {
        end += 1;
      }
      matches.push({
        start,
        end,
        annotation,
        number: index + 1
      });
    }
  });

  matches.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start < cursor) return;
    if (match.start > cursor) nodes.push(paragraph.slice(cursor, match.start));
    nodes.push(
      <span key={`${match.annotation.id}-${match.start}`} className="inline">
        <button
          type="button"
          onClick={() => onSelect(match.annotation.id)}
          className={cn(
            "redline cursor-pointer rounded-[2px] bg-cinnabar/[0.045] text-left transition-colors hover:bg-cinnabar/[0.1]",
            activeId === match.annotation.id && "bg-cinnabar/[0.14]"
          )}
          title={`${match.annotation.suggestion}｜${match.annotation.explanation}`}
        >
          {paragraph.slice(match.start, match.end)}
          <sup className="ml-0.5 font-sans text-[12px] font-medium not-italic text-cinnabar">
            {match.number}
          </sup>
        </button>
        {showCorrections && (
          <span className="mx-1 inline bg-jade/[0.07] px-1 font-sans text-[14px] font-medium not-italic leading-6 text-jade">
            → {match.annotation.suggestion}
          </span>
        )}
      </span>
    );
    cursor = match.end;
  });

  if (cursor < paragraph.length) nodes.push(paragraph.slice(cursor));

  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}
