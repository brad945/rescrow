"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArtistAccountLine } from "@/components/ArtistAccountLine";
import { artistPayments } from "@/lib/artist";
import { Money, shortDate } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { methodLabel } from "@/lib/money";

export default function StatementPage() {
  const { artistId, payoutId } = useParams<{
    artistId: string;
    payoutId: string;
  }>();
  const { snapshot, error } = useSnapshot();
  const payout = snapshot?.payouts.find(
    (p) => p.id === payoutId && p.artistId === artistId,
  );

  if (!snapshot || !payout) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-muted">
        {error ?? (snapshot ? "Statement not found." : "Loading…")}
      </main>
    );
  }

  const artist = snapshot.artists.find((a) => a.id === payout.artistId);
  const gallery = snapshot.galleries.find((g) => g.id === payout.galleryId);
  const holds = snapshot.holds.filter((h) => payout.holdIds.includes(h.id));
  const sale = snapshot.sales.find((s) => s.id === holds[0]?.saleId);
  const work = snapshot.artworks.find((w) => w.id === sale?.artworkId);
  // Number each row by its real installment on the sale, not its position in
  // this payout (a final payout can cover installments 2 and 3).
  const salePayments = snapshot.payments
    .filter((p) => p.saleId === sale?.id)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const rows = holds.map((h) => ({
    hold: h,
    index: salePayments.findIndex((p) => p.id === h.paymentId) + 1,
    payment: salePayments.find((p) => p.id === h.paymentId),
  }));
  // When and why each share was paid, from the recorded reason and dates.
  const timeline = new Map(
    artistPayments(snapshot, payout.artistId).map((r) => [r.holdId, r.summary]),
  );
  // The split frozen on the sale, not whatever the agreement says today.
  const share = sale ? sale.artistShareBps / 100 : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 print:py-0">
      <div className="mb-6 flex justify-between text-sm print:hidden">
        <Link
          href={`/artist/${artistId}`}
          className="text-muted hover:underline"
        >
          Back to portal
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-ink px-3 py-1.5 text-paper"
        >
          Print or save PDF
        </button>
      </div>

      <article className="rounded-lg border border-line bg-card p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b border-line pb-6">
          <div>
            <p className="text-xl font-semibold tracking-tight">Rescrow</p>
            <p className="text-sm text-muted">Artist payout statement</p>
          </div>
          <div className="text-right text-sm">
            <p className="num">{payout.id.toUpperCase()}</p>
            <p className="text-muted">{shortDate(payout.paidAt)}</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-4 py-6 text-sm">
          <div>
            <dt className="text-muted">Paid to</dt>
            <dd className="font-medium">{artist?.name}</dd>
            <dd className="text-muted">{artist?.email}</dd>
          </div>
          <div>
            <dt className="text-muted">On behalf of</dt>
            <dd className="font-medium">{gallery?.name}</dd>
            <dd className="text-muted">{gallery?.city}</dd>
          </div>
          <div>
            <dt className="text-muted">Work</dt>
            <dd className="font-medium">{work?.title}</dd>
            <dd className="text-muted">
              {work?.medium}, {work?.year}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Sale</dt>
            <dd className="font-medium">
              <Money cents={sale?.priceCents ?? 0} /> to {sale?.buyerName}
            </dd>
            {share !== null && (
              <dd className="text-muted">
                Your share under agreement: {share}%
              </dd>
            )}
          </div>
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-xs text-muted">
              <th className="py-2 font-medium">Buyer payment</th>
              <th className="py-2 font-medium">Received</th>
              <th className="py-2 font-medium">Locked</th>
              <th className="py-2 text-right font-medium">Your share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ hold, index, payment }) => (
              <tr key={hold.id} className="border-b border-line/70">
                <td className="py-2">
                  {index} of {sale?.installments}
                  {payment && (
                    <span className="text-muted">
                      {" "}
                      ({methodLabel(payment.method)},{" "}
                      <Money cents={payment.amountCents} />)
                    </span>
                  )}
                  {payment?.rampTransactionId && (
                    <span className="num block text-[10px] text-faint">
                      bank id {payment.rampTransactionId}
                    </span>
                  )}
                  {timeline.get(hold.id) && (
                    <span className="block text-[11px] text-muted">
                      {timeline.get(hold.id)}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  {payment ? shortDate(payment.receivedAt) : ""}
                </td>
                <td className="py-2">{shortDate(hold.lockedAt)}</td>
                <td className="py-2 text-right">
                  <Money cents={hold.amountCents} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 font-medium">
                Paid to you
              </td>
              <td className="pt-4 text-right text-lg font-semibold">
                <Money cents={payout.amountCents} />
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          Each amount above was moved to {gallery?.name}&apos;s artist trust
          account at Ramp the moment the buyer&apos;s payment arrived, and
          released to you{" "}
          {payout.reason === "deadline"
            ? "on its payout deadline in your agreement, while the buyer was still paying"
            : payout.reason === "insolvency"
              ? `when ${gallery?.name} became insolvent: trust money is not part of the gallery's estate, so it went to you, not to creditors`
              : "the day the sale was paid in full"}
          . Under New York Arts and Cultural Affairs Law section 12.01, proceeds
          owed to an artist are trust funds and are not the gallery&apos;s
          property.
          {sale?.status === "cancelled" && (
            <>
              {" "}
              The buyer later cancelled. You keep this payment: the gallery
              refunded the buyer this share from its own operating cash, not
              from trust.
            </>
          )}
        </p>
        <ArtistAccountLine
          snapshot={snapshot}
          galleryId={payout.galleryId}
          artistId={payout.artistId}
          className="mt-3"
        />
      </article>
    </main>
  );
}
