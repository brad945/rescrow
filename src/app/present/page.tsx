"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EscrowHold, Snapshot } from "@/types";
import {
  ARTIST,
  AGREEMENT,
  GALLERY,
  WORK,
  demoDays,
  stepFor,
} from "@/components/story";
import {
  AgentPanel,
  idleRun,
  reduceRun,
  type AgentRun,
} from "@/components/AgentPanel";
import { AgreementText } from "@/components/AgreementText";
import { ArtworkImage } from "@/components/ArtworkImage";
import { GalleryBalances, Ledger } from "@/components/GalleryAccount";
import { TrustProof } from "@/components/TrustProof";
import { Money, shortDate, stamp } from "@/components/ui";
import { useSnapshot } from "@/components/useSnapshot";
import { useTween } from "@/components/useTween";
import { artistTotals, paidSoFar } from "@/lib/escrow/engine";

export default function PresentPage() {
  const { snapshot, error, busy, act, actStream } = useSnapshot();
  const step = snapshot ? stepFor(snapshot) : null;
  // The title card shows before step 1 and is purely local to this screen.
  const [intro, setIntro] = useState(true);
  const [run, setRun] = useState<AgentRun>(idleRun);
  const onIntro = intro && step?.index === 0;

  // Load the model while the title card is up, so the read on camera is fast.
  useEffect(() => {
    void fetch("/api/agent/warm", { method: "POST" }).catch((err) =>
      console.error("warm failed", err),
    );
  }, []);

  const next = useCallback(() => {
    if (busy || !step) return;
    if (onIntro) {
      setIntro(false);
      return;
    }
    if (!step.next) return;
    if (step.index === 0) {
      setRun({ ...idleRun, status: "running", startedAt: Date.now() });
      void actStream(`${step.next.path}?stream=1`, step.next.body, (event) =>
        setRun((r) => reduceRun(r, event)),
      );
      return;
    }
    // Switching to the reviewed terms replaces the live run on screen.
    if (step.next.path === "/api/agent/read") setRun(idleRun);
    void act(step.next.path, step.next.body);
  }, [step, busy, act, actStream, onIntro]);
  const reset = useCallback(() => {
    if (busy) return;
    setIntro(true);
    setRun(idleRun);
    void act("/api/demo/reset");
  }, [busy, act]);
  const cancel = useCallback(() => {
    const sale = snapshot?.sales.filter((x) => x.artworkId === WORK).at(-1);
    if (step?.canCancel && sale && !busy)
      void act("/api/demo/cancel", { saleId: sale.id });
  }, [snapshot, step, busy, act]);
  const redeliver = useCallback(() => {
    if (step?.redeliver && !busy)
      void act(step.redeliver.path, step.redeliver.body);
  }, [step, busy, act]);

  const advance = useCallback(() => {
    if (step?.advance && !busy) void act(step.advance.path, step.advance.body);
  }, [step, busy, act]);

  const attempt = useCallback(() => {
    if (step?.attempt && !busy) void act(step.attempt.path, step.attempt.body);
  }, [step, busy, act]);

  const fail = useCallback(() => {
    if (step?.canFail && !busy)
      void act("/api/demo/insolvency", { galleryId: GALLERY });
  }, [step, busy, act]);

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
      } else if (e.key === "b" || e.key === "B") {
        fail();
      } else if (e.key === "g" || e.key === "G") {
        attempt();
      } else if (e.key === "t" || e.key === "T") {
        advance();
      } else if (e.key === "d" || e.key === "D") {
        redeliver();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, reset, cancel, fail, attempt, advance, redeliver]);

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
              className={`h-1 w-6 rounded-sm ${step.index >= 6 ? (i <= 3 ? "bg-faint" : "bg-line") : i <= step.index ? "bg-ink" : "bg-line"}`}
            />
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          {demoDays(snapshot) > 0 && (
            <span className="num rounded border border-ink/20 bg-card px-2 py-1 text-ink">
              Demo clock +{demoDays(snapshot)} days
            </span>
          )}
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
          {onIntro ? (
            <Intro onStart={next} />
          ) : (
            <>
              <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-xs text-muted">
                    {step.index >= 6
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
                  {step.advance && (
                    <button
                      type="button"
                      onClick={advance}
                      disabled={busy}
                      className="rounded border border-line bg-card px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-40"
                    >
                      {step.advance.label}{" "}
                      <kbd className="num text-faint">T</kbd>
                    </button>
                  )}
                  {step.attempt && (
                    <button
                      type="button"
                      onClick={attempt}
                      disabled={busy}
                      className="rounded border border-line bg-card px-3 py-2 text-sm text-muted hover:text-danger disabled:opacity-40"
                    >
                      Gallery tries to spend trust{" "}
                      <kbd className="num text-faint">G</kbd>
                    </button>
                  )}
                  {step.canFail && (
                    <button
                      type="button"
                      onClick={fail}
                      disabled={busy}
                      className="rounded border border-line bg-card px-3 py-2 text-sm text-muted hover:text-danger disabled:opacity-40"
                    >
                      Gallery goes under <kbd className="num text-faint">B</kbd>
                    </button>
                  )}
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
                <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
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
                  <AgentPanel
                    run={run}
                    terms={agreement.terms}
                    source={agreement.termsSource}
                  />
                </div>
              ) : (
                <>
                  <TrustProof snapshot={snapshot} />
                  <GalleryBalances snapshot={snapshot} />
                  <section className="rounded-md border border-line bg-card">
                    <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
                      Account activity
                    </h2>
                    <Ledger snapshot={snapshot} limit={6} />
                  </section>
                </>
              )}
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
  const gallery = snapshot.galleries.find((g) => g.id === GALLERY)!;
  const failed = gallery.status === "insolvent";
  // Earliest date the agreement lets the gallery hold any of Ines's share.
  const dueBy = snapshot.holds
    .filter((h) => h.artistId === ARTIST && h.status === "locked" && h.dueBy)
    .map((h) => h.dueBy!)
    .sort()[0];
  const locked = snapshot.holds
    .filter((h) => h.artistId === ARTIST && h.status === "locked" && h.dueBy)
    .sort((a, b) => a.lockedAt.localeCompare(b.lockedAt));
  const showPayout =
    payout &&
    (sale?.status === "paid" ||
      payout.reason === "deadline" ||
      (failed &&
        !!gallery.insolventAt &&
        payout.paidAt >= gallery.insolventAt));

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
              {dueBy && (
                <p className="num mt-1 text-[11px] text-white">
                  Paid to you by {shortDate(dueBy)} at the latest, per your
                  agreement
                </p>
              )}
              {locked.length > 0 && (
                <DeadlineBars
                  holds={locked}
                  offsetMs={snapshot.clockOffsetMs ?? 0}
                />
              )}
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

            {failed && (
              <p className="slide-in rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-[12px] text-danger">
                Lowline Gallery has entered insolvency. Your share was held in
                trust, so it was paid to you, not to creditors.
              </p>
            )}

            {showPayout && payout && (
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
                    className={`rounded-lg px-3 py-2 text-[12px] leading-snug ${a.kind === "trust_move_refused" ? "border border-danger/30 bg-danger/5" : a.kind === "feed_duplicate" ? "border border-line bg-paper text-muted" : "bg-card"} ${i === 0 ? "slide-in" : ""}`}
                  >
                    {a.kind === "feed_duplicate" && (
                      <span className="mb-0.5 block text-[10px] font-semibold tracking-wide uppercase">
                        Duplicate ignored
                      </span>
                    )}
                    {a.kind === "trust_move_refused" && (
                      <span className="mb-0.5 block text-[10px] font-semibold tracking-wide text-danger uppercase">
                        Blocked by Rescrow
                      </span>
                    )}
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

/** One bar per locked share: how far it is from locked to its payout deadline. */
function DeadlineBars({
  holds,
  offsetMs,
}: {
  holds: EscrowHold[];
  offsetMs: number;
}) {
  const [wall, setWall] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setWall(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const now = wall + offsetMs;
  return (
    <ul className="mt-2 space-y-1.5">
      {holds.map((h) => {
        const start = Date.parse(h.lockedAt);
        const end = Date.parse(h.dueBy!);
        const done = Math.min(1, Math.max(0, (now - start) / (end - start)));
        const left = Math.max(0, Math.ceil((end - now) / 86_400_000));
        return (
          <li key={h.id} className="text-[10px] text-white/80">
            <div className="num flex justify-between">
              <Money cents={h.amountCents} />
              <span>
                {left === 0 ? "due today" : `${left} days to deadline`}
              </span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-white/20">
              <div
                className="h-1 rounded-full bg-white"
                style={{ width: `${Math.round(done * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex min-h-[560px] flex-col justify-center gap-6 rounded-md border border-line bg-card px-10 py-12">
      <p className="text-xs text-muted">The Art Newspaper, April 30, 2026</p>
      <p className="font-doc max-w-2xl text-[28px] leading-snug">
        In February, Stephen Friedman Gallery in London went into administration
        owing Kehinde Wiley <span className="num text-danger">£163,849</span>.
        Creditors expect about eight pence on the pound.
      </p>
      <p className="max-w-xl text-[15px] leading-relaxed text-ink/80">
        In New York, an artist&apos;s share of a sale is legally trust money.
        Nothing makes the gallery keep it apart from rent and payroll. Rescrow
        does: the artist&apos;s share of every payment is held in trust the
        moment the buyer pays, and released to the artist the day the sale is
        paid in full.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="self-start rounded bg-ink px-4 py-2 text-sm font-medium text-white"
      >
        See it run <kbd className="num text-white/50">→</kbd>
      </button>
    </section>
  );
}
