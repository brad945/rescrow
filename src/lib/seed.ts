import { openingJournal } from "@/lib/escrow/journal";
import type { AgreementTerms, Snapshot } from "@/types";

// Fictional gallery, artists and works for the demo.

const MARA_AGREEMENT = `CONSIGNMENT AGREEMENT

Between Lowline Gallery LLC ("Gallery"), 214 Orchard Street, New York, NY, and Mara Okafor ("Artist").

1. Consignment. Artist consigns the works listed in Schedule A to Gallery for exhibition and sale.
2. Retail price. Works will be offered at the retail prices in Schedule A. Gallery may grant collector discounts of up to 10% without Artist approval; any discount is shared equally.
3. Commission. Gallery retains fifty percent (50%) of the net sale price. The remaining fifty percent (50%) is the property of Artist.
4. Payment. Gallery shall pay Artist's share within thirty (30) days of receiving payment from the buyer. Where a buyer pays in installments, Artist's share of each installment is due on the same schedule.
5. Trust. Pursuant to New York Arts and Cultural Affairs Law Article 12, all proceeds due to Artist are trust funds held for the benefit of Artist and are not subject to claims of Gallery's creditors.
6. Term. This agreement runs for twelve (12) months from the date below.

Signed March 3, 2026.`;

const THEO_AGREEMENT = `ARTIST CONSIGNMENT TERMS

Lowline Gallery LLC and Theo Lindqvist agree as follows.

Commission split: the Artist receives sixty percent (60%) of each sale and the Gallery receives forty percent (40%).
Framing: framing costs advanced by the Gallery (not to exceed $400 per work) are deducted from the Artist's share before payment.
Settlement: the Artist's proceeds will be remitted within fourteen (14) days after the Gallery receives cleared funds.
Installment sales require the Artist's written consent where the term exceeds six months.
All sums owed to the Artist are held in trust under NY Arts & Cultural Affairs Law 12.01.

Executed June 18, 2026.`;

const INES_AGREEMENT = `LOWLINE GALLERY / INES DUARTE: CONSIGNMENT

This agreement is made between Lowline Gallery LLC, 214 Orchard Street, New York, NY 10002 (the "Gallery"), and Ines Duarte (the "Artist").

1. Works. The Artist consigns to the Gallery the works listed on the attached inventory, including Orchard in Rain (2026) and Threshold (2024, bronze, edition 2 of 5).

2. Pricing. The Gallery shall sell the consigned works at the agreed retail price. Any discount above ten percent requires the Artist's written approval by email.

3. Proceeds. From the purchase price received, the Gallery keeps half and the Artist keeps half. Shipping and crating for sold works are paid by the buyer and are excluded from the split.

4. Payment. Proceeds owed to the Artist shall be paid no later than sixty (60) days following receipt by the Gallery. Where the buyer pays over time, this period runs from receipt of each payment.

5. Trust. The Gallery acknowledges that the Artist's proceeds are trust property under New York Arts and Cultural Affairs Law section 12.01 and may not be used for Gallery operating expenses.

6. Insurance and care. The Gallery insures the works at the Artist's share of retail value while they are in its possession.

7. Term. This agreement runs for one year and renews unless either party gives thirty days' notice.

Dated September 9, 2026.`;

/** What the agent extracts from each seeded agreement when no model is available. */
export const FIXTURE_TERMS: Record<string, AgreementTerms> = {
  agr_mara: {
    artistShareBps: 5000,
    payoutDays: 30,
    notes: [
      "Collector discounts up to 10% need no artist approval and are split equally.",
      "Installment sales pay the artist's share of each installment on the same 30 day schedule.",
    ],
    citations: [
      "The remaining fifty percent (50%) is the property of Artist.",
      "within thirty (30) days of receiving payment from the buyer",
    ],
  },
  agr_theo: {
    artistShareBps: 6000,
    payoutDays: 14,
    notes: [
      "Framing advanced by the gallery (max $400 per work) comes out of the artist's share.",
      "Installment terms longer than six months need the artist's written consent.",
    ],
    citations: [
      "the Artist receives sixty percent (60%) of each sale",
      "remitted within fourteen (14) days after the Gallery receives cleared funds",
    ],
  },
  agr_ines: {
    artistShareBps: 5000,
    payoutDays: 60,
    notes: [
      "Shipping and crating are paid by the buyer and are not part of the split.",
      "Discounts over 10% need the artist's written approval.",
    ],
    citations: [
      "the Gallery keeps half and the Artist keeps half",
      "no later than sixty (60) days following receipt",
    ],
  },
};

/**
 * The moment the seed's history is written relative to. createSeed() with no
 * argument returns exactly the same snapshot every time; the reset route and
 * the store pass the wall clock, so the seeded history (and Theo's payout
 * deadline) is always the same distance in the past (and future) of now.
 */
export const SEED_NOW = "2026-11-09T16:41:12.000Z";

/**
 * Bumped whenever the seed changes shape or content, so a data file written by
 * an older build is reseeded instead of loaded.
 */
export const SEED_VERSION = 2;

export function createSeed(now: string = SEED_NOW): Snapshot {
  const shift = Date.parse(now) - Date.parse(SEED_NOW);
  const t = (iso: string) => new Date(Date.parse(iso) + shift).toISOString();
  const records: Omit<Snapshot, "journal" | "refunds"> = {
    galleries: [
      {
        id: "gal_lowline",
        name: "Lowline Gallery",
        city: "New York, NY",
        rampConnected: true,
        operatingBalanceCents: 4_183_627,
        // 4,183,627 less the gallery's share of the two seeded payments
        // ($9,000 of Tidewater, $1,600 of Four Lamps installment 1).
        openingBalanceCents: 3_123_627,
      },
    ],
    artists: [
      {
        id: "art_mara",
        name: "Mara Okafor",
        email: "mara@okafor.studio",
        galleryId: "gal_lowline",
      },
      {
        id: "art_theo",
        name: "Theo Lindqvist",
        email: "theo@lindqvist.art",
        galleryId: "gal_lowline",
      },
      {
        id: "art_ines",
        name: "Ines Duarte",
        email: "ines@duarte.work",
        galleryId: "gal_lowline",
      },
    ],
    artworks: [
      {
        id: "wrk_tidewater",
        title: "Tidewater, Evening",
        year: 2025,
        medium: "Oil on linen, 48 x 60 in",
        artistId: "art_mara",
        galleryId: "gal_lowline",
        priceCents: 1_800_000,
        status: "sold",
        swatch: ["#1f3a5f", "#d98e4a"],
      },
      {
        id: "wrk_salt",
        title: "Salt Study No. 4",
        year: 2026,
        medium: "Oil on panel, 24 x 30 in",
        artistId: "art_mara",
        galleryId: "gal_lowline",
        priceCents: 950_000,
        status: "consigned",
        swatch: ["#e8e1d3", "#7a8b8f"],
      },
      {
        id: "wrk_lamps",
        title: "Four Lamps",
        year: 2026,
        medium: "Acrylic on canvas, 36 x 36 in",
        artistId: "art_theo",
        galleryId: "gal_lowline",
        priceCents: 1_200_000,
        status: "sold",
        swatch: ["#f2c14e", "#2d2a32"],
      },
      {
        id: "wrk_harbor",
        title: "Harbor Grid",
        year: 2025,
        medium: "Gouache on paper, 22 x 30 in",
        artistId: "art_theo",
        galleryId: "gal_lowline",
        priceCents: 480_000,
        status: "consigned",
        swatch: ["#3c6e71", "#d9d9d9"],
      },
      {
        id: "wrk_orchard",
        title: "Orchard in Rain",
        year: 2026,
        medium: "Oil on canvas, 40 x 50 in",
        artistId: "art_ines",
        galleryId: "gal_lowline",
        priceCents: 2_400_000,
        status: "consigned",
        swatch: ["#4f6d3a", "#c9b79c"],
      },
      {
        id: "wrk_threshold",
        title: "Threshold",
        year: 2024,
        medium: "Bronze, edition 2 of 5",
        artistId: "art_ines",
        galleryId: "gal_lowline",
        priceCents: 3_600_000,
        status: "consigned",
        swatch: ["#8c5a2b", "#1b1b1b"],
      },
    ],
    agreements: [
      {
        id: "agr_mara",
        galleryId: "gal_lowline",
        artistId: "art_mara",
        signedOn: "2026-03-03T12:00:00.000Z",
        text: MARA_AGREEMENT,
        terms: FIXTURE_TERMS.agr_mara,
        termsSource: "fixture",
      },
      {
        id: "agr_theo",
        galleryId: "gal_lowline",
        artistId: "art_theo",
        signedOn: "2026-06-18T12:00:00.000Z",
        text: THEO_AGREEMENT,
        terms: FIXTURE_TERMS.agr_theo,
        termsSource: "fixture",
      },
      {
        id: "agr_ines",
        galleryId: "gal_lowline",
        artistId: "art_ines",
        signedOn: "2026-09-09T12:00:00.000Z",
        text: INES_AGREEMENT,
        terms: null,
        termsSource: null,
      },
    ],
    sales: [
      {
        id: "sale_tidewater",
        artworkId: "wrk_tidewater",
        galleryId: "gal_lowline",
        artistId: "art_mara",
        buyerName: "R. Castellanos",
        priceCents: 1_800_000,
        installments: 1,
        artistShareBps: 5000,
        status: "paid",
        createdAt: t("2026-10-14T15:20:44.000Z"),
      },
      {
        id: "sale_lamps",
        artworkId: "wrk_lamps",
        galleryId: "gal_lowline",
        artistId: "art_theo",
        buyerName: "Hollis Family Trust",
        priceCents: 1_200_000,
        installments: 3,
        artistShareBps: 6000,
        status: "open",
        createdAt: t("2026-10-28T18:05:09.000Z"),
      },
    ],
    payments: [
      {
        id: "pay_tidewater_1",
        saleId: "sale_tidewater",
        galleryId: "gal_lowline",
        amountCents: 1_800_000,
        method: "wire",
        receivedAt: t("2026-10-16T14:02:37.000Z"),
      },
      {
        id: "pay_lamps_1",
        saleId: "sale_lamps",
        galleryId: "gal_lowline",
        amountCents: 400_000,
        method: "ach",
        receivedAt: t("2026-10-30T16:41:12.000Z"),
      },
    ],
    holds: [
      {
        id: "hold_tidewater_1",
        saleId: "sale_tidewater",
        paymentId: "pay_tidewater_1",
        artistId: "art_mara",
        galleryId: "gal_lowline",
        amountCents: 900_000,
        status: "paid",
        lockedAt: t("2026-10-16T14:02:37.000Z"),
        releasedAt: t("2026-10-16T14:02:41.000Z"),
      },
      {
        id: "hold_lamps_1",
        saleId: "sale_lamps",
        paymentId: "pay_lamps_1",
        artistId: "art_theo",
        galleryId: "gal_lowline",
        amountCents: 240_000,
        status: "locked",
        lockedAt: t("2026-10-30T16:41:12.000Z"),
        releasedAt: null,
        // Theo's agreement: paid within 14 days of cleared funds.
        dueBy: t("2026-11-13T16:41:12.000Z"),
      },
    ],
    payouts: [
      {
        id: "po_tidewater",
        artistId: "art_mara",
        galleryId: "gal_lowline",
        amountCents: 900_000,
        holdIds: ["hold_tidewater_1"],
        paidAt: t("2026-10-16T14:02:41.000Z"),
      },
    ],
    activity: [
      {
        id: "act_seed_4",
        kind: "hold_locked",
        at: t("2026-10-30T16:41:12.000Z"),
        galleryId: "gal_lowline",
        artistId: "art_theo",
        message:
          "Moved $2,400.00 to artist trust for Theo Lindqvist, installment 1 of 3 on Four Lamps",
        amountCents: 240_000,
      },
      {
        id: "act_seed_3",
        kind: "payment_received",
        at: t("2026-10-30T16:41:12.000Z"),
        galleryId: "gal_lowline",
        artistId: "art_theo",
        message: "ACH received from Hollis Family Trust, $4,000.00",
        amountCents: 400_000,
      },
      {
        id: "act_seed_2",
        kind: "payout_sent",
        at: t("2026-10-16T14:02:41.000Z"),
        galleryId: "gal_lowline",
        artistId: "art_mara",
        message: "Paid Mara Okafor $9,000.00 for Tidewater, Evening",
        amountCents: 900_000,
      },
      {
        id: "act_seed_1",
        kind: "payment_received",
        at: t("2026-10-16T14:02:37.000Z"),
        galleryId: "gal_lowline",
        artistId: "art_mara",
        message: "Wire received from R. Castellanos, $18,000.00",
        amountCents: 1_800_000,
      },
    ],
  };
  return {
    ...records,
    journal: openingJournal(records),
    refunds: [],
    seedVersion: SEED_VERSION,
    clockOffsetMs: 0,
  };
}
