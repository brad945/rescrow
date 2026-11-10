import type {
  Activity,
  ActivityKind,
  AgreementTerms,
  Cents,
  EscrowHold,
  Id,
  PaymentMethod,
  Sale,
  Snapshot,
} from "@/types";
import { formatCents, shareOf } from "@/lib/money";

// Pure escrow rules. Each function returns a new snapshot and never mutates
// its input, so routes can load, apply, and save.

export class EscrowError extends Error {}

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
  return agreement.terms;
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

export function createSale(
  input: Snapshot,
  args: { artworkId: Id; buyerName: string; installments: number },
  clock: Clock = systemClock,
): { snapshot: Snapshot; sale: Sale } {
  const s = structuredClone(input);
  const artwork = find(s.artworks, args.artworkId, "Artwork");
  if (artwork.status !== "consigned") {
    throw new EscrowError(`${artwork.title} is not available for sale`);
  }
  if (!Number.isInteger(args.installments) || args.installments < 1) {
    throw new EscrowError("Installments must be a whole number of at least 1");
  }
  termsFor(s, artwork.artistId);

  const sale: Sale = {
    id: clock.id("sale"),
    artworkId: artwork.id,
    galleryId: artwork.galleryId,
    artistId: artwork.artistId,
    buyerName: args.buyerName.trim() || "Private collector",
    priceCents: artwork.priceCents,
    installments: args.installments,
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
  const terms = termsFor(s, sale.artistId);
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
  s.payments.push(payment);

  const artistShare = shareOf(amount, terms.artistShareBps);
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
  };
  s.holds.push(hold);

  const index = s.payments.filter((p) => p.saleId === sale.id).length;
  const ref = { galleryId: gallery.id, artistId: artist.id };
  log(
    s,
    clock,
    "payment_received",
    `${method.toUpperCase()} of ${formatCents(amount)} from ${sale.buyerName} landed in Ramp`,
    { ...ref, amountCents: amount },
  );
  log(
    s,
    clock,
    "hold_locked",
    `Locked ${formatCents(artistShare)} for ${artist.name} from installment ${index} of ${sale.installments} on ${artwork.title}`,
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
  const sale = find(s.sales, saleId, "Sale");
  const artist = find(s.artists, sale.artistId, "Artist");
  const artwork = find(s.artworks, sale.artworkId, "Artwork");
  const holds = s.holds.filter(
    (h) => h.saleId === saleId && h.status === "locked",
  );
  if (holds.length === 0) return;

  const at = clock.now();
  const total = holds.reduce((sum, h) => sum + h.amountCents, 0);
  for (const h of holds) {
    h.status = "paid";
    h.releasedAt = at;
  }
  s.payouts.push({
    id: clock.id("po"),
    artistId: artist.id,
    galleryId: sale.galleryId,
    amountCents: total,
    holdIds: holds.map((h) => h.id),
    paidAt: at,
  });
  log(
    s,
    clock,
    "payout_sent",
    `Paid ${artist.name} ${formatCents(total)} for ${artwork.title}`,
    { galleryId: sale.galleryId, artistId: artist.id, amountCents: total },
  );
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
  const at = clock.now();

  // Buyer gets everything back: the locked artist share plus the gallery's part.
  const holds = s.holds.filter(
    (h) => h.saleId === sale.id && h.status === "locked",
  );
  const lockedTotal = holds.reduce((sum, h) => sum + h.amountCents, 0);
  const paid = paidSoFar(s, sale.id);
  gallery.operatingBalanceCents -= paid - lockedTotal;
  for (const h of holds) {
    h.status = "refunded";
    h.releasedAt = at;
  }

  sale.status = "cancelled";
  artwork.status = "consigned";

  const ref = { galleryId: gallery.id, artistId: sale.artistId };
  log(
    s,
    clock,
    "sale_cancelled",
    `${sale.buyerName} backed out of ${artwork.title}; ${artwork.title} is back on the wall`,
    { ...ref, amountCents: paid },
  );
  if (lockedTotal > 0) {
    log(
      s,
      clock,
      "hold_refunded",
      `Returned ${formatCents(lockedTotal)} of locked funds to ${sale.buyerName}; the gallery never touched it`,
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
  },
  clock: Clock = systemClock,
): Snapshot {
  const s = structuredClone(input);
  const agreement = find(s.agreements, args.agreementId, "Agreement");
  const artist = find(s.artists, agreement.artistId, "Artist");
  agreement.terms = args.terms;
  agreement.termsSource = args.source;
  log(
    s,
    clock,
    "agreement_read",
    `Agent read ${artist.name}'s agreement: ${args.terms.artistShareBps / 100}% to the artist, paid within ${args.terms.payoutDays} days`,
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
