import type { ReactNode } from "react";

/**
 * Agreement text with the agent's cited clauses highlighted. Citations are
 * matched exactly, so a highlight only appears where the agent quoted the
 * document word for word.
 */
export function AgreementText({
  text,
  citations,
  active = true,
}: {
  text: string;
  citations: string[];
  active?: boolean;
}) {
  const ranges = citations
    .map((c) => ({ start: text.indexOf(c), length: c.length }))
    .filter((r) => r.start >= 0 && r.length > 0)
    .sort((x, y) => x.start - y.start);

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start < cursor) return;
    parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark
        key={i}
        className={`rounded-[2px] px-0.5 transition-colors duration-700 ${active ? "bg-highlight text-ink" : "bg-transparent text-inherit"}`}
      >
        {text.slice(r.start, r.start + r.length)}
      </mark>,
    );
    cursor = r.start + r.length;
  });
  parts.push(text.slice(cursor));

  return (
    <div className="font-doc text-[13px] leading-relaxed whitespace-pre-wrap text-ink/80">
      {parts}
    </div>
  );
}
