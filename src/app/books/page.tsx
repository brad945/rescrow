"use client";

import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { GALLERY } from "@/components/story";
import { Card, Money, stamp } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import {
  accountLabel,
  CHART,
  describeTieOut,
  FLOW_FROM,
  FLOW_TO,
  flowMatrix,
  glLines,
  toCsv,
  toQuickBooksJson,
  trialBalance,
  trustTieOut,
} from "@/lib/books";
import { reconcile } from "@/lib/escrow/reconcile";

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const MATRIX = flowMatrix();

export default function BooksPage() {
  const { snapshot, error } = useSnapshot();
  const gallery = snapshot?.galleries.find((g) => g.id === GALLERY);

  if (!snapshot || !gallery) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-6xl p-6 text-sm text-muted">
          {error ?? "Loading…"}
        </main>
      </>
    );
  }

  const lines = glLines(snapshot, GALLERY);
  const tb = trialBalance(lines);
  const tie = trustTieOut(snapshot, GALLERY);
  const rec = reconcile(snapshot, GALLERY);
  const name = (id: string | null) =>
    snapshot.artists.find((a) => a.id === id)?.name ?? id ?? "";
  const entries = [...snapshot.journal].reverse().slice(0, 12);

  return (
    <>
      <Nav rampConnected={gallery.rampConnected} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              Books, {gallery.name}
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              What the gallery&apos;s accountant sees. Money held for artists is
              restricted cash with a matching liability, never revenue. Every
              line below is built from the double-entry journal, and the journal
              is checked against the balances to the cent.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                download("rescrow-gl.csv", "text/csv", toCsv(snapshot, lines))
              }
              className="rounded border border-line bg-card px-3 py-1.5 text-sm hover:border-ink/30"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  "rescrow-journal-entries.json",
                  "application/json",
                  toQuickBooksJson(lines),
                )
              }
              className="rounded border border-line bg-card px-3 py-1.5 text-sm hover:border-ink/30"
            >
              Download QuickBooks JSON
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[12px]">
          <Badge ok={tb.balanced}>
            Trial balance {tb.balanced ? "balances" : "is off"}: debits{" "}
            <Money cents={tb.debitCents} /> = credits{" "}
            <Money cents={tb.creditCents} />
          </Badge>
          <Badge ok={tie.ok}>{describeTieOut(tie)}</Badge>
          <Badge ok={rec.balanced}>
            {rec.balanced
              ? `Journal agrees with the records · ${rec.journalEntries} entries`
              : `${rec.breaks.length} reconciliation break(s)`}
          </Badge>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Trial balance" flush>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="py-2 text-right font-medium">Debits</th>
                  <th className="py-2 text-right font-medium">Credits</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.account.code} className="border-b border-line/60">
                    <td className="px-4 py-1.5">
                      <span className="num text-faint">{r.account.code}</span>{" "}
                      {r.account.name}
                    </td>
                    <td className="py-1.5 text-right">
                      <Money cents={r.debitCents} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Money cents={r.creditCents} />
                    </td>
                    <td className="px-4 py-1.5 text-right font-medium">
                      <Money cents={r.balanceCents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-[11px] text-muted">
              Commission is booked as revenue when each payment lands and
              reversed if the sale is cancelled. Holding it as a deposit until
              the sale completes would be stricter.
            </p>
          </Card>

          <Card title="Due to artists, by artist">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="py-2 font-medium">Artist</th>
                  <th className="py-2 text-right font-medium">
                    Owed (account 2010)
                  </th>
                  <th className="py-2 text-right font-medium">Held in trust</th>
                  <th className="py-2 text-right font-medium">Ties out</th>
                </tr>
              </thead>
              <tbody>
                {tie.perArtist.map((a) => (
                  <tr key={a.artistId} className="border-b border-line/60">
                    <td className="py-1.5">{name(a.artistId)}</td>
                    <td className="py-1.5 text-right">
                      <Money cents={a.owedCents} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Money cents={a.lockedCents} />
                    </td>
                    <td
                      className={`py-1.5 text-right ${a.ok ? "text-trust" : "text-danger"}`}
                    >
                      {a.ok ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="mt-5 mb-2 text-sm font-semibold">
              Where money may go
            </h3>
            <p className="mb-2 text-[11px] text-muted">
              Each cell is decided by sending a one-cent entry to the
              journal&apos;s own account rules.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[11px] text-muted">
                    <th className="py-1 font-medium">From \ to</th>
                    {FLOW_TO.map((to) => (
                      <th key={to} className="py-1 text-center font-medium">
                        {accountLabel(to)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FLOW_FROM.map((from) => (
                    <tr key={from} className="border-t border-line/60">
                      <td className="py-1.5 font-medium">
                        {accountLabel(from)}
                      </td>
                      {FLOW_TO.map((to) => {
                        const c = MATRIX.find(
                          (x) => x.from === from && x.to === to,
                        );
                        if (!c) {
                          return (
                            <td key={to} className="text-center text-faint">
                              ·
                            </td>
                          );
                        }
                        return (
                          <td
                            key={to}
                            title={c.detail}
                            className={`py-1.5 text-center ${c.allowed ? "text-trust" : from === "trust" ? "font-semibold text-danger" : "text-faint"}`}
                          >
                            {c.allowed ? "allowed" : "blocked"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card title="Journal, newest first" flush>
          <ul className="divide-y divide-line/60 text-[12px]">
            {entries.map((e) => {
              const sum = e.postings.reduce((t, p) => t + p.cents, 0);
              return (
                <li key={e.id} className="px-4 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="num font-medium">{e.code}</span>{" "}
                      <span className="text-faint">{stamp(e.at)}</span>
                    </span>
                    <span
                      className={`num text-[11px] ${sum === 0 ? "text-trust" : "text-danger"}`}
                    >
                      sums to <Money cents={sum} />
                    </span>
                  </div>
                  <ul className="num mt-1 grid gap-x-6 sm:grid-cols-2">
                    {e.postings.map((p) => (
                      <li
                        key={p.account}
                        className="flex justify-between gap-3 text-muted"
                      >
                        <span className="truncate">{p.account}</span>
                        <Money cents={p.cents} signed />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Card>

        <p className="text-[11px] text-faint">
          Chart of accounts:{" "}
          {Object.values(CHART)
            .map((a) => `${a.code} ${a.name}`)
            .join(" · ")}
          . Exports are files for import, not a live sync.
        </p>
      </main>
    </>
  );
}

function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-md border px-3 py-1.5 ${ok ? "border-trust/30 bg-trust-soft text-trust" : "border-danger/30 bg-danger/5 text-danger"}`}
    >
      {children}
    </span>
  );
}
