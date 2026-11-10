"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { ExplainDrawer } from "@/components/ExplainDrawer";
import type { Metric } from "@/lib/explain";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AgreementCard } from "@/components/AgreementCard";
import { GalleryBalances, Ledger } from "@/components/GalleryAccount";
import { Card, Money, Pill, Swatch, shortDate } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { paidSoFar } from "@/lib/escrow/engine";

export default function GalleryPage() {
  const { snapshot, error, busy, act } = useSnapshot();
  const [explaining, setExplaining] = useState<Metric | null>(null);
  const gallery = snapshot?.galleries[0];

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

  const sales = [...snapshot.sales]
    .filter((s) => s.galleryId === gallery.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <Nav rampConnected={gallery.rampConnected} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              {gallery.name}
            </h1>
            <p className="text-sm text-muted">214 Orchard Street, New York</p>
          </div>
          <p className="max-w-md text-xs text-muted">
            Each buyer payment is split the moment it arrives. The artist&apos;s
            share goes to the trust account and stays there until the artist is
            paid.
          </p>
        </div>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <GalleryBalances snapshot={snapshot} onExplain={setExplaining} />
        {explaining && (
          <ExplainDrawer
            snapshot={snapshot}
            galleryId={gallery.id}
            metric={explaining}
            onClose={() => setExplaining(null)}
          />
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card title="Account activity" flush>
            <Ledger snapshot={snapshot} limit={10} />
          </Card>
          <Card title="Audit log">
            <ActivityFeed snapshot={snapshot} limit={7} />
          </Card>
        </div>

        <Card title="Sales" flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="px-4 py-2 font-medium">Work</th>
                  <th className="py-2 font-medium">Buyer</th>
                  <th className="py-2 font-medium">Payments</th>
                  <th className="py-2 text-right font-medium">Received</th>
                  <th className="py-2 text-right font-medium">In trust</th>
                  <th className="px-4 py-2 text-right font-medium">Status</th>
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
                  const held = snapshot.holds
                    .filter(
                      (h) => h.saleId === sale.id && h.status === "locked",
                    )
                    .reduce((t, h) => t + h.amountCents, 0);
                  return (
                    <tr
                      key={sale.id}
                      className="border-b border-line/70 last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {work && <Swatch artwork={work} size={34} />}
                          <div>
                            <p className="font-medium">{work?.title}</p>
                            <p className="text-[11px] text-muted">
                              {artist?.name}, {sale.artistShareBps / 100}% to
                              artist
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <p>{sale.buyerName}</p>
                        <p className="text-[11px] text-muted">
                          {shortDate(sale.createdAt)}
                        </p>
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-0.5">
                          {Array.from({ length: sale.installments }).map(
                            (_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-5 rounded-sm ${i < count ? (sale.status === "cancelled" ? "bg-faint/50" : "bg-ink") : "bg-line"}`}
                              />
                            ),
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {count} of {sale.installments}
                        </p>
                      </td>
                      <td className="py-2.5 text-right">
                        <Money cents={paid} />
                        <p className="text-[11px] text-muted">
                          of <Money cents={sale.priceCents} />
                        </p>
                      </td>
                      <td className="py-2.5 text-right">
                        {held > 0 ? (
                          <Money cents={held} className="text-trust" />
                        ) : (
                          <span className="text-faint">0.00</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Pill status={sale.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Consignment agreements</h2>
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
