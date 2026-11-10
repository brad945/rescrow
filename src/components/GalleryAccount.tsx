"use client";

import { useState } from "react";
import type { Snapshot } from "@/types";
import { galleryTotals } from "@/lib/escrow/engine";
import { ledgerFor } from "@/components/ledger";
import { Money, ref, stamp } from "@/components/ui";
import { useTween } from "@/components/useTween";

export function GalleryBalances({ snapshot }: { snapshot: Snapshot }) {
  const gallery = snapshot.galleries[0];
  const totals = galleryTotals(snapshot, gallery.id);
  const operating = useTween(totals.operatingCents);
  const trust = useTween(totals.lockedCents);
  const byArtist = snapshot.artists
    .map((a) => ({
      artist: a,
      cents: snapshot.holds
        .filter((h) => h.artistId === a.id && h.status === "locked")
        .reduce((t, h) => t + h.amountCents, 0),
    }))
    .filter((x) => x.cents > 0);
  const insolvent = gallery.status === "insolvent";

  return (
    <div className="overflow-hidden rounded-md border border-line bg-card">
      <div className="grid sm:grid-cols-2">
        <div className="p-4">
          <p className={`text-xs ${insolvent ? "text-danger" : "text-muted"}`}>
            Operating, Ramp Checking ··4417
            {insolvent ? ", frozen by the administrator" : ""}
          </p>
          <Money
            cents={operating}
            className={`mt-1 block text-[28px] font-medium ${insolvent ? "text-faint line-through" : ""}`}
          />
          <p
            className={`mt-1 text-xs ${insolvent ? "text-danger" : "text-muted"}`}
          >
            {insolvent ? (
              <>
                Gallery insolvent. Creditors claimed{" "}
                <Money cents={gallery.claimedByCreditorsCents ?? 0} />.
              </>
            ) : (
              "What the gallery can spend on rent, payroll, and shows."
            )}
          </p>
        </div>
        <div className="border-t border-line bg-trust-soft/60 p-4 sm:border-t-0 sm:border-l">
          <p className="text-xs text-trust">
            Artist trust, Ramp Checking ··4425
          </p>
          <Money
            cents={trust}
            className="mt-1 block text-[28px] font-medium text-trust"
          />
          {byArtist.length === 0 ? (
            <p className="mt-1 text-xs text-trust/80">
              Nothing held right now. Every artist is paid up.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-xs text-trust/90">
              {byArtist.map(({ artist, cents }) => (
                <li key={artist.id} className="flex justify-between gap-4">
                  <span>{artist.name}</span>
                  <Money cents={cents} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function Ledger({
  snapshot,
  limit = 8,
  artistId,
}: {
  snapshot: Snapshot;
  limit?: number;
  artistId?: string;
}) {
  const rows = ledgerFor(snapshot, snapshot.galleries[0].id)
    .filter((r) => !artistId || r.artistId === artistId)
    .slice(0, limit);
  // Rows already on screen at first render stay still; later ones flash once.
  const [initial] = useState(() => new Set(rows.map((r) => r.id)));

  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted">No money has moved yet.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] text-muted">
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="py-2 font-medium">Transaction</th>
            <th className="py-2 pl-4 text-right font-medium">Amount</th>
            <th className="py-2 pl-4 text-right font-medium">To trust</th>
            <th className="py-2 pr-4 pl-4 text-right font-medium">
              To operating
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-line/70 last:border-0 ${initial.has(r.id) ? "" : "flash"}`}
            >
              <td className="num px-4 py-2 align-top text-[11px] whitespace-nowrap text-muted">
                {stamp(r.at)}
              </td>
              <td className="py-2 pr-3 align-top">
                <p>{r.description}</p>
                <p className="text-[11px] text-muted">
                  {r.counterparty}{" "}
                  <span className="num text-faint">{ref(r.id)}</span>
                </p>
              </td>
              <td className="py-2 pl-4 text-right align-top">
                <Money cents={r.amountCents} signed />
              </td>
              <td className="py-2 pl-4 text-right align-top text-trust">
                {r.trustCents === 0 ? (
                  <span className="text-faint">0.00</span>
                ) : (
                  <Money cents={r.trustCents} signed />
                )}
              </td>
              <td className="py-2 pr-4 pl-4 text-right align-top">
                {r.operatingCents === 0 ? (
                  <span className="text-faint">0.00</span>
                ) : (
                  <Money cents={r.operatingCents} signed />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
