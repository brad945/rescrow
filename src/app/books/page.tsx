"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { GALLERY } from "@/components/story";
import { Card, Money, stamp } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import {
  accountLabel,
  CHART,
  deadlineLadder,
  describeTieOut,
  FLOW_FROM,
  FLOW_TO,
  flowMatrix,
  glLines,
  toCsv,
  toQuickBooksJson,
  incomeStatement,
  LADDER_BUCKETS,
  monthLabel,
  nextMonthToClose,
  trialBalance,
  trustTieOut,
} from "@/lib/books";
import { reconcile } from "@/lib/escrow/reconcile";
import { statementOfAffairs } from "@/lib/insolvency";
import {
  GALLERY_CHART,
  mapAccount,
  SUGGESTED_MAPPING,
  validateMapping,
  type ChartMapping,
} from "@/lib/chart";

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // Some browsers cancel the download if the URL is revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const MATRIX = flowMatrix();

export default function BooksPage() {
  const { snapshot, error, busy, act } = useSnapshot();
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [useChart, setUseChart] = useState(false);
  const [mapping, setMapping] = useState<ChartMapping>(SUGGESTED_MAPPING);
  const refusals = validateMapping(mapping);
  const namer =
    useChart && refusals.length === 0
      ? (code: string) => mapAccount(code, mapping)
      : undefined;
  // The wall clock, refreshed every 30s; the snapshot's demo offset is added below.
  const [wall, setWall] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setWall(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
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
  const income = incomeStatement(lines, basis);
  const toClose = nextMonthToClose(snapshot, GALLERY);
  const closes = [...(snapshot.closedPeriods ?? [])].reverse();
  const affairs = statementOfAffairs(snapshot, GALLERY);
  const ladder = deadlineLadder(
    snapshot,
    GALLERY,
    new Date(wall + (snapshot.clockOffsetMs ?? 0)).toISOString(),
  );

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
                download(
                  "rescrow-gl.csv",
                  "text/csv",
                  toCsv(snapshot, lines, namer),
                )
              }
              disabled={useChart && refusals.length > 0}
              title={
                useChart && refusals.length > 0
                  ? "Fix the chart mapping first"
                  : undefined
              }
              className="rounded border border-line bg-card px-3 py-1.5 text-sm hover:border-ink/30 disabled:opacity-40"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  "rescrow-journal-entries.json",
                  "application/json",
                  toQuickBooksJson(lines, namer),
                )
              }
              disabled={useChart && refusals.length > 0}
              title={
                useChart && refusals.length > 0
                  ? "Fix the chart mapping first"
                  : undefined
              }
              className="rounded border border-line bg-card px-3 py-1.5 text-sm hover:border-ink/30 disabled:opacity-40"
            >
              Download QuickBooks JSON
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {affairs && (
          <Card title="Statement of affairs">
            <div className="grid gap-5 text-[13px] md:grid-cols-2">
              <div>
                <h3 className="mb-1 font-semibold text-trust">
                  Never the gallery&apos;s
                </h3>
                <ul className="space-y-1">
                  {affairs.trustPaidOut.map((t) => (
                    <li key={t.payoutId} className="flex justify-between gap-3">
                      <span>
                        {name(t.artistId)}, paid from trust at the failure
                        <span className="num block text-[10px] text-faint">
                          funded by {t.bankIds.join(", ")}
                        </span>
                      </span>
                      <Money cents={t.amountCents} />
                    </li>
                  ))}
                  {affairs.outcome.worksReturned.map((w) => (
                    <li key={w.artworkId} className="text-muted">
                      {w.title} returned to {name(w.artistId)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-danger">The estate</h3>
                <ul className="space-y-1">
                  <li className="flex justify-between gap-3">
                    <span>Operating cash turned over to the administrator</span>
                    <Money cents={affairs.estateCashCents} />
                  </li>
                  <li className="flex justify-between gap-3">
                    <span>
                      Buyers&apos; claims (the gallery&apos;s part of what they
                      paid)
                    </span>
                    <Money cents={affairs.buyerClaimsCents} />
                  </li>
                </ul>
              </div>
            </div>
            {affairs.openSales.length > 0 && (
              <table className="mt-4 w-full text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-muted">
                    <th className="py-1.5 font-medium">Open sale at failure</th>
                    <th className="py-1.5 text-right font-medium">
                      Buyer paid
                    </th>
                    <th className="py-1.5 text-right font-medium">
                      To artist on deadline, before
                    </th>
                    <th className="py-1.5 text-right font-medium">
                      To artist from trust at failure
                    </th>
                    <th className="py-1.5 text-right font-medium">
                      Buyer&apos;s claim
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {affairs.openSales.map((r) => (
                    <tr key={r.saleId} className="border-b border-line/60">
                      <td className="py-1.5">
                        {r.workTitle} ({name(r.artistId)}), {r.buyerName}
                        <span className="block text-[10px] text-faint">
                          Work recorded as sold, sale not completed
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <Money cents={r.paidCents} />
                      </td>
                      <td className="py-1.5 text-right">
                        <Money cents={r.paidOnDeadlineCents} />
                      </td>
                      <td className="py-1.5 text-right">
                        <Money cents={r.paidAtFailureCents} />
                      </td>
                      <td className="py-1.5 text-right">
                        <Money cents={r.buyerClaimCents} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[11px] text-muted">
              Ties out: estate cash plus trust paid at failure equals operating
              plus trust in the journal before the failure, and buyers&apos;
              claims equal buyer deposits (2020) in the ledger. Buyers&apos;
              claims are the gallery&apos;s part of what the records show they
              paid; Rescrow doesn&apos;t compute what the administrator will pay
              on them, or decide who the works under open sales belong to. Not
              legal advice.
            </p>
          </Card>
        )}

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
              The gallery&apos;s part of each payment is held as the
              buyer&apos;s deposit (2020) until the sale completes, then
              recognised as commission (4010). A cancelled sale returns it from
              2020.
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

        <Card
          title="Commission earned"
          action={
            <div className="flex rounded border border-line text-[12px]">
              {(["accrual", "cash"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBasis(b)}
                  className={`px-2.5 py-1 capitalize ${basis === b ? "bg-row font-medium text-ink" : "text-muted"}`}
                >
                  {b}
                </button>
              ))}
            </div>
          }
        >
          <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-[11px] text-muted">Commission</dt>
              <dd className="text-lg font-medium">
                <Money cents={income.commissionCents} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">
                Refunds covered for artists
              </dt>
              <dd className="text-lg font-medium">
                <Money cents={-income.coveredRefundsCents} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Net</dt>
              <dd className="text-lg font-semibold">
                <Money cents={income.netCents} />
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted">
            {basis === "accrual"
              ? "Accrual: commission counts when a sale completes."
              : "Cash: the gallery's part of buyer money as it arrives, less what cancellations handed back."}{" "}
            The difference is exactly what is still held as buyer deposits.
            Money held for artists is never in either.
          </p>
        </Card>

        <Card
          title="Export to your chart of accounts"
          action={
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={useChart}
                onChange={(e) => setUseChart(e.target.checked)}
              />
              Use this mapping for the downloads
            </label>
          }
        >
          <div className="grid gap-2 text-[12px] sm:grid-cols-2">
            {Object.values(CHART).map((a) => (
              <label
                key={a.code}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  <span className="num text-faint">{a.code}</span> {a.name}
                </span>
                <select
                  value={mapping[a.code] ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [a.code]: e.target.value })
                  }
                  className="max-w-[55%] rounded border border-line bg-card px-1.5 py-1"
                >
                  <option value="">Not mapped</option>
                  {GALLERY_CHART.map((g) => (
                    <option key={g.number} value={g.number}>
                      {g.number} {g.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {refusals.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-[12px] text-danger">
              {refusals.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-trust">
              Mapping is safe: trust cash and what is owed to artists stay in
              accounts of their own.
            </p>
          )}
          <p className="mt-2 text-[11px] text-faint">
            An export mapping onto a sample gallery chart, kept for this visit
            only. It is refused, line by line, if it would put trust money in
            operating cash or income on paper. Not a sync.
          </p>
        </Card>

        <Card title="Payout deadlines">
          <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
            {LADDER_BUCKETS.map((b) => (
              <span
                key={b}
                className={`rounded border px-2 py-1 ${b === "overdue" && ladder.totals[b] > 0 ? "border-danger/40 text-danger" : "border-line text-muted"}`}
              >
                {b}: <Money cents={ladder.totals[b]} />
              </span>
            ))}
          </div>
          {ladder.rows.length === 0 ? (
            <p className="text-sm text-muted">Nothing is held in trust.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="py-1.5 font-medium">Artist, work</th>
                  <th className="py-1.5 text-right font-medium">Held</th>
                  <th className="py-1.5 pl-6 font-medium">Due by</th>
                  <th className="py-1.5 pl-4 font-medium">Window</th>
                </tr>
              </thead>
              <tbody>
                {ladder.rows.map((r) => (
                  <tr key={r.holdId} className="border-b border-line/60">
                    <td className="py-1.5">
                      {name(r.artistId)}, {r.workTitle}
                    </td>
                    <td className="py-1.5 text-right">
                      <Money cents={r.amountCents} />
                    </td>
                    <td
                      className={`num py-1.5 pl-6 ${r.bucket === "overdue" ? "text-danger" : ""}`}
                    >
                      {r.dueBy
                        ? `${r.dueBy.slice(0, 10)} (${r.bucket === "overdue" ? "past due, paid on the next poll" : `${r.daysLeft} days`})`
                        : "none on record"}
                    </td>
                    <td className="py-1.5 pl-4 text-muted">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] text-faint">
            Follows the demo clock. Days are whole calendar days in UTC.
          </p>
        </Card>

        <Card
          title="Month-end close"
          action={
            toClose && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act("/api/books/close", {
                    galleryId: GALLERY,
                    month: toClose,
                  })
                }
                className="rounded bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Close {monthLabel(toClose)}
              </button>
            )
          }
        >
          <p className="text-[12px] text-muted">
            A month can only be closed after it ends, in order, while every
            reconciliation check passes (down to each payment and payout) and no
            share in trust is past its deadline. If anything fails, the close is
            refused and says why.
          </p>
          {closes.length > 0 && (
            <ul className="mt-3 divide-y divide-line/60 text-[12px]">
              {closes.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2"
                >
                  <span className="font-medium">{monthLabel(c.month)}</span>
                  <span className="rounded-sm border border-trust/30 px-1.5 text-[11px] text-trust">
                    Sealed
                  </span>
                  {c.checks.map((k) => (
                    <span
                      key={k.label}
                      className={k.ok ? "text-trust" : "text-danger"}
                    >
                      {k.ok ? "✓" : "✗"} {k.label}
                    </span>
                  ))}
                  <span className="text-muted">
                    {c.entryCount} journal entries · trial balance{" "}
                    <Money cents={c.trialBalanceCents} /> · held in trust{" "}
                    <Money cents={c.trustHeldCents} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-faint">
            Months in UTC. Sealed by entry count and totals: this catches later
            edits, not someone who rewrites the whole file. Postings into a
            closed month are detected, not yet refused. Not synced to an
            accounting system.
          </p>
        </Card>

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
