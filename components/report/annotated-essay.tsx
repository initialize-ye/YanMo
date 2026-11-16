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
  className?: string;
}

interface Placement {
  start: number;
  end: number;
  annotation: Annotation;
  number: number;
}

/**
 * 把批注分配回原文。
 *
 * 顺序扫描段落，每条批注只占用一处匹配位置；同一句被重复标注时，
 * 会依次匹配到段内的下一个出现位置，而不是全部挤在第一次出现的地方。
 */
function placeAnnotations(paragraphs: string[], annotations: Annotation[]): Placement[][] {
  const placements: Placement[][] = paragraphs.map(() => []);
  const placed = new Set<string>();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    let cursor = 0;
    annotations.forEach((annotation, index) => {
      if (placed.has(annotation.id)) return;
      const quote = annotation.quote.replace(/\s+/g, " ").trim();
      if (!quote) return;

      const start = paragraph.indexOf(quote, cursor);
      if (start === -1) return;

      let end = start + quote.length;
      const nextCharacter = paragraph.slice(end, end + 1);
      if (/[.,;:!?]/.test(nextCharacter) && !/[.,;:!?]$/.test(quote)) {
        end += 1;
      }

      placements[paragraphIndex].push({ start, end, annotation, number: index + 1 });
      placed.add(annotation.id);
      cursor = end;
    });
  });

  return placements;
}

export function AnnotatedEssay({
  text,
  annotations,
  activeId,
  onSelect,
  showCorrections = false,
  className
}: Props) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const placements = placeAnnotations(paragraphs, annotations);

  return (
    <div className={cn("essay-body space-y-5", className)}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {renderParagraph(
            paragraph,
            placements[paragraphIndex],
            activeId,
            onSelect,
            showCorrections
          )}
        </p>
      ))}
    </div>
  );
}

function renderParagraph(
  paragraph: string,
  matches: Placement[],
  activeId: string | null,
  onSelect: (id: string) => void,
  showCorrections: boolean
) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start > cursor) nodes.push(paragraph.slice(cursor, match.start));
    nodes.push(
      <span key={`${match.annotation.id}-${match.start}`} className="inline">
        <button
          type="button"
          id={`anchor-${match.annotation.id}`}
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
          <span className="mx-1 inline bg-jade/[0.07] px-1 font-sans not-italic text-jade">
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
