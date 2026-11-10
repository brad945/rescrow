"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Money, Swatch } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { artistTotals } from "@/lib/escrow/engine";

export default function ArtistsPage() {
  const { snapshot, error } = useSnapshot();
  return (
    <>
      <Nav rampConnected={snapshot?.galleries[0]?.rampConnected} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-muted">Artist portal</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Who are you?
          </h1>
          <p className="mt-2 max-w-xl text-muted">
            Each artist gets their own view of what sold, what is locked for
            them, and when it pays out. No more waiting on the gallery to tell
            them.
          </p>
        </div>
        {!snapshot && <p className="text-muted">{error ?? "Loading…"}</p>}
        <div className="grid gap-4 md:grid-cols-3">
          {snapshot?.artists.map((artist) => {
            const totals = artistTotals(snapshot, artist.id);
            const works = snapshot.artworks.filter(
              (w) => w.artistId === artist.id,
            );
            return (
              <Link
                key={artist.id}
                href={`/artist/${artist.id}`}
                className="group rounded-lg border border-line bg-card p-5 transition hover:border-ink/40"
              >
                <div className="flex gap-1.5">
                  {works.map((w) => (
                    <Swatch key={w.id} artwork={w} size={44} />
                  ))}
                </div>
                <p className="mt-4 font-serif text-xl font-semibold">
                  {artist.name}
                </p>
                <p className="text-sm text-muted">{artist.email}</p>
                <div className="mt-4 flex gap-6 text-sm">
                  <div>
                    <Money
                      cents={totals.heldCents}
                      className="text-lg font-semibold text-lock"
                    />
                    <p className="text-xs text-muted">locked for them</p>
                  </div>
                  <div>
                    <Money
                      cents={totals.paidCents}
                      className="text-lg font-semibold text-paid"
                    />
                    <p className="text-xs text-muted">paid out</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium group-hover:underline">
                  Open portal
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
