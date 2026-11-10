"use client";

import { useState } from "react";
import type { AgreementTerms } from "@/types";
import { Nav } from "@/components/Nav";
import {
  AgentPanel,
  idleRun,
  reduceRun,
  type AgentRun,
} from "@/components/AgentPanel";
import { AgreementText } from "@/components/AgreementText";
import { RoundingCheck } from "@/components/RoundingCheck";
import { readNdjson } from "@/components/readNdjson";

const SAMPLES = [
  {
    name: "Commission only",
    hint: "Only the gallery's cut is stated",
    text: `CONSIGNMENT TERMS: HALVERSEN PROJECTS AND J. ODUYA

1. The Gallery's commission on each sale is thirty-five percent (35%) of the gross sale price, before any taxes.

2. The balance is due to the Artist within forty-five (45) days after the Gallery receives payment in full from the buyer.

3. Framing costs advanced by the Gallery will be deducted from the Artist's balance, up to $600 per work.

4. The Gallery may offer installment terms of up to six months without further consent.

Signed in Brooklyn, New York, August 2, 2026.`,
  },
  {
    name: "No deadline",
    hint: "Should be flagged for a person",
    text: `LETTER AGREEMENT

Dear Sam,

Thanks for trusting us with the new work. As discussed, sales proceeds will be divided equally between the Gallery and you after any agreed discounts.

We will remit your portion once the buyer's payment has cleared and at our earliest convenience, together with a sales report.

Warmly,
Petra Lindgren
Lindgren & Vos Fine Art`,
  },
  { name: "Paste your own", hint: "Any consignment agreement", text: "" },
];

export default function LabPage() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [run, setRun] = useState<AgentRun>(idleRun);
  const [terms, setTerms] = useState<AgreementTerms | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = run.status === "running";

  async function read() {
    setError(null);
    setTerms(null);
    setRun({ ...idleRun, status: "running", startedAt: Date.now() });
    try {
      const res = await fetch("/api/agent/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      await readNdjson(res, (event) => {
        setRun((r) =>
          reduceRun(
            r,
            event.type === "done" ? { ...event, source: "model" } : event,
          ),
        );
        if (event.type === "done") setTerms(event.terms as AgreementTerms);
        if (event.type === "error") setError(String(event.message));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRun((r) => ({ ...r, status: "error", finishedAt: Date.now() }));
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Agreement reader
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Paste any consignment agreement. The agent runs on this laptop, and
            nothing here is saved. A number only counts if the agent can quote
            the clause that states it; otherwise a person has to confirm it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.name}
              type="button"
              disabled={running}
              onClick={() => {
                setText(s.text);
                setTerms(null);
                setRun(idleRun);
                setError(null);
              }}
              className={`rounded border px-3 py-1.5 text-left text-[13px] disabled:opacity-40 ${text === s.text ? "border-ink bg-card" : "border-line hover:border-ink/40"}`}
            >
              <span className="block font-medium">{s.name}</span>
              <span className="block text-[11px] text-muted">{s.hint}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm font-medium">Agreement</span>
              {terms ? (
                <button
                  type="button"
                  onClick={() => {
                    setTerms(null);
                    setRun(idleRun);
                  }}
                  className="text-[13px] text-muted hover:text-ink"
                >
                  Edit text
                </button>
              ) : (
                <button
                  type="button"
                  disabled={running || text.trim().length < 40}
                  onClick={read}
                  className="rounded bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {running ? "Reading…" : "Read with agent"}
                </button>
              )}
            </div>
            {terms ? (
              <div className="p-4">
                <AgreementText text={text} citations={terms.citations} />
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={running}
                placeholder="Paste a consignment agreement here (at least a few sentences)."
                className="font-doc block h-[420px] w-full resize-none bg-transparent p-4 text-[13px] leading-relaxed outline-none"
              />
            )}
          </div>
          <AgentPanel run={run} terms={terms} source={null} />
        </div>
        <RoundingCheck />
      </main>
    </>
  );
}
