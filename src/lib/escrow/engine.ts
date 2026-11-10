import type {
  Activity,
  Gallery,
  Timestamp,
  ActivityKind,
  AgreementTerms,
  Cents,
  EscrowHold,
  Id,
  PaymentMethod,
  Payout,
  Sale,
  Snapshot,
  TrustMoveRequest,
} from "@/types";
import { formatCents, methodLabel, shareOf } from "@/lib/money";

// Pure escrow rules. Each function returns a new snapshot and never mutates
// its input, so routes can load, apply, and save.

import { EscrowError, LedgerRejected } from "./errors";
import { acct, entry, post, postTrustRelease } from "./journal";
export { EscrowError, LedgerRejected } from "./errors";

export interface Clock {
  now: () => string;
  id: (prefix: string) => Id;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  id: (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`,
};

function find<T extends { id: Id }>(items: T[], id: Id, label: string): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw new EscrowError(`${label} ${id} not found`);
  return item;
}

function log(
  s: Snapshot,
  clock: Clock,
  kind: ActivityKind,
  message: string,
  extra: Partial<Pick<Activity, "galleryId" | "artistId" | "amountCents">> = {},
): void {
  s.activity.unshift({
    id: clock.id("act"),
    kind,
    at: clock.now(),
    galleryId: extra.galleryId ?? null,
    artistId: extra.artistId ?? null,
    message,
    amountCents: extra.amountCents ?? null,
  });
}

export function termsFor(s: Snapshot, artistId: Id): AgreementTerms {
  const agreement = s.agreements.find((a) => a.artistId === artistId);
  if (!agreement) {
    throw new EscrowError(`No consignment agreement on file for ${artistId}`);
  }
  if (!agreement.terms) {
    throw new EscrowError(
      `Agreement ${agreement.id} has not been read by the agent yet`,
    );
  }
  const failed = agreement.terms.checks?.filter((c) => !c.ok) ?? [];
  if (failed.length > 0) {
    throw new EscrowError(
      `Agreement ${agreement.id} needs a person to confirm: ${failed.map((c) => c.label.toLowerCase()).join("; ")}`,
    );
  }
  return agreement.terms;
}

/** Refuses any change at a gallery that has gone insolvent. */
function assertActive(gallery: Gallery): void {
  if (gallery.status === "insolvent") {
    throw new EscrowError(
      `${gallery.name} is insolvent; sales and refunds now go through its administrator`,
    );
  }
}

function addDays(iso: Timestamp, days: number): Timestamp {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

/**
 * The only way money leaves the artist trust. It can go to the artist or back
 * to the buyer who paid it, and nowhere else: not to the gallery's operating
 * account, not to its creditors. Mutates s; returns the total released.
 */
export function releaseTrust(
  s: Snapshot,
  holds: EscrowHold[],
  to: "artist" | "buyer",
  clock: Clock,
): Cents {
  if (to !== "artist" && to !== "buyer") {
    throw new EscrowError(
      `Trust funds can only go to the artist or back to the buyer, not to ${String(to)}`,
    );
  }
  const at = clock.now();
  const live = holds.map((h) => {
    const found = s.holds.find((x) => x.id === h.id);
    if (!found || found.status !== "locked") {
      throw new EscrowError(`Hold ${h.id} is not in trust`);
    }
    return found;
  });
  if (live.length === 0) return 0;

  // One journal entry for the whole release: each trust account pays its own
  // artist, or back to the buyer of each sale. The journal's account rules
  // check this independently of the test above.
  const postings = new Map<string, number>();
  const add = (account: string, cents: number) =>
    postings.set(account, (postings.get(account) ?? 0) + cents);
  for (const h of live) {
    add(acct.trust(h.galleryId, h.artistId), -h.amountCents);
    add(
      to === "artist"
        ? acct.artist(h.galleryId, h.artistId)
        : acct.buyer(h.galleryId, h.saleId),
      h.amountCents,
    );
  }
  postTrustRelease(
    s,
    entry(
      clock.id("je"),
      at,
      to === "artist" ? "TRUST_TO_ARTIST" : "TRUST_TO_BUYER",
      [...postings].map(([account, cents]) => ({ account, cents })),
      live[0].saleId,
    ),
  );

  let total = 0;
  for (const h of live) {
    h.status = to === "artist" ? "paid" : "refunded";
    h.releasedAt = at;
    total += h.amountCents;
  }
  return total;
}

/** Releases one sale's holds to its artist and records a single payout. Mutates s. */
function payOut(
  s: Snapshot,
  holds: EscrowHold[],
  clock: Clock,
  kind: "payout_sent" | "deadline_payout",
  reason: string,
  why: NonNullable<Payout["reason"]>,
): void {
  if (holds.length === 0) return;
  const sale = find(s.sales, holds[0].saleId, "Sale");
  const artist = find(s.artists, sale.artistId, "Artist");
  const artwork = find(s.artworks, sale.artworkId, "Artwork");
  const total = releaseTrust(s, holds, "artist", clock);
  s.payouts.push({
    id: clock.id("po"),
    artistId: artist.id,
    galleryId: sale.galleryId,
    amountCents: total,
    holdIds: holds.map((h) => h.id),
    paidAt: clock.now(),
    reason: why,
  });
  log(
    s,
    clock,
    kind,
    `Paid ${artist.name} ${formatCents(total)} for ${artwork.title}${reason}`,
    { galleryId: sale.galleryId, artistId: artist.id, amountCents: total },
  );
}

function groupBySale(holds: EscrowHold[]): EscrowHold[][] {
  const groups = new Map<Id, EscrowHold[]>();
  for (const h of holds) {
    groups.set(h.saleId, [...(groups.get(h.saleId) ?? []), h]);
  }
  return [...groups.values()];
}

export function paidSoFar(s: Snapshot, saleId: Id): Cents {
  return s.payments
    .filter((p) => p.saleId === saleId)
    .reduce((sum, p) => sum + p.amountCents, 0);
}

/** Amount of the next installment: remaining balance spread over remaining installments. */
export function nextInstallment(s: Snapshot, sale: Sale): Cents {
  const paid = paidSoFar(s, sale.id);
  const count = s.payments.filter((p) => p.saleId === sale.id).length;
  const remainingInstallments = Math.max(1, sale.installments - count);
  return Math.ceil((sale.priceCents - paid) / remainingInstallments);
}

/**
 * The artist's share of a payment that is about to land. Rounds on the running
 * total so every installment's share adds up to exactly the artist's share of
 * the full price, with no stray cents.
 */
export function artistShareOfPayment(
  s: Snapshot,
  sale: Sale,
  amountCents: Cents,
): Cents {
  const before = paidSoFar(s, sale.id);
  return (
    shareOf(before + amountCents, sale.artistShareBps) -
    shareOf(before, sale.artistShareBps)
  );
}

export function createSale(
  input: Snapshot,
  args: { artworkId: Id; buyerName: string; installments: number },
  clock: Clock = systemClock,
): { snapshot: Snapshot; sale: Sale } {
  const s = structuredClone(input);
  const artwork = find(s.artworks, args.artworkId, "Artwork");
  assertActive(find(s.galleries, artwork.galleryId, "Gallery"));
  if (artwork.status !== "consigned") {
    throw new EscrowError(`${artwork.title} is not available for sale`);
  }
  if (!Number.isInteger(args.installments) || args.installments < 1) {
    throw new EscrowError("Installments must be a whole number of at least 1");
  }
  const terms = termsFor(s, artwork.artistId);

  const sale: Sale = {
    id: clock.id("sale"),
    artworkId: artwork.id,
    galleryId: artwork.galleryId,
    artistId: artwork.artistId,
    buyerName: args.buyerName.trim() || "Private collector",
    priceCents: artwork.priceCents,
    installments: args.installments,
    artistShareBps: terms.artistShareBps,
    payoutDays: terms.payoutDays,
    status: "open",
    createdAt: clock.now(),
  };
  s.sales.push(sale);
  artwork.status = "sold";

  const plan =
    sale.installments === 1
      ? "paid in full"
      : `${sale.installments} installments`;
  log(
    s,
    clock,
    "sale_created",
    `${sale.buyerName} bought ${artwork.title} for ${formatCents(sale.priceCents)}, ${plan}`,
    {
      galleryId: sale.galleryId,
      artistId: sale.artistId,
      amountCents: sale.priceCents,
    },
  );
  return { snapshot: s, sale };
}

export function receivePayment(
  input: Snapshot,
  args: { saleId: Id; amountCents?: Cents; method?: PaymentMethod },
  clock: Clock = systemClock,
): { snapshot: Snapshot; hold: EscrowHold } {
  const s = structuredClone(input);
  const sale = find(s.sales, args.saleId, "Sale");
  assertActive(find(s.galleries, sale.galleryId, "Gallery"));
  if (sale.status !== "open") {
    throw new EscrowError(`Sale ${sale.id} is ${sale.status}`);
  }
  const remaining = sale.priceCents - paidSoFar(s, sale.id);
  const amount = args.amountCents ?? nextInstallment(s, sale);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new EscrowError("Payment amount must be a positive number of cents");
  }
  if (amount > remaining) {
    throw new EscrowError(
      `Payment of ${formatCents(amount)} is more than the ${formatCents(remaining)} still owed`,
    );
  }

  const artwork = find(s.artworks, sale.artworkId, "Artwork");
  const artist = find(s.artists, sale.artistId, "Artist");
  const gallery = find(s.galleries, sale.galleryId, "Gallery");
  const method = args.method ?? "wire";
  const at = clock.now();

  const payment = {
    id: clock.id("pay"),
    saleId: sale.id,
    galleryId: gallery.id,
    amountCents: amount,
    method,
    receivedAt: at,
  };
  // Share is computed before the payment is recorded (it rounds on the running total).
  const artistShare = artistShareOfPayment(s, sale, amount);
  s.payments.push(payment);
  post(
    s,
    entry(
      clock.id("je"),
      at,
      "RECEIPT_SPLIT",
      [
        { account: acct.buyer(gallery.id, sale.id), cents: -amount },
        { account: acct.operating(gallery.id), cents: amount - artistShare },
        { account: acct.trust(gallery.id, artist.id), cents: artistShare },
      ],
      payment.id,
    ),
  );
  gallery.operatingBalanceCents += amount - artistShare;

  const hold: EscrowHold = {
    id: clock.id("hold"),
    saleId: sale.id,
    paymentId: payment.id,
    artistId: artist.id,
    galleryId: gallery.id,
    amountCents: artistShare,
    status: "locked",
    lockedAt: at,
    releasedAt: null,
    dueBy: addDays(
      at,
      sale.payoutDays ?? termsFor(s, sale.artistId).payoutDays,
    ),
  };
  s.holds.push(hold);

  const index = s.payments.filter((p) => p.saleId === sale.id).length;
  const ref = { galleryId: gallery.id, artistId: artist.id };
  log(
    s,
    clock,
    "payment_received",
    `${methodLabel(method)} received from ${sale.buyerName}, ${formatCents(amount)}`,
    { ...ref, amountCents: amount },
  );
  log(
    s,
    clock,
    "hold_locked",
    `Moved ${formatCents(artistShare)} to artist trust for ${artist.name}, ${index <= sale.installments ? `installment ${index} of ${sale.installments}` : `payment ${index}`} on ${artwork.title}`,
    { ...ref, amountCents: artistShare },
  );

  if (amount === remaining) {
    sale.status = "paid";
    payOutSale(s, sale.id, clock);
  }
  return { snapshot: s, hold };
}

/** Same day payout of every locked hold on a fully paid sale. Mutates s. */
function payOutSale(s: Snapshot, saleId: Id, clock: Clock): void {
  const holds = s.holds.filter(
    (h) => h.saleId === saleId && h.status === "locked",
  );
  payOut(s, holds, clock, "payout_sent", "", "sale_complete");
}

/**
 * Pays out any share that has reached the deadline in its agreement while the
 * sale is still being paid off. Returns the input unchanged when nothing is due.
 */
export function releaseDueHolds(
  input: Snapshot,
  clock: Clock = systemClock,
): Snapshot {
  const now = Date.parse(clock.now());
  const due = (h: EscrowHold) =>
    h.status === "locked" &&
    h.dueBy !== undefined &&
    Date.parse(h.dueBy) <= now;
  if (!input.holds.some(due)) return input;
  const s = structuredClone(input);
  for (const group of groupBySale(s.holds.filter(due))) {
    payOut(
      s,
      group,
      clock,
      "deadline_payout",
      ", on the deadline in the agreement",
      "deadline",
    );
  }
  return s;
}

/**
 * The gallery fails. Its operating cash goes to creditors. Everything in the
 * artist trust is paid to the artists, because trust funds were never the
 * gallery's property. Calling it again changes nothing.
 */
export function declareInsolvency(
  input: Snapshot,
  args: { galleryId: Id },
  clock: Clock = systemClock,
): { snapshot: Snapshot } {
  if (find(input.galleries, args.galleryId, "Gallery").status === "insolvent") {
    return { snapshot: input };
  }
  const s = structuredClone(input);
  const gallery = find(s.galleries, args.galleryId, "Gallery");
  const claimed = gallery.operatingBalanceCents;
  post(
    s,
    entry(
      clock.id("je"),
      clock.now(),
      "OPERATING_TO_CREDITORS",
      [
        { account: acct.operating(gallery.id), cents: -claimed },
        { account: acct.creditors(gallery.id), cents: claimed },
      ],
      gallery.id,
    ),
  );
  gallery.claimedByCreditorsCents =
    (gallery.claimedByCreditorsCents ?? 0) + claimed;
  gallery.operatingBalanceCents = 0;
  gallery.status = "insolvent";
  gallery.insolventAt = clock.now();

  log(
    s,
    clock,
    "gallery_insolvent",
    `${gallery.name} entered insolvency. Operating account frozen for the administrator`,
    { galleryId: gallery.id },
  );
  log(
    s,
    clock,
    "creditor_claim",
    `Creditors claimed ${formatCents(claimed)} of operating cash. Artist trust is not part of the estate`,
    { galleryId: gallery.id, amountCents: claimed },
  );
  const locked = s.holds.filter(
    (h) => h.galleryId === gallery.id && h.status === "locked",
  );
  for (const group of groupBySale(locked)) {
    payOut(
      s,
      group,
      clock,
      "payout_sent",
      ", out of trust after the gallery's insolvency",
      "insolvency",
    );
  }

  // Consigned works are the artist's property, not the gallery's: unsold
  // pieces go back to their artists rather than into the estate.
  for (const artist of s.artists) {
    const works = s.artworks.filter(
      (w) =>
        w.galleryId === gallery.id &&
        w.artistId === artist.id &&
        w.status === "consigned",
    );
    if (works.length === 0) continue;
    for (const w of works) w.status = "returned";
    log(
      s,
      clock,
      "artwork_returned",
      `Returned ${works.length === 1 ? "an unsold work" : `${works.length} unsold works`} to ${artist.name}: ${works.map((w) => w.title).join(", ")}. Consigned art is not part of the estate`,
      { galleryId: gallery.id, artistId: artist.id },
    );
  }
  return { snapshot: s };
}

/**
 * Demo: the gallery tries to move a sale's trust money to operating (to pay
 * rent) or to a creditor. It goes through the real exit, releaseTrust, which
 * refuses it before anything changes. The refusal is logged on the artist's
 * feed with the exact reason; no balance moves.
 */
export function attemptTrustMove(
  input: Snapshot,
  args: TrustMoveRequest,
  clock: Clock = systemClock,
): { snapshot: Snapshot; refusal: string } {
  const sale = find(input.sales, args.saleId, "Sale");
  const holds = input.holds.filter(
    (h) => h.saleId === sale.id && h.status === "locked",
  );
  if (holds.length === 0) throw new EscrowError("Nothing in trust to try");
  const total = holds.reduce((t, h) => t + h.amountCents, 0);
  const artist = find(input.artists, sale.artistId, "Artist");
  const gallery = find(input.galleries, sale.galleryId, "Gallery");
  const destination = args.kind === "rent" ? "operating" : "creditors";

  // Layer 1, the journal: the move is submitted as a ledger entry, and the
  // trust account's rule refuses it. Layer 2, the engine: the same move is
  // sent to releaseTrust, which refuses it too. Both run on scratch copies,
  // so even a guard that wrongly allowed it could not change the real books.
  let refusal: string;
  try {
    const scratch = structuredClone(input);
    post(
      scratch,
      entry(
        clock.id("je"),
        clock.now(),
        "TRANSFER",
        [
          { account: acct.trust(gallery.id, artist.id), cents: -total },
          {
            account:
              args.kind === "rent"
                ? acct.operating(gallery.id)
                : acct.creditors(gallery.id),
            cents: total,
          },
        ],
        sale.id,
      ),
    );
    throw new Error(`The ledger let trust go to ${destination}`);
  } catch (err) {
    if (!(err instanceof LedgerRejected)) throw err;
    refusal = err.message;
  }
  try {
    releaseTrust(structuredClone(input), holds, destination as "artist", clock);
    throw new Error(`releaseTrust let trust go to ${destination}`);
  } catch (err) {
    if (!(err instanceof EscrowError)) throw err;
  }

  const s = structuredClone(input);
  const what =
    args.kind === "rent"
      ? `${gallery.name} tried to pay rent with`
      : `${gallery.name}'s creditor tried to take`;
  log(
    s,
    clock,
    "trust_move_refused",
    `Refused: ${what} the ${formatCents(total)} held in trust for ${artist.name}. The trust account can only pay the artist or refund the buyer. Nothing moved`,
    { galleryId: gallery.id, artistId: artist.id, amountCents: total },
  );
  return { snapshot: s, refusal };
}

export function cancelSale(
  input: Snapshot,
  args: { saleId: Id },
  clock: Clock = systemClock,
): { snapshot: Snapshot; sale: Sale } {
  const s = structuredClone(input);
  const sale = find(s.sales, args.saleId, "Sale");
  if (sale.status !== "open") {
    throw new EscrowError(`Only open sales can be cancelled`);
  }
  const artwork = find(s.artworks, sale.artworkId, "Artwork");
  const gallery = find(s.galleries, sale.galleryId, "Gallery");
  assertActive(gallery);

  // The buyer gets back the locked artist share (from trust) and the gallery's
  // part of every payment (from operating). A share already paid to the artist
  // on its agreement deadline stays with the artist.
  const holds = s.holds.filter(
    (h) => h.saleId === sale.id && h.status === "locked",
  );
  const paid = paidSoFar(s, sale.id);
  const galleryPart = s.payments
    .filter((p) => p.saleId === sale.id)
    .reduce((sum, p) => {
      const hold = s.holds.find((h) => h.paymentId === p.id);
      return sum + p.amountCents - (hold?.amountCents ?? 0);
    }, 0);
  post(
    s,
    entry(
      clock.id("je"),
      clock.now(),
      "OPERATING_TO_BUYER",
      [
        { account: acct.operating(gallery.id), cents: -galleryPart },
        { account: acct.buyer(gallery.id, sale.id), cents: galleryPart },
      ],
      sale.id,
    ),
  );
  gallery.operatingBalanceCents -= galleryPart;
  const lockedTotal = releaseTrust(s, holds, "buyer", clock);

  sale.status = "cancelled";
  sale.cancelledAt = clock.now();
  artwork.status = "consigned";

  const ref = { galleryId: gallery.id, artistId: sale.artistId };
  log(
    s,
    clock,
    "sale_cancelled",
    `${sale.buyerName} cancelled the purchase of ${artwork.title}. Work returned to inventory`,
    { ...ref, amountCents: paid },
  );
  if (lockedTotal > 0) {
    log(
      s,
      clock,
      "hold_refunded",
      `Refunded ${formatCents(lockedTotal)} from artist trust to ${sale.buyerName}`,
      { ...ref, amountCents: lockedTotal },
    );
  }
  return { snapshot: s, sale };
}

export function applyTerms(
  input: Snapshot,
  args: {
    agreementId: Id;
    terms: AgreementTerms;
    source: "model" | "fixture";
    /** Why a live read fell back to the saved answer, logged as agent_flag. */
    flag?: string;
  },
  clock: Clock = systemClock,
): Snapshot {
  const s = structuredClone(input);
  const agreement = find(s.agreements, args.agreementId, "Agreement");
  const artist = find(s.artists, agreement.artistId, "Artist");
  agreement.terms = args.terms;
  agreement.termsSource = args.source;
  if (args.flag) {
    log(
      s,
      clock,
      "agent_flag",
      `Live read of ${artist.name}'s agreement failed (${args.flag}); used the saved answer`,
      { galleryId: agreement.galleryId, artistId: artist.id },
    );
  }
  log(
    s,
    clock,
    "agreement_read",
    `Agent read ${artist.name}'s agreement. Artist share ${args.terms.artistShareBps / 100}%, payout within ${args.terms.payoutDays} days`,
    { galleryId: agreement.galleryId, artistId: artist.id },
  );
  return s;
}

/** Totals the dashboards show for one gallery. */
export function galleryTotals(s: Snapshot, galleryId: Id) {
  const holds = s.holds.filter((h) => h.galleryId === galleryId);
  const sum = (xs: EscrowHold[]) => xs.reduce((t, h) => t + h.amountCents, 0);
  return {
    operatingCents: find(s.galleries, galleryId, "Gallery")
      .operatingBalanceCents,
    lockedCents: sum(holds.filter((h) => h.status === "locked")),
    paidToArtistsCents: sum(holds.filter((h) => h.status === "paid")),
  };
}

/** Totals the artist portal shows. */
export function artistTotals(s: Snapshot, artistId: Id) {
  const holds = s.holds.filter((h) => h.artistId === artistId);
  const sum = (xs: EscrowHold[]) => xs.reduce((t, h) => t + h.amountCents, 0);
  return {
    heldCents: sum(holds.filter((h) => h.status === "locked")),
    paidCents: sum(holds.filter((h) => h.status === "paid")),
  };
}
