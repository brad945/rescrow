# Existing gallery and artist software: what it does for consignment and artist pay, and where Rescrow fits

## What we learned

- ArtCloud works out what a gallery owes each consignor from closed invoices, using the split, expenses and consignor on each inventory record. Its report shows total sales, total consignment and total paid per artist. ([ArtCloud help: consignment reports and artist payments](https://help.artcloud.com/knowledge/consignment-reports-and-artist-payments))
- ArtCloud only records payouts. Its help page says plainly: "ArtCloud does not transfer payments to artists or consignors." The gallery pays outside the tool and logs the payment afterwards. ([ArtCloud help: consignment reports and artist payments](https://help.artcloud.com/knowledge/consignment-reports-and-artist-payments))
- In ArtCloud, a recorded artist payment can be edited in place or deleted. Deleting one makes the amount owed show again. The page mentions no void trail or edit history. ([ArtCloud help: edit or delete artist payments](https://help.artcloud.com/knowledge/edit-or-delete-artist-payments))
- ArtCloud sets default consignment terms per artist, which can be pulled into each inbound consignment list. Costs can be set at both the artist level and the artwork level. ([ArtCloud help: artist consignment agreement and financials](https://help.artcloud.com/knowledge/manage-artists-consignment-agreement-and-financials))
- Artlogic's own help centre says its Artist Payables tool, which would track what is owed from consignment through invoice to statement, is not yet available. The workaround is an Advanced Report with a "Due Consignor" column, exported at up to 250 artworks per section. ([Artlogic help: artist payables from Advanced Reports](https://support.artlogic.net/hc/en-gb/articles/15406651760028-How-to-Create-Artist-Payables-Documents-from-Advanced-Reports))
- Artlogic Pay covers the buyer side only. Buyers pay through Stripe links, and a deposit can be a fixed amount or a percentage. Each payment link works once per invoice and only on invoices of 40 artworks or fewer. Artist splits are not mentioned. ([Artlogic help: Artlogic Payments](https://support.artlogic.net/hc/en-gb/articles/6922943625116-Artlogic-Payments-beta-))
- Artlogic supports three-way split invoices for works an artist consigned to the gallery that the gallery then consigned out to another gallery. Only items with the status "On consignment | Consigned out" can go on one, and an item with the wrong status blocks the invoice. ([Artlogic help: consigned out and on consignment](https://support.artlogic.net/hc/en-gb/articles/360015740539--Consigned-out-and-On-consignment-definitions-in-Artlogic))
- Arternal takes card, ACH and buy now pay later payments. It describes its consignment side as tracking: "Track consignment splits, revenue, and artist payouts." ([Arternal: payments](https://arternal.com/pay), [Arternal: invoicing](https://arternal.com/invoicing))
- Masterpiece Manager's point of sale covers "Paying Consignments" and "Tracking Commissions" while keeping accounting data in sync. ([Masterpiece Manager](https://www.masterpiecemanager.com/))
- ArtBase's features listing names consignment forms and artist and consignor statements among its accounting tools. That page no longer loads, so this comes from its listing in search results. ([ArtBase features](https://www.artbase.com/features/overview))
- Escrow.com milestone deals need the buyer to fund the whole amount before the seller delivers anything. Each milestone pays out once the buyer accepts it, and the agreed inspection period runs 1 to 30 days. ([Escrow.com: how milestones work](https://www.escrow.com/milestones/how-it-works), [Escrow.com: inspection period](https://www.escrow.com/inspection-period))
- Artsy points buyers who deal with its partner galleries outside the Artsy Marketplace to Escrow.com. Funds sit in a non-interest-bearing trust account and are released to the seller, meaning the gallery, once the buyer accepts the work. The fee is a tiered percentage of the price. ([Escrow.com x Artsy](https://www.escrow.com/fr/partners/landing/artsy))
- Arcual splits a payment by the consignment agreement the artist approved, and says galleries and artists are paid at the same time. This only works for sales that run through Arcual. Its resale terms allow up to two beneficiaries. ([Arcual: how payments work](https://www.arcual.com/blog/how-do-payments-work-in-the-art-world), [Arcual: resale terms](https://arcual.com/solutions/resale-terms))
- Bookkeeping guidance treats the artist's share as a liability, not revenue. A consignor statement should show the gross price, any discount, the commission, allowed deductions and the net payable. Before paying, the sale document, statement, payout record and ledger should all match. ([Art gallery consignment bookkeeping](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping))
- A gallery software buyer's guide suggests asking whether a tool can produce a consignment statement "that a non-specialist could read and verify". It also notes that payments often arrive in installments and that data should be exportable if the gallery leaves. ([Serchen: art gallery software buyer's guide](https://www.serchen.com/blog/art-gallery-software-buyers-guide))

## How it applies to Rescrow

- None of these tools keeps the artist's share apart from gallery cash. ArtCloud, Artlogic, Arternal, Masterpiece Manager and ArtBase all calculate or record what is owed, and the money stays in the gallery's account. That is the gap Rescrow fills, and the insolvency beat shows it.
- Escrow.com protects the buyer, not the artist. It releases the full price to the gallery on acceptance, so the artist's share lands in operating cash, where creditors can reach it. Rescrow's protection starts at the point where Escrow.com's ends.
- Arcual comes closest, but its split only applies to sales on its own platform. Rescrow works on the gallery's existing bank account (Ramp) with any buyer and any payment method.
- Incumbents let a gallery edit or delete payout records. Rescrow can go further: trust money only moves through `releaseTrust`, and corrections post new entries instead of rewriting old ones.
- Pitching Rescrow as a layer under the existing tools is stronger than pitching it as a replacement. Galleries keep their CRM and inventory system, and Rescrow guarantees the money those tools only report.

## Feature ideas

### Same sale, three systems

- What: a pure function runs the demo's event sequence (sale, payments 1 and 2, insolvency) through three simple models: "ledger only" (the ArtCloud and Artlogic pattern, where the share is a number in a report and the cash sits in operating), "buyer escrow" (the Escrow.com pattern, where the full price is released to the gallery on acceptance), and Rescrow. A three-column panel after beat 6 shows how much the artist recovers under each: about 8 pence on the pound in the first two, 100% with Rescrow. Each column reconciles on its own model.
- Why judges care: it turns "nothing else does this" from a slide claim into a computed, tested result.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a pure function over fixed inputs, and the recovery rate for the first two columns is a named constant cited from the gallery-collapse notes.
- Grounding: [ArtCloud](https://help.artcloud.com/knowledge/consignment-reports-and-artist-payments), [Escrow.com x Artsy](https://www.escrow.com/fr/partners/landing/artsy), from the codebase (`reconcile`, insolvency route)

### Three-way split for consigned-out works

- What: an artwork can carry `consignedOutTo: { galleryName, commissionBps }`. The selling gallery collects from the buyer and sends the price minus its cut, so each payment that lands is net. The artist's share is still worked out on the gross price, and each landed payment locks `payment × artistShare / (price − coGalleryCut)` into trust, with running-total rounding. Creating the sale is refused if the co-gallery's cut plus the artist's share is more than the price, so the second gallery's cut can only come out of the home gallery's commission. A sale is also refused unless the artwork's status is a consigned-out one, the same guard Artlogic uses.
- Why judges care: it models a real multi-party flow, and the invariant "the artist's total share is unchanged by the middleman" can be tested exactly.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a separate seeded artwork and stays off the main demo path. `reconcile()` is unchanged because only money that actually landed counts as received. A new invariant checks that the holds add up to exactly the artist's gross share when the sale completes.
- Grounding: [Artlogic: consigned out and three-way split](https://support.artlogic.net/hc/en-gb/articles/360015740539--Consigned-out-and-On-consignment-definitions-in-Artlogic)

### Incumbent payables cross-check

- What: import a CSV in the shape of an Artlogic "Due Consignor" report or an ArtCloud consignment export (fixture files in the repo) and compare it line by line with Rescrow's holds and payouts. Each artwork gets a badge: "matches", "your system says owed but nothing is in trust", or "trust holds more than your system shows". The total gap is shown as "artist money sitting in operating today".
- Why judges care: it shows Rescrow fitting into the tools galleries already use, and it finds real discrepancies instead of assuming clean data.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. The import is a deterministic parse of a checked-in fixture, and bad rows are listed rather than causing a crash.
- Grounding: [Artlogic artist payables workaround](https://support.artlogic.net/hc/en-gb/articles/15406651760028-How-to-Create-Artist-Payables-Documents-from-Advanced-Reports), [ArtCloud consignment report](https://help.artcloud.com/knowledge/consignment-reports-and-artist-payments)

### Corrections by reversal only

- What: payouts and holds can never be edited or deleted. No route updates or removes them, and the store rejects any write that changes a settled record. A mistaken payout is fixed with a `correction` entry that links to the original, reverses it and posts the corrected amount. Any money involved still moves only through `releaseTrust`, and the activity feed shows both entries.
- Why judges care: it is the ledger discipline Ramp engineers expect, and it is a direct contrast with incumbents that let a gallery delete a payment record.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It is enforced in the store and tests, and no demo beat depends on it.
- Grounding: [ArtCloud: edit or delete artist payments](https://help.artcloud.com/knowledge/edit-or-delete-artist-payments)

### Card and pay-later fees come out of operating, never trust

- What: an incoming payment records both its gross amount and the processor fee taken before it landed, for card or buy now pay later. The artist's hold is worked out on the gross amount, so operating cash absorbs the whole fee. The rule refuses any payment where the net that landed is smaller than the hold. Reconciliation counts only what actually landed, so the identity is unchanged, and a "fees paid by the gallery" line is shown for transparency.
- Why judges care: it is a real-world detail (card rails take a cut before cash lands) handled with a clear and testable rule about who bears it.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is one extra field on payment, and the main demo uses wires with no fee.
- Grounding: [Arternal: payments](https://arternal.com/pay), [Artlogic Payments](https://support.artlogic.net/hc/en-gb/articles/6922943625116-Artlogic-Payments-beta-), from the codebase (`PaymentMethod` already includes `card`)

### Terms precedence with per-artwork overrides

- What: terms resolve in a fixed order: artwork override, then the artist's agreement, then the gallery's default. The resolver returns the winning value and which layer it came from. The resolved share and payout days are frozen onto the sale when it is created, as `artistShareBps` already is, so a later change to the terms can never reprice existing holds. Tests cover each layer and the freeze.
- Why judges care: incumbents set terms at both the artist and artwork level, and getting precedence and immutability right is a correctness question.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is a pure resolver, and the demo artwork has no override.
- Grounding: [ArtCloud: artist consignment agreement and financials](https://help.artcloud.com/knowledge/manage-artists-consignment-agreement-and-financials), from the codebase (`Sale.artistShareBps`)

### Artist countersign before money moves

- What: terms read from an agreement start as `draft`. The gallery approves them, then the artist approves them on a simple portal page. A sale can only be created on terms both sides approved. Changing approved terms resets them to draft and leaves existing sales untouched. The UI shows two check marks next to the extracted numbers.
- Why judges care: it is two-party approval of the money rules, which Arcual uses, done without a separate platform.
- Demo visibility: both
- Effort: M
- Demo risk: med. It adds a click to the demo path unless the seed starts with both approvals in place, which it should.
- Grounding: [Arcual: how payments work](https://www.arcual.com/blog/how-do-payments-work-in-the-art-world)

### Statement a non-specialist can verify

- What: each artist statement line shows the payment date, the bank transaction id, the gross received, the commission, the hold, and the date it was paid or is due. The footer repeats that artist's own reconciliation: received share = paid + held + refunded. A test checks that the footer equals the sum of the lines for every artist after every operation.
- Why judges care: it passes the buyer's-guide test of a statement anyone can check, with every line traceable to a bank record.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It is derived from the snapshot.
- Grounding: [Serchen buyer's guide](https://www.serchen.com/blog/art-gallery-software-buyers-guide), [Art gallery consignment bookkeeping](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)

### Pre-payout match gate

- What: before `releaseTrust(artist)` runs, four checks must pass: the sale is complete or the hold is past `dueBy`, the hold's payment exists in the bank feed, the statement line exists, and the activity log has a matching `hold_locked` entry. Any failure blocks the payout and names the failed check. Deadline payouts can never be held back by a missing statement line, because that check only produces a warning on the deadline path.
- Why judges care: it is the match-before-paying control bookkeepers already use, done in code.
- Demo visibility: both
- Effort: M
- Demo risk: med. A bad check could block the live payout beat, so the gate needs a test that runs the full demo sequence.
- Grounding: [Art gallery consignment bookkeeping](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)

### Year-to-date paid per artist with a tax-form flag

- What: track each artist's calendar-year paid total from payouts and flag artists who cross a configurable reporting threshold. The default comes from the bookkeeping source's reading of the 1099-NEC rule ($2,000 for payments after 2025), and the screen tells the gallery to confirm how it applies to them. Missing payee details are flagged as well.
- Why judges care: a small piece of back-office fidelity that Ramp's customers deal with every January.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It is read-only and derived.
- Grounding: [Art gallery consignment bookkeeping](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)

### Deposit and installment schedule with overdue badges

- What: when a sale is created, generate a schedule as a deposit (fixed amount or percentage) plus equal installments that add up to the price exactly, with any remainder cents on the last one. Each expected payment gets a due date. Payments that land are matched to the schedule, and unpaid lines past their date show "overdue". Holds are unchanged: only money that actually lands is split.
- Why judges care: incumbents handle a deposit and then lose track of the rest, while this keeps the whole plan exact to the cent.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. The schedule is display-only and does not change the split logic.
- Grounding: [Artlogic Payments](https://support.artlogic.net/hc/en-gb/articles/6922943625116-Artlogic-Payments-beta-), [Serchen buyer's guide](https://www.serchen.com/blog/art-gallery-software-buyers-guide)

### Leave-anytime export bundle

- What: one route returns one JSON bundle holding CSV text for each table (sales, payments, holds, payouts, activity) plus a `manifest.json` with row counts and the reconciliation totals. A test re-imports the CSVs, runs `reconcile()` on them, and checks the result matches the manifest.
- Why judges care: data portability that proves itself on round-trip, which the buyer's guide asks about.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is a separate route.
- Grounding: [Serchen buyer's guide](https://www.serchen.com/blog/art-gallery-software-buyers-guide)
