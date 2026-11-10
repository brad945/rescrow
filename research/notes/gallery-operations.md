# Gallery operations that touch money

Advances, recoupable production costs, discounts, co-dealer splits, resale royalties, works on approval, insurance and art fairs: which of these Rescrow should model, and how to do it without letting the gallery reach into trust.

## What we learned

- New York treats a consigned work and its sale proceeds as "trust property" for the artist. They cannot become the gallery's property or answer to its creditors. Any waiver is void except a waiver of the proceeds clause, and even that waiver never covers the first $2,500 of gross proceeds in each 12-month period from signing. [NY Arts & Cultural Affairs Law §12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)
- Under New York law, a gallery that advances production costs gets no ownership interest in the work. The artist still owes the advance as an ordinary debt. [Center for Art Law, artist-dealer essentials](https://itsartlaw.org/2023/03/01/wywh-the-essentials-a-guide-to-artist-dealer-relationships-and-contracts/)
- One model consignment contract says installment money goes to the artist first until the artist is paid in full. On a $5,000 sale split 50/50, the artist's $2,500 comes out of the first $2,500 collected. It also allows stipends only as a "non-refundable advance against future sales." [Estelberman, Professional Guidelines Consignment Contract](https://harrieteestelberman.com/consignment-contract)
- The same contract gives two discount options: the gallery absorbs the whole discount, or the discount is split equally with a cap on the artist's part. Works may go out on approval only with the artist's written consent, for at most 7 days. The gallery is strictly liable for loss from delivery until the work is sold or returned, insures at wholesale, and pays the deductible. [Estelberman, Professional Guidelines Consignment Contract](https://harrieteestelberman.com/consignment-contract)
- Arts Law Centre of Australia's model agreement has the gallery pay for framing unless the parties agree otherwise in writing, and framing a work gives the gallery no ownership of it. Any costs to be shared go in a schedule, so there are no hidden charges. Discounts need the artist's prior written permission and are either shared or taken out of the gallery's commission. [Arts Law, Artist-Gallery Agency Agreement notes (PDF)](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf)
- The Arts Law notes say an installment sale has to settle several things: whether installments go to the artist as they arrive or as a lump sum, and whether the gallery takes the risk that the buyer defaults. They also require insurance cover of at least the retail price. [Arts Law, Artist-Gallery Agency Agreement notes (PDF)](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf)
- Typical splits run from 40-50% commission at emerging spaces to 60-70% at top galleries. One gallery (Lehmann Strobel) takes 50% only of proceeds above the artist's material and fabrication costs, forbids deducting framing, counts a sale as made at the first payment, carries the buyer-default risk itself, and pays monthly. The recognized norm is payment within 30 days of the gallery receiving funds. [Promise Legal, gallery representation guide](https://blog.promise.legal/gallery-representation-agreement-artists-guide/)
- Discounts of up to 10% are commonly split between artist and gallery. Anything deeper needs the artist's sign-off or comes out of the gallery's side. Some agreements ask for a shared 20% discount on museum sales. Artists should expect payment 30 to 60 days after the gallery is paid. [The Creative Independent](https://thecreativeindependent.com/guides/how-to-work-with-galleries-and-collectors-as-an-emerging-artist/)
- Some galleries do deduct costs. A London gallery's terms let it itemize framing, storage, extra staffing and card processing fees and take them off the artist's payment. Where it frames a work, commission is charged on the unframed price. Commission also applies to follow-on sales for six months after the show. [The Gallery at Green and Stone, terms](https://www.thegalleryatgreenandstone.com/framing-gallery-tcs)
- When one dealer sells a work held by another, the two dealers "generally" split the commission in half. That split is payable only once the sale completes, and the artist's percentage does not change. [The Painter's Keys, gallery fee-splitting](https://painterskeys.com/fee-splitting/)
- The UK resale royalty applies to resales of £1,000 or more through art market professionals. It is charged in bands (4% up to £50,000, falling to 0.25% above £500,000) and capped at £12,500 per sale. Collecting societies collect it, and sales to public non-profit museums are exempt. [GOV.UK, Artist's resale right](https://www.gov.uk/artists-resale-right)
- Art fair stands are a major gallery cost with "complex and inconsistent" pricing: about $34,400 for 40 sq m at Art Basel Hong Kong and over $100,000 for the largest Armory Show booth. [The Art Newspaper, stand costs](https://www.theartnewspaper.com/2018/09/27/fairs-fair-the-murky-world-of-stand-costs)
- The gallery's 50% has traditionally been justified as covering rent, staffing, production, shipping and insurance. Today, artists often pay for production, packing and shipping themselves. [Hyperallergic, rethinking the 50/50 split](https://hyperallergic.com/its-time-rethink-the-50-50-split-with-art-galleries/)

## How it applies to Rescrow

- Every cost or discount clause changes how one incoming payment splits between operating and trust. Rescrow should therefore apply these rules at the moment of the split, so the gallery's recoupment arrives in operating with the commission and never has to come back out of trust. `releaseTrust(to: artist|buyer)` stays the only exit, with no new exceptions.
- The seed agreements already contain these clauses: Ines's discount clause ("up to 10% ... shared equally") and Theo's framing clause (capped at $400). The engine reads them but ignores them. Enforcing them turns notes into rules, the same "rule is code" message as the trust guard.
- Sources disagree on almost every term: who bears discounts, whether framing is deductible, pro-rata versus artist-first installments, and who carries default risk. That makes these per-agreement policies, extracted with a cited clause, not global constants. This fits the existing citation check, and a deduction with no verified clause should be refused (the Arts Law "no hidden costs" rule).
- Some features add money flows outside today's equation (advances paid out of operating, co-dealer payables, fair costs). Each one needs a named term in `reconcile()` so the books still close to the cent; otherwise it shouldn't ship.
- The §12.01 $2,500 waiver floor and the UK royalty bands are exact, table-testable rules. They are small, give real-world fidelity, and are easy to cover with boundary tests.

## Feature ideas

### Installment waterfall policy (pro-rata, artist-first, gallery-first)

- What: Add `installmentPolicy: "pro_rata" | "artist_first" | "gallery_first"` to `AgreementTerms`, extracted with a citation. `artistShareOfPayment` allocates each payment by that policy. Under artist-first, every dollar goes to trust until the artist's total share is filled, then to operating. The UI shows a stacked bar per installment.
- Why judges care: It shows payment allocation as an explicit, tested policy rather than a hard-coded ratio, and it changes the insolvency outcome.
- Demo visibility: both. Run beat 6 under artist-first and the artist is already almost whole after payment 2.
- Effort: M
- Demo risk: low. It is a pure function of the payment amount and the paid-so-far total. Property tests check that installments always sum to exactly the artist's share, for every policy and any payment sequence.
- Grounding: [Estelberman contract](https://harrieteestelberman.com/consignment-contract), [Arts Law notes](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf)

### Clause-gated recoupable costs (framing, casting, shipping)

- What: Add a `Deduction { artistId, artworkId, kind: "framing"|"casting"|"fabrication"|"shipping", amountCents, capCents, citation }` record. At split time the gallery recoups `min(outstanding, cap)` from the artist's portion into operating, and the rest locks in trust. A deduction is refused unless a verified clause authorizes that cost kind (Theo: framing, max $400).
- Why judges care: The gallery gets reimbursed without trust ever releasing money to the gallery, and an unauthorized charge throws.
- Demo visibility: both. Theo's statement shows "Framing (clause 3, cap $400): -$380" with the clause highlighted.
- Effort: M
- Demo risk: low. The arithmetic is deterministic. The main risk is wiring a new line into the statement UI.
- Grounding: [Green and Stone terms](https://www.thegalleryatgreenandstone.com/framing-gallery-tcs), [Arts Law notes](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf), [Promise Legal](https://blog.promise.legal/gallery-representation-agreement-artists-guide/), seed agreement for Theo (from the codebase)

### Discount rules with an approval gate

- What: `Sale` gets `listPriceCents`, `discountBps` and `discountKind: "collector"|"museum"`. Terms carry `discountBearer: "shared"|"gallery"`, `maxDiscountWithoutApprovalBps`, and an optional museum rate. `createSale` rejects a discount above the limit unless an `artistApproval` record exists. The artist's share is computed from the list price minus only the artist's part of the discount.
- Why judges care: It is a real policy check with a clear refusal path, much like a spend control on a card.
- Demo visibility: shown-on-screen. "15% off: blocked, needs Ines's written approval", with the clause lit up.
- Effort: M
- Demo risk: low. Rounding needs care: the shared half of an odd-cent discount must be allocated deterministically and tested.
- Grounding: [The Creative Independent](https://thecreativeindependent.com/guides/how-to-work-with-galleries-and-collectors-as-an-emerging-artist/), [Estelberman contract](https://harrieteestelberman.com/consignment-contract), seed agreement for Ines (from the codebase)

### Gallery-guaranteed sale (one-way top-up into trust)

- What: An agreement flag `galleryBearsDefaultRisk`. On the first payment, the gallery moves the artist's remaining unpaid share from operating into trust in one transfer, so trust is fully funded before the buyer finishes paying. If the buyer defaults later, the gallery absorbs the loss. The move only runs from operating into trust, and the reverse direction does not exist in code.
- Why judges care: It shows a one-way valve with a clear invariant: trust only grows from operating, never the reverse.
- Demo visibility: both. The trust meter jumps to 100% on the first wire.
- Effort: M
- Demo risk: med. A cancelled sale now refunds the buyer from trust while the gallery's top-up stays locked. The top-up should be tracked as its own hold, released to the artist on default, and tested.
- Grounding: [Promise Legal (Lehmann Strobel terms)](https://blog.promise.legal/gallery-representation-agreement-artists-guide/), [Arts Law notes](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf)

### §12.01 waiver floor

- What: If an agreement contains a waiver of trust treatment for proceeds, Rescrow still trusts the first $2,500 (250,000 cents) of gross proceeds in each 12-month window, starting from the waiver's signing date. A pure `protectedByStatute(payments, waiverSignedOn)` function returns the protected portion per payment.
- Why judges care: It encodes an actual statutory rule, with window-boundary tests.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is off the main demo path, and the date math is covered by tests at the 365/366-day edges.
- Grounding: [NY ACAL §12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)

### Advance against future sales

- What: `Advance { artistId, amountCents, paidAt, recoupable: true, refundable: false }`, paid from operating to the artist. Later artist shares first pay down the outstanding advance (the recouped amount routes to operating at split time). The rest goes to trust. Because the advance is non-refundable, the balance stops at zero and never becomes a debt the artist owes on a lost sale.
- Why judges care: It is a ledger with a running balance and a floor, plus a new reconcile term (`advancesPaid`).
- Demo visibility: both. An "Advance balance $3,000 to $1,800" chip appears on the artist card.
- Effort: M
- Demo risk: med. Insolvency semantics need a decision. The unrecouped advance is simply the gallery's loss, and that should be written down and tested.
- Grounding: [Estelberman contract](https://harrieteestelberman.com/consignment-contract), [Center for Art Law](https://itsartlaw.org/2023/03/01/wywh-the-essentials-a-guide-to-artist-dealer-relationships-and-contracts/)

### Co-dealer split on the commission side

- What: Add `Sale.coDealer?: { name, shareOfCommissionBps }`. The gallery's commission splits into operating and a `coDealerPayable` that settles only when the sale completes, and is cancelled if the sale is cancelled. The artist's share is computed exactly as before.
- Why judges care: It is multi-party settlement in which the artist's money is untouched by the dealers' arrangement.
- Demo visibility: both
- Effort: M
- Demo risk: low. It adds one term to reconcile (`owedToCoDealers` or `paidToCoDealers`), with tests that a co-dealer split never changes any hold amount.
- Grounding: [The Painter's Keys](https://painterskeys.com/fee-splitting/)

### UK resale royalty calculator for secondary sales

- What: A pure `resaleRoyalty(pricePence)` function using the five bands, the £1,000 threshold and the £12,500 cap, plus a museum-buyer exemption. On a secondary sale, the royalty locks as a trust hold payable to the artist, using the existing release path.
- Why judges care: Table-driven tests at the band edges, plus a neat check that the cap binds at exactly £2,000,000.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is self-contained and needs no UI to be credible.
- Grounding: [GOV.UK, Artist's resale right](https://www.gov.uk/artists-resale-right)

### Works on approval with a deposit and a countdown

- What: Add an artwork status `on_approval` with `approvalUntil` (at most the agreement's limit, for example 7 days), allowed only if the agreement permits approval sales. The buyer's deposit locks in trust as buyer-refundable. On purchase it converts to the first installment and splits normally; on expiry it is released to the buyer through `releaseTrust(to: "buyer")`.
- Why judges care: It is a timed state machine whose expiry goes through the same deadline sweep as `dueBy`.
- Demo visibility: shown-on-screen. A countdown chip on the artwork appears, and the deposit is returned automatically.
- Effort: M
- Demo risk: med. It adds a new hold purpose ("deposit"), which reconcile and the insolvency path must treat correctly.
- Grounding: [Estelberman contract](https://harrieteestelberman.com/consignment-contract)

### Loss or damage: insured value routes to the artist

- What: A `recordLoss(artworkId)` operation marks the work lost. The gallery owes the artist the value set in the agreement (retail or wholesale). When the insurer's payment arrives through the bank feed tagged to that artwork, the artist's amount locks in trust. Any shortfall below the agreed value is drawn from operating into trust.
- Why judges care: It covers a real edge case where money arrives that isn't a sale payment and still has to reach the right party.
- Demo visibility: both
- Effort: M
- Demo risk: med. Whether insurance proceeds legally count as trust funds varies, so present this as the agreement's rule, not as statute.
- Grounding: [Estelberman contract](https://harrieteestelberman.com/consignment-contract), [Arts Law notes](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf), [Center for Art Law](https://itsartlaw.org/2023/03/01/wywh-the-essentials-a-guide-to-artist-dealer-relationships-and-contracts/)

### Art fair P&L kept off the artist's side

- What: `Fair { name, boothCents, shippingCents }`, with sales tagged `fairId`. A per-fair panel shows commission earned against booth and shipping costs. Fair costs are operating expenses and can reach an artist only through a cited deduction clause (see recoupable costs).
- Why judges care: It is gallery-side spend analytics, which is close to Ramp's own territory, and the trust boundary still holds.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. The one catch is that operating outflows need an `expenses` term in reconcile, or the panel must be display-only.
- Grounding: [The Art Newspaper](https://www.theartnewspaper.com/2018/09/27/fairs-fair-the-murky-world-of-stand-costs), [Hyperallergic](https://hyperallergic.com/its-time-rethink-the-50-50-split-with-art-galleries/)

### Itemized artist statement

- What: A per-artist, per-period statement with these lines: list price, discount (the artist's part), gross share, each deduction with its clause quote, advance recouped, net, then held / paid / due-by. It also lists the location of unsold consigned works. Every line is a pure function of the snapshot, and its total matches `artistTotals`.
- Why judges care: The statement and the ledger agree to the cent, and every deduction cites the clause that allows it.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is read-only, and tier 2 already plans a printable statement.
- Grounding: [Estelberman contract](https://harrieteestelberman.com/consignment-contract), [Arts Law notes](https://www.artslaw.com.au/images/uploads/artist_gallery_agency_agreement_explanatory_notes_final.pdf)
