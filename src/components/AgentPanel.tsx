"use client";

import { useEffect, useRef, useState } from "react";
import type { AgreementTerms } from "@/types";

export type AgentRun = {
  status: "idle" | "running" | "done" | "error";
  output: string;
  thinking: string;
  tokens: number;
  startedAt: number | null;
  finishedAt: number | null;
  source: "model" | "fixture" | null;
  verified: boolean | null;
  fallbackReason: string | null;
};

export const idleRun: AgentRun = {
  status: "idle",
  output: "",
  thinking: "",
  tokens: 0,
  startedAt: null,
  finishedAt: null,
  source: null,
  verified: null,
  fallbackReason: null,
};

/** Applies one streamed event from the agent routes to a run. */
export function reduceRun(
  run: AgentRun,
  event: Record<string, unknown>,
): AgentRun {
  if (event.type === "token") {
    return {
      ...run,
      output: run.output + String(event.text),
      tokens: run.tokens + 1,
    };
  }
  if (event.type === "thinking") {
    return { ...run, thinking: run.thinking + String(event.text) };
  }
  if (event.type === "done") {
    return {
      ...run,
      status: "done",
      finishedAt: Date.now(),
      source: (event.source as AgentRun["source"]) ?? "model",
      verified: (event.verified as boolean | undefined) ?? null,
      fallbackReason: (event.fallbackReason as string | null) ?? null,
    };
  }
  if (event.type === "error") {
    return { ...run, status: "error", finishedAt: Date.now() };
  }
  return run;
}

function useElapsed(run: AgentRun): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [run.status]);
  if (!run.startedAt) return 0;
  return ((run.finishedAt ?? now) - run.startedAt) / 1000;
}

export function AgentPanel({
  run,
  terms,
  source,
}: {
  run: AgentRun;
  /** Terms on file, shown when there is no live run (for example after a reload). */
  terms: AgreementTerms | null;
  source: "model" | "fixture" | null;
}) {
  const elapsed = useElapsed(run);
  const out = useRef<HTMLPreElement>(null);
  useEffect(() => {
    out.current?.scrollTo({ top: out.current.scrollHeight });
  }, [run.output]);

  const shownSource = run.source ?? source;

  return (
    <div className="flex flex-col rounded-md border border-line bg-card text-sm">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="font-medium">Agent</span>
        <span className="num text-[11px] text-muted">
          {run.status === "running"
            ? `gpt-oss-20b on this laptop · ${run.output ? `${run.tokens} tokens` : "reasoning"} · ${elapsed.toFixed(1)}s`
            : shownSource === "model"
              ? `${terms?.model ?? "gpt-oss-20b"}, local${run.finishedAt ? ` · ${elapsed.toFixed(1)}s` : ""}`
              : shownSource === "fixture"
                ? "cached answer"
                : "waiting"}
        </span>
      </header>

      {run.status === "running" || (run.output && !terms) ? (
        <pre
          ref={out}
          className="num h-64 overflow-y-auto px-4 py-3 text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink/80"
        >
          {run.output ||
            (run.thinking ? (
              <span className="text-faint italic">
                {run.thinking.slice(-600)}
              </span>
            ) : (
              "Reading the agreement…"
            ))}
          {run.status === "running" && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-ink/60 align-middle" />
          )}
        </pre>
      ) : terms ? (
        <div className="space-y-3 px-4 py-3">
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] text-muted">Artist share</p>
              <p className="num text-2xl text-trust">
                {terms.artistShareBps / 100}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Pay artist within</p>
              <p className="num text-2xl">
                {terms.payoutDays ? `${terms.payoutDays} days` : "not set"}
              </p>
            </div>
          </div>

          {terms.checks && terms.checks.length > 0 && (
            <ul className="space-y-1.5 border-t border-line pt-3">
              {terms.checks.map((c) => (
                <li key={c.label} className="flex gap-2 text-[12.5px]">
                  <span
                    aria-hidden
                    className={`num mt-px w-3 shrink-0 ${c.ok ? "text-trust" : "text-danger"}`}
                  >
                    {c.ok ? "✓" : "✕"}
                  </span>
                  <span>
                    <span className={c.ok ? "" : "text-danger"}>{c.label}</span>
                    <span className="sr-only">
                      {c.ok ? " passed" : " failed"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {terms.unverifiedCitations &&
            terms.unverifiedCitations.length > 0 && (
              <div className="border-t border-line pt-3">
                <p className="text-[11px] text-danger">
                  Quoted by the agent but not in the agreement
                </p>
                <ul className="mt-1 space-y-1 text-[12px] text-danger/80 line-through">
                  {terms.unverifiedCitations.map((q) => (
                    <li key={q}>&ldquo;{q}&rdquo;</li>
                  ))}
                </ul>
              </div>
            )}

          {terms.notes.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="text-[11px] text-muted">Also affects payment</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[12.5px] text-ink/80">
                {terms.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {terms.checks?.some((c) => !c.ok) && (
            <p className="rounded border border-danger/30 bg-danger/5 px-2 py-1.5 text-[12px] text-danger">
              Held for a person to confirm:{" "}
              {terms.checks
                .filter((c) => !c.ok)
                .map((c) => c.label.toLowerCase())
                .join("; ")}
              . No money moves on these terms until they do.
            </p>
          )}
          {run.fallbackReason && (
            <p className="text-[11px] text-muted">
              Model unavailable ({run.fallbackReason}); used the cached answer.
            </p>
          )}
        </div>
      ) : (
        <p className="px-4 py-3 text-muted">Not read yet.</p>
      )}
    </div>
  );
}
