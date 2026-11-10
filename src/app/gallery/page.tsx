"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Nav } from "@/components/Nav";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AgreementCard } from "@/components/AgreementCard";
import { Card, Money, Pill, Stat, Swatch } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { galleryTotals, paidSoFar } from "@/lib/escrow/engine";

export default function GalleryPage() {
  const { snapshot, error, busy, act } = useSnapshot();
  const gallery = snapshot?.galleries[0];

  const view = useMemo(() => {
    if (!snapshot || !gallery) return null;
    const totals = galleryTotals(snapshot, gallery.id);
    const sales = [...snapshot.sales]
      .filter((s) => s.galleryId === gallery.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const received = snapshot.payments
      .filter((p) => {
        const sale = snapshot.sales.find((s) => s.id === p.saleId);
        return p.galleryId === gallery.id && sale?.status !== "cancelled";
      })
      .reduce((t, p) => t + p.amountCents, 0);
    const artistPart = totals.lockedCents + totals.paidToArtistsCents;
    return {
      totals,
      sales,
      received,
      galleryPart: received - artistPart,
    };
  }, [snapshot, gallery]);

  if (!snapshot || !gallery || !view) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-6xl p-6 text-muted">
          {error ?? "Loading…"}
        </main>
      </>
    );
  }

  const { totals, sales, received, galleryPart } = view;
  const pct = (n: number) => (received ? (n / received) * 100 : 0);

  return (
    <>
      <Nav rampConnected={gallery.rampConnected} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-muted">{gallery.city}</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            {gallery.name}
          </h1>
        </div>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Gallery can spend"
            cents={totals.operatingCents}
            tone="gallery"
            hint="Operating balance after every artist's share is set aside."
          />
          <Stat
            label="Locked for artists"
            cents={totals.lockedCents}
            tone="lock"
            hint="Held in trust while buyers finish paying. The gallery cannot touch it."
          />
          <Stat
            label="Paid to artists"
            cents={totals.paidToArtistsCents}
            tone="paid"
            hint="Sent the same day each sale was paid in full."
          />
        </div>

        <Card title="Where every dollar from buyers went">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-line">
            <div
              className="bg-gallery transition-all duration-700"
              style={{ width: `${pct(galleryPart)}%` }}
            />
            <div
              className="bg-lock transition-all duration-700"
              style={{ width: `${pct(totals.lockedCents)}%` }}
            />
            <div
              className="bg-paid transition-all duration-700"
              style={{ width: `${pct(totals.paidToArtistsCents)}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Legend color="bg-gallery" label="Gallery commission">
              <Money cents={galleryPart} />
            </Legend>
            <Legend color="bg-lock" label="Locked for artists">
              <Money cents={totals.lockedCents} />
            </Legend>
            <Legend color="bg-paid" label="Paid to artists">
              <Money cents={totals.paidToArtistsCents} />
            </Legend>
            <span className="ml-auto text-muted">
              Total received <Money cents={received} className="text-ink" />
            </span>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card title="Sales">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-5 py-2 font-medium">Work</th>
                    <th className="py-2 font-medium">Buyer</th>
                    <th className="py-2 font-medium">Paid</th>
                    <th className="py-2 text-right font-medium">Locked</th>
                    <th className="px-5 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const work = snapshot.artworks.find(
                      (a) => a.id === sale.artworkId,
                    );
                    const artist = snapshot.artists.find(
                      (a) => a.id === sale.artistId,
                    );
                    const paid = paidSoFar(snapshot, sale.id);
                    const count = snapshot.payments.filter(
                      (p) => p.saleId === sale.id,
                    ).length;
                    const locked = snapshot.holds
                      .filter(
                        (h) => h.saleId === sale.id && h.status === "locked",
                      )
                      .reduce((t, h) => t + h.amountCents, 0);
                    return (
                      <tr
                        key={sale.id}
                        className="border-b border-line/70 last:border-0"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {work && <Swatch artwork={work} size={36} />}
                            <div>
                              <p className="font-medium">{work?.title}</p>
                              <p className="text-xs text-muted">
                                {artist?.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">{sale.buyerName}</td>
                        <td className="py-3">
                          <Money cents={paid} /> /{" "}
                          <Money
                            cents={sale.priceCents}
                            className="text-muted"
                          />
                          <div className="mt-1 flex gap-0.5">
                            {Array.from({ length: sale.installments }).map(
                              (_, i) => (
                                <span
                                  key={i}
                                  className={`h-1.5 w-6 rounded-full ${i < count ? (sale.status === "cancelled" ? "bg-muted/40" : "bg-ink") : "bg-line"}`}
                                />
                              ),
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          {locked > 0 ? (
                            <Money cents={locked} className="text-lock" />
                          ) : (
                            <span className="text-muted">none</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Pill status={sale.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted">
              New sale or payment?{" "}
              <Link href="/demo" className="underline">
                Use the demo controls
              </Link>
              .
            </p>
          </Card>

          <Card title="Activity">
            <ActivityFeed snapshot={snapshot} limit={8} />
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
            Consignment agreements
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {snapshot.agreements.map((agreement) => (
              <AgreementCard
                key={agreement.id}
                agreement={agreement}
                artist={snapshot.artists.find(
                  (a) => a.id === agreement.artistId,
                )}
                busy={busy}
                onRead={() =>
                  act("/api/agent/read", { agreementId: agreement.id })
                }
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function Legend({
  color,
  label,
  children,
}: {
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="text-muted">{label}</span>
      {children}
    </span>
  );
}
