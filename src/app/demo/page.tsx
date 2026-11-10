"use client";

import Link from "next/link";
import { useState } from "react";
import { Nav } from "@/components/Nav";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Card, Money, Swatch } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { galleryTotals, nextInstallment, paidSoFar } from "@/lib/escrow/engine";
import { shareOf } from "@/lib/money";
import type { PaymentMethod } from "@/types";

const BUYERS = [
  "Delphine Arceneaux",
  "Ostrander Collection",
  "K. Whitcombe",
  "Marisol Ybarra",
];

export default function DemoPage() {
  const { snapshot, error, busy, act, clearError } = useSnapshot();
  const [artworkId, setArtworkId] = useState("");
  const [buyerName, setBuyerName] = useState(BUYERS[0]);
  const [installments, setInstallments] = useState(3);
  const [method, setMethod] = useState<PaymentMethod>("wire");

  if (!snapshot) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-6xl p-6 text-muted">
          {error ?? "Loading…"}
        </main>
      </>
    );
  }

  const gallery = snapshot.galleries[0];
  const totals = galleryTotals(snapshot, gallery.id);
  const available = snapshot.artworks.filter((w) => w.status === "consigned");
  const selected =
    available.find((w) => w.id === artworkId) ?? available[0] ?? null;
  const selectedAgreement = selected
    ? snapshot.agreements.find((a) => a.artistId === selected.artistId)
    : undefined;
  const openSales = snapshot.sales.filter((s) => s.status === "open");
  const unread = snapshot.agreements.filter((a) => !a.terms);

  async function closeSale() {
    if (!selected) return;
    const ok = await act("/api/demo/sale", {
      artworkId: selected.id,
      buyerName,
      installments,
    });
    if (ok) {
      setArtworkId("");
      setBuyerName(
        BUYERS[(BUYERS.indexOf(buyerName) + 1) % BUYERS.length] ?? BUYERS[0],
      );
    }
  }

  return (
    <>
      <Nav rampConnected={gallery.rampConnected} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Simulated Ramp bank feed</p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">
              Demo controls
            </h1>
            <p className="mt-2 max-w-xl text-muted">
              Play the buyer and the bank. Every button here is something that
              happens in the real world; Rescrow reacts the same way it would to
              a live Ramp account.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("/api/demo/reset")}
            className="rounded-md border border-line bg-card px-3 py-2 text-sm hover:border-ink/40 disabled:opacity-50"
          >
            Reset demo data
          </button>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-4 rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            <p>{error}</p>
            <button type="button" onClick={clearError} className="underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <MiniStat
            label="Gallery can spend"
            cents={totals.operatingCents}
            tone="text-gallery"
          />
          <MiniStat
            label="Locked for artists"
            cents={totals.lockedCents}
            tone="text-lock"
          />
          <MiniStat
            label="Paid to artists"
            cents={totals.paidToArtistsCents}
            tone="text-paid"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {unread.length > 0 && (
              <Card title="Step 0: agent reads the agreement">
                <ul className="space-y-3">
                  {unread.map((a) => {
                    const artist = snapshot.artists.find(
                      (x) => x.id === a.artistId,
                    );
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-4"
                      >
                        <p className="text-sm">
                          <span className="font-medium">{artist?.name}</span>
                          <span className="text-muted">
                            {" "}
                            uploaded a consignment agreement. Nothing of theirs
                            can sell until it is read.
                          </span>
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act("/api/agent/read", { agreementId: a.id })
                          }
                          className="shrink-0 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-50"
                        >
                          Read agreement
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <Card title="Step 1: a collector buys a work">
              {available.length === 0 ? (
                <p className="text-sm text-muted">
                  Every work is sold. Reset the demo to start over.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {available.map((w) => {
                      const artist = snapshot.artists.find(
                        (a) => a.id === w.artistId,
                      );
                      const isSelected = selected?.id === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setArtworkId(w.id)}
                          className={`flex items-center gap-3 rounded-md border p-3 text-left text-sm ${isSelected ? "border-ink bg-paper" : "border-line hover:border-ink/40"}`}
                        >
                          <Swatch artwork={w} size={40} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{w.title}</span>
                            <span className="block text-xs text-muted">
                              {artist?.name}
                            </span>
                          </span>
                          <Money cents={w.priceCents} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-xs text-muted">
                        Buyer
                      </span>
                      <input
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-52 rounded-md border border-line bg-paper px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-xs text-muted">
                        Pays in
                      </span>
                      <select
                        value={installments}
                        onChange={(e) =>
                          setInstallments(Number(e.target.value))
                        }
                        className="rounded-md border border-line bg-paper px-3 py-2"
                      >
                        {[1, 2, 3, 4, 6].map((n) => (
                          <option key={n} value={n}>
                            {n === 1
                              ? "full, one payment"
                              : `${n} installments`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={busy || !selected || !selectedAgreement?.terms}
                      onClick={closeSale}
                      className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
                    >
                      Close the sale
                    </button>
                  </div>
                  {selected && !selectedAgreement?.terms && (
                    <p className="text-xs text-gallery">
                      The agent has to read this artist&apos;s agreement first
                      (Step 0).
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card
              title="Step 2: buyer money lands in Ramp"
              action={
                <label className="flex items-center gap-2 text-xs text-muted">
                  arrives by
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-ink"
                  >
                    <option value="wire">wire</option>
                    <option value="ach">ACH</option>
                    <option value="card">card</option>
                  </select>
                </label>
              }
            >
              {openSales.length === 0 ? (
                <p className="text-sm text-muted">
                  No sales waiting on payment. Close a sale above.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {openSales.map((sale) => {
                    const work = snapshot.artworks.find(
                      (w) => w.id === sale.artworkId,
                    );
                    const artist = snapshot.artists.find(
                      (a) => a.id === sale.artistId,
                    );
                    const terms = snapshot.agreements.find(
                      (a) => a.artistId === sale.artistId,
                    )?.terms;
                    const paid = paidSoFar(snapshot, sale.id);
                    const count = snapshot.payments.filter(
                      (p) => p.saleId === sale.id,
                    ).length;
                    const next = nextInstallment(snapshot, sale);
                    const locks = terms
                      ? shareOf(next, terms.artistShareBps)
                      : 0;
                    return (
                      <li key={sale.id} className="space-y-3 py-4">
                        <div className="flex items-center gap-3">
                          {work && <Swatch artwork={work} size={40} />}
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="font-medium">
                              {work?.title}{" "}
                              <span className="font-normal text-muted">
                                by {artist?.name}
                              </span>
                            </p>
                            <p className="text-xs text-muted">
                              {count === 0 ? (
                                <>
                                  {sale.buyerName} has not paid yet:{" "}
                                  {sale.installments === 1
                                    ? "one payment"
                                    : `${sale.installments} installments`}{" "}
                                  of <Money cents={sale.priceCents} />
                                </>
                              ) : (
                                <>
                                  {sale.buyerName} has paid{" "}
                                  <Money cents={paid} /> of{" "}
                                  <Money cents={sale.priceCents} />, installment{" "}
                                  {count} of {sale.installments}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              act("/api/demo/payment", {
                                saleId: sale.id,
                                method,
                              })
                            }
                            className="rounded-md bg-lock px-3 py-2 text-sm font-medium text-paper disabled:opacity-50"
                          >
                            <Money cents={next} /> lands
                          </button>
                          <span className="text-xs text-muted">
                            Rescrow will lock <Money cents={locks} /> for{" "}
                            {artist?.name.split(" ")[0]}
                            {count + 1 === sale.installments
                              ? " and pay out everything the same day"
                              : ""}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              act("/api/demo/cancel", { saleId: sale.id })
                            }
                            className="ml-auto rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/5 disabled:opacity-50"
                          >
                            Buyer backs out
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <p className="text-sm text-muted">
              Watch it from both sides:{" "}
              <Link href="/gallery" className="underline">
                gallery dashboard
              </Link>{" "}
              and{" "}
              <Link href="/artist" className="underline">
                artist portal
              </Link>
              .
            </p>
          </div>

          <Card title="Live activity">
            <ActivityFeed snapshot={snapshot} limit={12} />
          </Card>
        </div>
      </main>
    </>
  );
}

function MiniStat({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <Money cents={cents} className={`text-lg font-semibold ${tone}`} />
    </div>
  );
}
