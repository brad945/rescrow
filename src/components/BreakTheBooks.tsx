"use client";

import { useState } from "react";
import { breakOnCopy, PLANT_INFO, type BreakResult } from "@/lib/escrow/plants";
import { GALLERY } from "@/components/story";
import { useSnapshot } from "@/components/useSnapshot";

/**
 * Pick a way to cheat and watch reconcile() name it. Every plant runs on a
 * copy of the latest snapshot in this browser; the gallery's books are never
 * written.
 */
export function BreakTheBooks() {
  const { snapshot } = useSnapshot();
  const [picked, setPicked] = useState<string | null>(null);
  // Recomputed from the latest snapshot on every render, so the result always
  // describes the books as they are now.
  const result: BreakResult | null =
    snapshot && picked ? breakOnCopy(snapshot, GALLERY, picked) : null;

  return (
    <section className="rounded-md border border-line bg-card p-4">
      <h2 className="text-sm font-semibold">Try to break the books</h2>
      <p className="mt-1 text-[12px] text-muted">
        Applied to a copy in your browser. The gallery&apos;s books are
        unchanged. Each check below is the same reconciliation the gallery runs,
        on whatever state the demo is in now.
      </p>
      {!snapshot ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-1.5">
            {PLANT_INFO.map((p) => {
              const why = p.when(snapshot, GALLERY);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!!why}
                    onClick={() => setPicked(p.id)}
                    className={`w-full rounded border px-2.5 py-1.5 text-left text-[12px] disabled:opacity-40 ${picked === p.id ? "border-ink/40 bg-row" : "border-line"}`}
                  >
                    {p.name}
                    {why && (
                      <span className="block text-[10px] text-faint">
                        {why}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="text-[12px]">
            {!result ? (
              <p className="text-muted">Pick one.</p>
            ) : result.error ? (
              <p className="text-danger">{result.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="rounded border border-trust/30 bg-trust-soft px-2.5 py-1.5 text-trust">
                  Before:{" "}
                  {result.before.balanced
                    ? "books balance to the cent ✓"
                    : "already broken"}
                </p>
                <div className="rounded border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-danger">
                  <p className="font-medium">
                    After, on the copy:{" "}
                    {result.caught ? "caught ✓" : "not caught"}
                  </p>
                  <ul className="mt-1 list-disc pl-4">
                    {result.after?.breaks.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
