"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ArtistAccountLine } from "@/components/ArtistAccountLine";
import { Card, Money, Pill, shortDate, Swatch } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { artistTotals, paidSoFar } from "@/lib/escrow/engine";
import { artistPayments, paymentScorecard } from "@/lib/artist";
import { formatCents, methodLabel, shareOf } from "@/lib/money";

export default function ArtistPortal() {
  const { artistId } = useParams<{ artistId: string }>();
  const { snapshot, error } = useSnapshot();
  const artist = snapshot?.artists.find((a) => a.id === artistId);

  if (!snapshot || !artist) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-6xl p-6 text-muted">
          {error ?? (snapshot ? "Artist not found." : "Loading…")}
        </main>
      </>
    );
  }

  const gallery = snapshot.galleries.find((g) => g.id === artist.galleryId);
  const totals = artistTotals(snapshot, artist.id);
  const agreement = snapshot.agreements.find((a) => a.artistId === artist.id);
  const terms = agreement?.terms;
  const works = snapshot.artworks.filter((w) => w.artistId === artist.id);
  const payouts = snapshot.payouts
    .filter((p) => p.artistId === artist.id)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const lockedHolds = snapshot.holds.filter(
    (h) => h.artistId === artist.id && h.status === "locked",
  );
  const dueBy = lockedHolds
    .map((h) => h.dueBy)
    .filter((d): d is string => !!d)
    .sort()[0];

  return (
    <>
      <Nav rampConnected={gallery?.rampConnected} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <Link href="/artist" className="text-sm text-muted hover:underline">
            Artists
          </Link>
          <h1 className="text-[22px] font-semibold tracking-tight">
            {artist.name}
          </h1>
          <p className="text-muted">Represented by {gallery?.name}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-trust/30 bg-trust-soft p-6">
            <p className="text-sm font-medium text-trust">
              Held in trust for you
            </p>
            <p className="mt-1 text-5xl font-semibold text-trust">
              <Money cents={totals.heldCents} />
            </p>
            <p className="mt-3 max-w-md text-sm text-trust/80">
              Your share of buyer payments that have already arrived. It sits in
              a separate Ramp account the gallery can&apos;t spend from, and
              under New York law it is trust money, not the gallery&apos;s, even
              if the gallery closes.
            </p>
            {gallery && (
              <ArtistAccountLine
                snapshot={snapshot}
                galleryId={gallery.id}
                artistId={artist.id}
                className="mt-3 max-w-md"
              />
            )}
            {lockedHolds.length > 0 && (
              <p className="mt-3 text-xs text-trust/80">
                Paid to you automatically the day the buyer finishes paying
                {dueBy
                  ? `, and by ${shortDate(dueBy)} at the latest under your agreement`
                  : ""}
                .
              </p>
            )}
          </div>
          <div className="grid gap-4">
            <div className="rounded-lg border border-line bg-card p-5">
              <p className="text-sm text-muted">Paid to you</p>
              <Money
                cents={totals.paidCents}
                className="text-3xl font-semibold text-ink"
              />
            </div>
            {terms && (
              <div className="rounded-lg border border-line bg-card p-5 text-sm">
                <p className="text-muted">
                  Your agreement, as the agent read it
                </p>
                <p className="mt-1">
                  <span className="num font-semibold">
                    {terms.artistShareBps / 100}%
                  </span>{" "}
                  of every sale is yours. Your agreement gives the gallery{" "}
                  <span className="num font-semibold">
                    {terms.payoutDays} days
                  </span>
                  . Rescrow pays you the day the buyer finishes paying, or on
                  each payment&apos;s deadline if the buyer is still paying by
                  then.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card title="Your work">
            <ul className="divide-y divide-line">
              {works.map((work) => {
                const sale = snapshot.sales
                  .filter(
                    (s) => s.artworkId === work.id && s.status !== "cancelled",
                  )
                  .at(-1);
                const paid = sale ? paidSoFar(snapshot, sale.id) : 0;
                const yourCut = sale
                  ? shareOf(sale.priceCents, sale.artistShareBps)
                  : null;
                return (
                  <li key={work.id} className="flex items-center gap-4 py-3">
                    <Swatch artwork={work} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{work.title}</p>
                      <p className="text-xs text-muted">
                        {work.medium}, {work.year}
                      </p>
                      {sale && (
                        <p className="mt-1 text-xs text-muted">
                          Sold to {sale.buyerName}. Buyer has paid{" "}
                          {formatCents(paid)} of {formatCents(sale.priceCents)}
                          {yourCut !== null &&
                            `. Your share: ${formatCents(yourCut)}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Money cents={work.priceCents} className="text-sm" />
                      <div className="mt-1">
                        <Pill status={sale ? sale.status : work.status} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-6">
            <Card title="Buyer payments">
              <p className="mb-2 text-xs text-trust">
                {paymentScorecard(snapshot, artist.id).line}
              </p>
              <ul className="space-y-2.5">
                {artistPayments(snapshot, artist.id).map((r) => (
                  <li
                    key={`${r.saleId}_${r.installment}`}
                    className="text-[12px]"
                  >
                    <div className="flex justify-between gap-2">
                      <span>
                        {r.workTitle},{" "}
                        {r.installment <= r.installments
                          ? `${r.installment} of ${r.installments}`
                          : `payment ${r.installment}`}
                      </span>
                      <span>
                        your share <Money cents={r.shareCents} />
                      </span>
                    </div>
                    <p className="num text-[10px] text-faint">
                      {methodLabel(r.method)} <Money cents={r.amountCents} />,{" "}
                      {shortDate(r.receivedAt)}
                      {r.rampTransactionId &&
                        ` · bank id ${r.rampTransactionId}`}
                    </p>
                    <p className="text-[11px] text-muted">{r.summary}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Payouts">
              {payouts.length === 0 ? (
                <p className="text-sm text-muted">No payouts yet.</p>
              ) : (
                <ul className="space-y-3">
                  {payouts.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <Money
                          cents={p.amountCents}
                          className="font-semibold text-ink"
                        />
                        <p className="text-xs text-muted">
                          {shortDate(p.paidAt)}
                        </p>
                      </div>
                      <Link
                        href={`/artist/${artist.id}/statements/${p.id}`}
                        className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-ink/40"
                      >
                        Statement
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Your activity">
              <ActivityFeed
                snapshot={snapshot}
                artistId={artist.id}
                limit={6}
              />
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
