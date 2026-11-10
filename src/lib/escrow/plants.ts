// Ways to cheat the books, for /lab's "Try to break the books".
//
// Each plant corrupts a snapshot the way a careless or dishonest edit would,
// and says which break reconcile() must report. Plants run only on a copy
// made by breakOnCopy(): nothing here is wired to a route or the store (an
// architecture test pins that the only importer is the /lab component), so
// the gallery's real books can't be touched.
//
// Unlike the fixed catalogue in reconcile.test.ts, these work on whatever
// state the demo is in: each finds its target by kind, says when it doesn't
// apply, and builds its expected break from the record it changed.
import type { EscrowHold, Reconciliation, Snapshot } from "@/types";
import { reconcile } from "./reconcile";

export interface Plant {
  id: string;
  name: string;
  /** null if the plant applies to this snapshot, else why it doesn't. */
  when(s: Snapshot, galleryId: string): string | null;
  /** Corrupts s in place (always a copy). */
  plant(s: Snapshot, galleryId: string): void;
  /** The break reconcile() must report. */
  expect: RegExp;
}

const locked = (s: Snapshot, g: string) =>
  s.holds.filter((h) => h.galleryId === g && h.status === "locked");

/** Two locked holds of the same sale: the cent-shift needs a neighbour. */
function pairOnOneSale(
  s: Snapshot,
  g: string,
): [EscrowHold, EscrowHold] | null {
  const bySale = new Map<string, EscrowHold[]>();
  for (const h of locked(s, g)) {
    bySale.set(h.saleId, [...(bySale.get(h.saleId) ?? []), h]);
  }
  for (const hs of bySale.values()) if (hs.length >= 2) return [hs[0], hs[1]];
  return null;
}

export const PLANTS: Plant[] = [
  {
    id: "shift-cent",
    name: "Move one cent between two of an artist's shares (every total still matches)",
    when: (s, g) =>
      pairOnOneSale(s, g)
        ? null
        : "needs two shares of one sale in trust (after payment 2)",
    plant: (s, g) => {
      const [a, b] = pairOnOneSale(s, g)!;
      a.amountCents += 1;
      b.amountCents -= 1;
    },
    expect: /Payment \d+ on .* put .* in trust; its running-total share is/,
  },
  {
    id: "cent-operating",
    name: "Slip one cent into the gallery's operating balance",
    when: () => null,
    plant: (s, g) => {
      s.galleries.find((x) => x.id === g)!.operatingBalanceCents += 1;
    },
    expect: /Operating balance is .* but the records add up to/,
  },
  {
    id: "skim-trust",
    name: "Skim one cent off a share held in trust",
    when: (s, g) => (locked(s, g).length ? null : "needs money in trust"),
    plant: (s, g) => {
      locked(s, g)[0].amountCents -= 1;
    },
    expect: /came in but .* is accounted for/,
  },
  {
    id: "paid-no-payout",
    name: "Mark a share as paid to the artist without paying them",
    when: (s, g) => (locked(s, g).length ? null : "needs money in trust"),
    plant: (s, g) => {
      locked(s, g)[0].status = "paid";
    },
    expect: /Payouts total .* but paid trust holds total/,
  },
  {
    id: "relabel-hold",
    name: "Relabel a share in trust as another artist's",
    when: (s, g) => (locked(s, g).length ? null : "needs money in trust"),
    plant: (s, g) => {
      const h = locked(s, g)[0];
      h.artistId = s.artists.find((a) => a.id !== h.artistId)!.id;
    },
    expect: /doesn't match its sale's artist or gallery/,
  },
  {
    id: "inflate-payout",
    name: "Inflate a payout to an artist by one cent",
    when: (s, g) =>
      s.payouts.some((p) => p.galleryId === g) ? null : "needs a payout",
    plant: (s, g) => {
      s.payouts.find((p) => p.galleryId === g)!.amountCents += 1;
    },
    expect: /Payout .* is .* but its holds total/,
  },
  {
    id: "ghost-payment",
    name: "Record a buyer payment that never split",
    when: (s, g) =>
      s.payments.some((p) => p.galleryId === g) ? null : "needs a payment",
    plant: (s, g) => {
      const p = s.payments.filter((x) => x.galleryId === g).at(-1)!;
      s.payments.push({
        ...p,
        id: "pay_ghost",
        rampTransactionId: "rtx_ghost",
      });
    },
    expect: /Payment pay_ghost has 0 trust holds/,
  },
  {
    id: "double-book",
    name: "Book the same bank transaction twice",
    when: (s, g) =>
      s.payments.filter((p) => p.galleryId === g).length >= 2
        ? null
        : "needs two payments",
    plant: (s, g) => {
      const [a, b] = s.payments.filter((p) => p.galleryId === g).slice(-2);
      b.rampTransactionId = a.rampTransactionId;
    },
    expect: /was booked 2 times/,
  },
  {
    id: "edit-journal",
    name: "Edit one journal entry after it was posted",
    when: (s) => (s.journal.length ? null : "needs a journal entry"),
    plant: (s) => {
      s.journal.at(-1)!.postings[0].cents -= 1;
    },
    expect: /Journal entry .* sums to -1, not zero/,
  },
  {
    id: "trust-sideways",
    name: "Move trust from one artist to another in the journal only",
    when: (s, g) => (locked(s, g).length ? null : "needs money in trust"),
    plant: (s, g) => {
      const h = locked(s, g)[0];
      const other = s.artists.find((a) => a.id !== h.artistId)!.id;
      s.journal.push({
        id: "je_plant",
        at: s.journal.at(-1)?.at ?? "",
        code: "TRANSFER",
        postings: [
          { account: `trust:${g}:${h.artistId}`, cents: -100 },
          { account: `trust:${g}:${other}`, cents: 100 },
        ],
        ref: null,
      });
    },
    expect: /Journal trust for .* but the records say/,
  },
  {
    id: "backdate-closed",
    name: "Slip an entry into a month that was already closed",
    when: (s, g) =>
      (s.closedPeriods ?? []).some((c) => c.galleryId === g)
        ? null
        : "needs a closed month (close one on /books)",
    plant: (s, g) => {
      const c = (s.closedPeriods ?? []).find((x) => x.galleryId === g)!;
      s.journal.push({
        id: "je_backdated",
        at: c.through.slice(0, 10) + "T00:00:00.000Z",
        code: "TRANSFER",
        postings: [
          { account: `operating:${g}`, cents: -1 },
          { account: `creditors:${g}`, cents: 1 },
        ],
        ref: null,
      });
    },
    expect: /Books closed for .* the journal now shows/,
  },
];

export interface BreakResult {
  before: Reconciliation;
  after: Reconciliation | null;
  /** Whether reconcile() named the expected break. */
  caught: boolean;
  error: string | null;
}

/** Applies one plant to a copy and reconciles before and after. Never touches s. */
export function breakOnCopy(
  s: Snapshot,
  galleryId: string,
  plantId: string,
): BreakResult {
  const before = reconcile(s, galleryId);
  const plant = PLANTS.find((p) => p.id === plantId);
  if (!plant) {
    return { before, after: null, caught: false, error: `No plant ${plantId}` };
  }
  const why = plant.when(s, galleryId);
  if (why) return { before, after: null, caught: false, error: why };
  try {
    const copy = structuredClone(s);
    plant.plant(copy, galleryId);
    const after = reconcile(copy, galleryId);
    return {
      before,
      after,
      caught: !after.balanced && plant.expect.test(after.breaks.join("\n")),
      error: null,
    };
  } catch (err) {
    return {
      before,
      after: null,
      caught: false,
      error: (err as Error).message,
    };
  }
}
