"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import type { Snapshot } from "@/types";
import { ARTIST, AGREEMENT, WORK, stepFor } from "@/components/story";
import { AgreementText } from "@/components/AgreementText";
import { ArtworkImage } from "@/components/ArtworkImage";
import { GalleryBalances, Ledger } from "@/components/GalleryAccount";
import { Money, stamp } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { useTween } from "@/components/useTween";
import { artistTotals, paidSoFar } from "@/lib/escrow/engine";

export default function PresentPage() {
  const { snapshot, error, busy, act } = useSnapshot();
  const step = snapshot ? stepFor(snapshot) : null;

  const next = useCallback(() => {
    if (step?.next && !busy) void act(step.next.path, step.next.body);
  }, [step, busy, act]);
  const reset = useCallback(() => {
    if (!busy) void act("/api/demo/reset");
  }, [busy, act]);
  const cancel = useCallback(() => {
    const sale = snapshot?.sales.filter((x) => x.artworkId === WORK).at(-1);
    if (step?.canCancel && sale && !busy)
      void act("/api/demo/cancel", { saleId: sale.id });
  }, [snapshot, step, busy, act]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "r" || e.key === "R") {
        reset();
      } else if (e.key === "c" || e.key === "C") {
        cancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, reset, cancel]);

  if (!snapshot || !step) {
    return (
      <main className="p-6 text-sm text-muted">{error ?? "Loading…"}</main>
    );
  }

  const agreement = snapshot.agreements.find((a) => a.id === AGREEMENT)!;
  const showAgreement = step.index <= 1;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-card px-6 py-2.5">
        <span className="text-[15px] font-semibold tracking-tight">
          Rescrow
        </span>
        <span className="text-sm text-muted">Lowline Gallery, New York</span>
        <ol className="ml-4 hidden gap-1 md:flex" aria-label="Progress">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li
              key={i}
              className={`h-1 w-6 rounded-sm ${i <= step.index && step.index !== 6 ? "bg-ink" : step.index === 6 && i <= 3 ? "bg-faint" : "bg-line"}`}
            />
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <Link href="/gallery" className="hover:text-ink">
            Exit
          </Link>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded border border-line px-2 py-1 hover:text-ink disabled:opacity-40"
          >
            Reset <kbd className="num text-faint">R</kbd>
          </button>
        </div>
      </header>

      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs text-muted">
                {step.index === 6
                  ? "Alternate ending"
                  : `Step ${step.index + 1} of 6`}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {step.title}
              </h1>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/80">
                {step.caption}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {step.canCancel && (
                <button
                  type="button"
                  onClick={cancel}
                  disabled={busy}
                  className="rounded border border-line bg-card px-3 py-2 text-sm text-muted hover:text-danger disabled:opacity-40"
                >
                  Buyer cancels <kbd className="num text-faint">C</kbd>
                </button>
              )}
              {step.next ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={busy}
                  className="rounded bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy && step.index === 0
                    ? "Agent reading…"
                    : step.next.label}{" "}
                  <kbd className="num text-white/50">→</kbd>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="rounded border border-ink px-4 py-2 text-sm font-medium"
                >
                  Run it again
                </button>
              )}
            </div>
          </section>

          {error && (
            <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {showAgreement ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
              <div className="rounded-md border border-line bg-card p-5">
                <p className="mb-3 text-xs text-muted">
                  Consignment agreement, Lowline Gallery and Ines Duarte
                </p>
                <AgreementText
                  text={agreement.text}
                  citations={agreement.terms?.citations ?? []}
                  active={!!agreement.terms}
                />
              </div>
              <div className="rounded-md border border-line bg-card p-5 text-sm">
                <p className="text-xs text-muted">What the agent extracted</p>
                {agreement.terms ? (
                  <dl className="mt-3 space-y-3">
                    <div>
                      <dt className="text-[11px] text-muted">Artist share</dt>
                      <dd className="num text-2xl text-trust">
                        {agreement.terms.artistShareBps / 100}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">
                        Pay artist within
                      </dt>
                      <dd className="num text-2xl">
                        {agreement.terms.payoutDays} days
                      </dd>
                    </div>
                    {agreement.terms.notes.map((n) => (
                      <dd key={n} className="text-[13px] text-ink/80">
                        {n}
                      </dd>
                    ))}
                    <dd className="pt-2 text-[11px] text-faint">
                      Every number is backed by a highlighted quote. If the
                      agent can&apos;t quote it, Rescrow doesn&apos;t use it.
                    </dd>
                  </dl>
                ) : (
                  <p className="mt-3 text-muted">
                    {busy ? "Reading…" : "Not read yet."}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <GalleryBalances snapshot={snapshot} />
              <section className="rounded-md border border-line bg-card">
                <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
                  Account activity
                </h2>
                <Ledger snapshot={snapshot} limit={6} />
              </section>
            </>
          )}
        </div>

        <Phone snapshot={snapshot} />
      </main>
    </div>
  );
}

function Phone({ snapshot }: { snapshot: Snapshot }) {
  const artist = snapshot.artists.find((a) => a.id === ARTIST)!;
  const totals = artistTotals(snapshot, ARTIST);
  const held = useTween(totals.heldCents);
  const paid = useTween(totals.paidCents);
  const work = snapshot.artworks.find((w) => w.id === WORK)!;
  const sale = snapshot.sales.filter((x) => x.artworkId === WORK).at(-1);
  const count = sale
    ? snapshot.payments.filter((p) => p.saleId === sale.id).length
    : 0;
  const received = sale ? paidSoFar(snapshot, sale.id) : 0;
  const payout = snapshot.payouts.filter((p) => p.artistId === ARTIST).at(-1);
  const feed = snapshot.activity
    .filter((a) => a.artistId === ARTIST)
    .slice(0, 4);

  return (
    <aside className="mx-auto w-full max-w-[380px]">
      <div className="rounded-[44px] border-[10px] border-ink bg-ink shadow-xl">
        <div className="relative h-[720px] overflow-hidden rounded-[34px] bg-paper">
          <div className="flex justify-between px-7 pt-3 text-[11px] font-medium">
            <span className="num">9:41</span>
            <span className="h-5 w-20 rounded-full bg-ink" />
            <span>5G</span>
          </div>
          <div className="space-y-3 px-5 pt-4">
            <div>
              <p className="text-[11px] text-muted">Rescrow for artists</p>
              <p className="text-lg font-semibold">{artist.name}</p>
            </div>

            <div className="rounded-xl bg-trust px-4 py-3 text-white">
              <p className="text-[11px] text-white/70">Held for you</p>
              <Money cents={held} className="block text-3xl font-medium" />
              <p className="mt-1 text-[11px] leading-snug text-white/70">
                In trust at Lowline Gallery. Not the gallery&apos;s money, even
                if it closes.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
              <span className="text-[13px] text-muted">Paid to you</span>
              <Money cents={paid} className="text-lg font-medium" />
            </div>

            <div className="flex gap-3 rounded-xl bg-card p-3">
              <ArtworkImage artwork={work} size={56} />
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="font-medium">{work.title}</p>
                {sale && sale.status !== "cancelled" ? (
                  <>
                    <p className="text-muted">
                      Sold to {sale.buyerName}, {count} of {sale.installments}{" "}
                      paid
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      {Array.from({ length: sale.installments }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-sm ${i < count ? "bg-trust" : "bg-line"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      Buyer has paid <Money cents={received} />
                    </p>
                  </>
                ) : (
                  <p className="text-muted">
                    {sale
                      ? "Sale cancelled. Back with the gallery."
                      : "On the wall at Lowline"}
                  </p>
                )}
              </div>
            </div>

            {payout && sale?.status === "paid" && (
              <Link
                href={`/artist/${ARTIST}/statements/${payout.id}`}
                className="slide-in block rounded-xl border border-trust/30 bg-trust-soft px-4 py-3 text-[13px] text-trust"
              >
                <span className="font-medium">
                  <Money cents={payout.amountCents} /> sent to your bank
                </span>
                <span className="block text-[11px]">
                  {stamp(payout.paidAt)}. View statement
                </span>
              </Link>
            )}

            <div>
              <p className="mb-1 text-[11px] text-muted">Notifications</p>
              <ul className="space-y-1.5">
                {feed.map((a, i) => (
                  <li
                    key={a.id}
                    className={`rounded-lg bg-card px-3 py-2 text-[12px] leading-snug ${i === 0 ? "slide-in" : ""}`}
                  >
                    {a.message}
                    <span className="num block text-[10px] text-faint">
                      {stamp(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
