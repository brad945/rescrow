// Shared data shapes for Rescrow. All money is integer cents.
// Owned by the backend lane: ask before adding or changing fields.

export type Id = string;
export type Cents = number;
/** ISO 8601 timestamp */
export type Timestamp = string;

export interface Gallery {
  id: Id;
  name: string;
  city: string;
  /** True once the gallery has linked its operating bank account through Ramp. */
  rampConnected: boolean;
  /** Money the gallery is free to spend (excludes anything held for artists). */
  operatingBalanceCents: Cents;
  /** Operating cash before any sale recorded here; reconciliation starts from it. */
  openingBalanceCents?: Cents;
  /** Missing means active. Insolvent galleries can't take sales or payments. */
  status?: "active" | "insolvent";
  insolventAt?: Timestamp | null;
  /** Operating cash handed to creditors when the gallery went insolvent. */
  claimedByCreditorsCents?: Cents;
}

export interface Artist {
  id: Id;
  name: string;
  email: string;
  galleryId: Id;
}

export type ArtworkStatus = "consigned" | "sold" | "returned";

export interface Artwork {
  id: Id;
  title: string;
  year: number;
  medium: string;
  artistId: Id;
  galleryId: Id;
  priceCents: Cents;
  status: ArtworkStatus;
  /** Two hex colors used to render a placeholder swatch for the piece. */
  swatch: [string, string];
}

/** Terms the agent extracts from a consignment agreement. */
export interface AgreementTerms {
  /** Artist share in basis points (5000 = 50%). */
  artistShareBps: number;
  /** Days after the buyer pays that the artist must be paid. */
  payoutDays: number;
  /** Plain language notes on anything unusual (discount caps, framing costs). */
  notes: string[];
  /** Short quotes from the agreement that justify the numbers above. */
  citations: string[];
  /** "needs_review" when a quote couldn't be found or disagrees with the numbers. */
  confidence?: "high" | "needs_review";
  /** Quotes the agent gave that do not appear in the agreement text. */
  unverifiedCitations?: string[];
  /** Local model that produced these terms on a live read. */
  model?: string;
  /** How each number was checked against the agreement text. */
  checks?: VerificationCheck[];
}

/** One check the verifier ran on the agent's output. */
export interface VerificationCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ConsignmentAgreement {
  id: Id;
  galleryId: Id;
  artistId: Id;
  signedOn: Timestamp;
  /** Full agreement text as uploaded. */
  text: string;
  /** Null until the agent has read the agreement. */
  terms: AgreementTerms | null;
  /** Which path produced the terms. */
  termsSource: "model" | "fixture" | null;
}

export type SaleStatus = "open" | "paid" | "cancelled";

export interface Sale {
  id: Id;
  artworkId: Id;
  galleryId: Id;
  artistId: Id;
  buyerName: string;
  priceCents: Cents;
  /** Number of installments the buyer agreed to (1 = paid in full). */
  installments: number;
  /** Artist share fixed from the agreement when the sale closed (basis points). */
  artistShareBps: number;
  /** Payout window fixed from the agreement when the sale closed, so a later re-read can't move or block this sale's deadlines. */
  payoutDays?: number;
  status: SaleStatus;
  createdAt: Timestamp;
}

export type PaymentMethod = "wire" | "ach" | "card";

/** Money landing in the gallery's Ramp connected account. */
export interface IncomingPayment {
  id: Id;
  saleId: Id;
  galleryId: Id;
  amountCents: Cents;
  method: PaymentMethod;
  receivedAt: Timestamp;
  /** Bank feed transaction id; ingesting the same id twice is a no-op. */
  rampTransactionId?: string;
}

export type HoldStatus = "locked" | "paid" | "refunded";

/** The artist's share of one incoming payment, locked away from the gallery. */
export interface EscrowHold {
  id: Id;
  saleId: Id;
  paymentId: Id;
  artistId: Id;
  galleryId: Id;
  amountCents: Cents;
  status: HoldStatus;
  lockedAt: Timestamp;
  releasedAt: Timestamp | null;
  /** Latest date the agreement allows before this share must be paid (receipt + payout days). */
  dueBy?: Timestamp;
}

export interface Payout {
  id: Id;
  artistId: Id;
  galleryId: Id;
  amountCents: Cents;
  holdIds: Id[];
  paidAt: Timestamp;
}

export type ActivityKind =
  | "sale_created"
  | "payment_received"
  | "hold_locked"
  | "payout_sent"
  | "sale_cancelled"
  | "hold_refunded"
  | "agreement_read"
  | "reset"
  | "deadline_payout"
  | "gallery_insolvent"
  | "creditor_claim"
  | "agent_flag";

export interface Activity {
  id: Id;
  kind: ActivityKind;
  at: Timestamp;
  galleryId: Id | null;
  artistId: Id | null;
  message: string;
  amountCents: Cents | null;
}

/** Everything the UI needs, returned by GET /api/state. */
export interface Snapshot {
  galleries: Gallery[];
  artists: Artist[];
  artworks: Artwork[];
  agreements: ConsignmentAgreement[];
  sales: Sale[];
  payments: IncomingPayment[];
  holds: EscrowHold[];
  payouts: Payout[];
  activity: Activity[];
}

// Request bodies for the demo routes.

export interface CreateSaleRequest {
  artworkId: Id;
  buyerName: string;
  installments: number;
}

export interface ReceivePaymentRequest {
  saleId: Id;
  /** Defaults to the next installment amount when omitted. */
  amountCents?: Cents;
  method?: PaymentMethod;
}

export interface CancelSaleRequest {
  saleId: Id;
}

export interface ReadAgreementRequest {
  agreementId: Id;
  /** "saved" (default) uses the stored answer; "live" asks the local model first. */
  mode?: "saved" | "live";
}

export interface InsolvencyRequest {
  galleryId: Id;
}

/** Proof that every cent received is in exactly one place. */
export interface Reconciliation {
  balanced: boolean;
  openingCents: Cents;
  receivedCents: Cents;
  operatingCents: Cents;
  trustCents: Cents;
  paidToArtistsCents: Cents;
  refundedToBuyersCents: Cents;
  claimedByCreditorsCents: Cents;
  /** Plain-language reasons the books don't balance; empty when they do. */
  breaks: string[];
}
