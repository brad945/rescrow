# Disputes, cancellations, returns and chargebacks

## What we learned

- When a card payment is disputed, the disputed amount plus a fee is debited from the merchant's balance right away and held for the whole dispute. While the dispute is open, the merchant cannot issue a normal refund outside the dispute process. [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work)
- Card networks usually give cardholders 120 days from the payment to open a dispute. For future events or services, the window starts on the event date. Merchants then have about 7-21 days to respond, the issuer takes about 60-75 days to decide, and the whole lifecycle runs 2-3 months. [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work)
- The disputed amount can differ from the charge. Examples are a partial dispute over a single damaged item, or a buyer who got a partial refund and then disputes the full amount anyway. Inquiries on partially refunded charges can still escalate. [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work)
- A lost dispute is normally final, but the issuer can later reverse it into a "late win" and return the funds, so `lost` is not a terminal state you can rely on. Inquiries that sit unanswered for 120 days close as `warning_closed`. [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work)
- In a marketplace with destination charges or separate charges and transfers, the platform is ultimately liable for chargebacks. It recovers money from the seller by reversing the transfer. Stripe's advice on timing: if you accept the dispute, reverse now; if you challenge it, wait, and reverse only if you lose. [Stripe Connect: Handle refunds and disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)
- A partial refund with `reverse_transfer` pulls back a proportional share of the seller's transfer. The platform's fee is not returned unless `refund_application_fee` is set, and then it is prorated: a 40% refund of a charge with a $5 fee returns $2. With separate charges and transfers, refunding the charge does not touch the transfer at all, so the platform has to reconcile by reducing later transfers or reversing earlier ones. [Stripe Connect: Handle refunds and disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)
- If the platform balance cannot cover a refund, the refund sits as `pending` until funds arrive. A seller's negative balance is covered by a reserve on their available balance, or by debiting their bank account if that setting is on. [Stripe Connect: Handle refunds and disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)
- Escrow.com auto-accepts the goods for the buyer when the inspection period lapses. A rejected item gives the buyer 10 days to ship it back and the seller 5 days to inspect it. If the seller rejects the return, a 14-day negotiation period starts, followed by a 14-day window to begin third-party arbitration. The buyer pays return shipping, and the escrow fee is not refunded. [Escrow.com: Disputes](https://www.escrow.com/learn-more/how-escrow-works/escrow-dispute), [Escrow.com: buyer unsatisfied](https://www.escrow.com/support/faqs/what-happens-if-the-buyer-is-unsatisfied-with-their-merchandise?amp=true)
- Consumer ACH debits returned as unauthorized (R05, R07, R10, R11) can come back up to 60 days after settlement. Most other return codes must be sent within two banking days, and an entry returned as unauthorized cannot be re-sent without new authorization. [Nacha: ACH network risk topics](https://www.nacha.org/rules/ach-network-risk-and-enforcement-topics), [Plaid: ACH return codes](https://plaid.com/en-eu/resources/ach/ach-return/)
- Once the receiving bank accepts a wire, it can be cancelled only if that bank agrees (UCC 4A-211). In banking APIs, a reversal does not edit the original wire. It arrives as a separate debit transaction linked back to the original, which is then marked `reversed` and carries an ISO 20022 reason code. [Cornell LII: UCC 4A-211](https://www.law.cornell.edu/ucc/4A/4A-211), [Increase: Wire reversals](https://increase.com/documentation/wire-reversals)
- When a buyer defaults and the seller rightfully withholds the goods, the seller may keep a reasonable liquidated-damages amount if the contract sets one. Otherwise it keeps the lesser of 20% of the price or $500, and the buyer gets the rest back, less the seller's provable damages (UCC 2-718). [Cornell LII: UCC 2-718](https://www.law.cornell.edu/ucc/2/2-718)
- Under NY ACAL 12.01, consigned work and its sale proceeds are trust property and trust funds for the artist. They never become the merchant's property, and the merchant's creditors cannot reach them. An artist can waive the trust-funds rule only in a signed writing, and the waiver can never cover the first $2,500 of proceeds in any 12 months. Artists who are harmed can sue for damages and attorneys' fees. [NY Senate: ACA 12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)
- How much a gallery owes when a consigned work is damaged depends on the contract. Some galleries insure only the works they own, not consigned ones, and most damage happens in transit. [Arts Law Centre: Liability for damage to consigned artworks](https://www.artslaw.com.au/articles/entry/liability-for-damage-to-consigned-artworks/), [Huffington Post: Artists, is your work insured?](https://www.huffingtonpost.com/daniel-grant/artists-is-your-work-insu_b_1535342.html)
- Art marketplaces handle damage by offering a repair with a partial refund, a replacement, or a return. Artfinder refunds only once the work is back with the artist. Etsy holds back a percentage of new sales as a reserve against refunds and chargebacks, and usually releases it within 90 days or once tracking shows the item in transit. [Artfinder: Return FAQ](https://help.artfinder.com/article/878-return-faq), [Etsy: Payment account reserve](https://help.etsy.com/hc/articles/360058722214)
- For consumer electronic transfers, Reg E gives the bank 10 business days to investigate. It can take up to 45 days only if it provisionally credits the consumer within those first 10 days. [Cornell LII: 12 CFR 1005.11](https://www.law.cornell.edu/cfr/text/12/1005.11)

## How it applies to Rescrow

- `IncomingPayment.method` is already `wire | ach | card`, but the engine treats all three as equally final. In reality a wire is final once accepted, a consumer ACH debit can be returned for about 60 days, and a card can be charged back for about 120 days. Our deadline payout (`dueBy` = received + payoutDays) can pay the artist while a payment can still be reversed.
- `HoldStatus` is only `locked | paid | refunded`. Nothing models a hold whose underlying payment is under dispute. Stripe's model says disputed money is pulled immediately and held until the decision, which maps cleanly onto a frozen hold. That hold stays in trust and can still leave only through `releaseTrust(to: artist|buyer)`.
- `cancelSale` debits the gallery's part from operating without checking that operating can cover it, so the balance can go negative. When a hold has already been paid out at its deadline, that share is not refunded and the buyer silently absorbs the loss. Both are "who eats the loss" decisions, and today the code makes them implicitly.
- Every source agrees that the party that took the money is liable for chargebacks, whether that is the platform or merchant of record. For Rescrow, that party is the gallery. A chargeback after the artist has been paid should be absorbed by gallery operating, never by trust, and it must not be offset against another artist's trust. That keeps 12.01's rule that trust funds aren't the gallery's to net against.
- The reconcile equation needs new terms (frozen in dispute, reversed by the bank, absorbed by the gallery) before any of these flows can ship. Adding them keeps the "to the cent" claim honest.

## Feature ideas

### Dispute freeze on a hold

- What: Add a `disputed` hold status plus a `Dispute` record `{paymentId, amountCents, reason, openedAt, evidenceDueBy, status: open|won|lost}`. Opening a dispute freezes the matching hold in trust, which skips it in `releaseDueHolds` and pauses its `dueBy`. A won dispute puts it back to `locked`. A lost dispute calls `releaseTrust(to: buyer)`. The UI shows an amber "frozen" chip on the hold with an evidence countdown.
- Why judges care: it matches a real card-network lifecycle and still keeps the single-exit trust guard.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it's one extra key press (`D`) on a card payment, all deterministic
- Grounding: [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work), from the codebase (`HoldStatus`, `releaseTrust`)

### Chargeback after payout: the gallery eats it, trust never does

- What: If a dispute is lost on a payment whose hold was already paid to the artist, the engine debits gallery operating and records a `GalleryLoss` entry. If operating can't cover it, it records an unpaid `galleryShortfall`, never a negative balance. It optionally creates an `ArtistReceivable` that needs the artist's explicit sign-off and is never auto-offset against trust. A test asserts that no chargeback path moves any other hold.
- Why judges care: it answers the first question a payments engineer asks, "what happens on a chargeback after payout?"
- Demo visibility: both
- Effort: M
- Demo risk: low, because it's a pure engine path with tests, and the on-screen moment is one log line plus a balance change
- Grounding: [Stripe Connect: Handle refunds and disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes), [NY Senate: ACA 12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)

### Late-win-safe dispute state machine

- What: Encode dispute transitions as an explicit table, including Stripe's `lost -> won` late win and inquiry `warning_closed`. Reject any other transition with `EscrowError`. A late win after a buyer refund records the money as `recoveredFromBuyer` back into operating, never into trust. A property test runs random transition sequences and asserts that `reconcile()` stays balanced after every step.
- Why judges care: it shows we read the docs closely enough to handle the edge case most integrations miss.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because it isn't shown live
- Grounding: [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work)

### Partial refund for damage, with a running-total true-up

- What: `adjustPrice(saleId, newPriceCents, reason)` lowers the price, for example after a repair agreed for a damaged work. It recomputes the artist's total as `share(newPrice)` with the same running-total rounding, then takes the reduction out of locked holds, newest first. If the holds are already paid, the reduction is booked as a gallery loss. Fuzz tests check that artist plus gallery plus refund equals what was received, to the cent, for any split and any number of installments.
- Why judges care: it reuses D5's rounding rule on a hard case, a price change partway through a payment plan.
- Demo visibility: both
- Effort: M
- Demo risk: low, because the math is deterministic and the screen shows the before and after shares
- Grounding: [Stripe Connect: proportional reverse_transfer](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes), [Artfinder: Return FAQ](https://help.artfinder.com/article/878-return-faq), from the codebase (`artistShareOfPayment`)

### Who-eats-the-loss matrix

- What: A pure function `allocateLoss(scenario, state)` covers buyer cancels, damage while in the gallery, transit damage, chargeback before payout, chargeback after payout and bank return. It returns the split across trust, operating, buyer and a recorded artist receivable. A UI panel renders the matrix with the current sale's row highlighted. Every branch has a test, and one shared rule holds across them all: trust only ever pays the artist or the buyer.
- Why judges care: it makes policy readable and testable in one place instead of spread across handlers.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it's a static table on screen
- Grounding: [Stripe Connect: Handle refunds and disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes), [Arts Law Centre](https://www.artslaw.com.au/articles/entry/liability-for-damage-to-consigned-artworks/), [Cornell LII: UCC 2-718](https://www.law.cornell.edu/ucc/2/2-718)

### Buyer default with UCC 2-718 restitution

- What: Replace the all-or-nothing cancel with a settlement. The gallery keeps the agreement's liquidated-damages amount if a clause sets one (extracted by the agent step from saved answers, with a cited quote), otherwise min(20% of price, $500). The buyer gets the rest back, and the code decides whether the kept amount is split with the artist at the commission rate. This also fixes today's gap where a share paid out at its deadline is never refunded to the buyer.
- Why judges care: it replaces a made-up rule with real commercial law, and the agent's citation feature gets a second use.
- Demo visibility: both
- Effort: M
- Demo risk: med, because it changes the existing `C` cancel beat, so the demo script needs a re-check
- Grounding: [Cornell LII: UCC 2-718](https://www.law.cornell.edu/ucc/2/2-718), from the codebase (`cancelSale`)

### Finality windows per payment method

- What: Each payment gets `reversibleUntil`: a wire is final once received, ACH is received + 60 days, and a card is received + 120 days. Each hold card shows a ribbon of its `dueBy` against that reversibility window. Where the two overlap, a warning appears: "artist will be paid before this card can no longer be charged back." Payout behavior doesn't change. This feature only shows the risk.
- Why judges care: it shows we know how each rail actually behaves, which is Ramp's home turf.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low, because it's display only, computed from existing fields
- Grounding: [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work), [Nacha](https://www.nacha.org/rules/ach-network-risk-and-enforcement-topics), [Cornell LII: UCC 4A-211](https://www.law.cornell.edu/ucc/4A/4A-211), from the codebase (`PaymentMethod`)

### Returns and reversals in the bank feed

- What: The fake `BankFeed` can emit negative transactions (`ach_return` with an R-code, `wire_reversal` with an ISO reason) that point back to the original transaction id. Ingest is idempotent on the return's own id. It unwinds the matching hold through `releaseTrust(to: buyer)` if the hold is still locked, and books a gallery loss if it was paid. It never edits the original payment row, because a reversal is a new transaction, as in real bank APIs.
- Why judges care: it treats the money feed as an append-only log of corrections, like real core banking.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it uses the same polling path as payments, and the fake emits it on a key press
- Grounding: [Increase: Wire reversals](https://increase.com/documentation/wire-reversals), [Plaid: ACH return codes](https://plaid.com/en-eu/resources/ach/ach-return/), from the codebase (`BankFeed`, `rampTransactionId`)

### Gallery chargeback reserve, taken from operating

- What: Like Etsy's reserve, but funded by the gallery. For card and ACH payments still inside their reversal window, earmark the commission part of operating as `reservedCents`. It is shown separately and released as each window closes. Trust is untouched, and the reserve only means the gallery can't spend commission it may have to return. `reconcile()` treats the reserve as part of operating, with a check that it is never larger than operating.
- Why judges care: it answers "where does the money come from on a chargeback?" before the chargeback happens.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low, because it's an extra number in the gallery header
- Grounding: [Etsy: Payment account reserve](https://help.etsy.com/hc/articles/360058722214), [Stripe Connect: Handle refunds and disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)

### Inspection period before a sale completes

- What: An optional agreement field `inspectionDays`. After the final payment, the sale goes to `delivered`, not `paid`. The buyer can accept or reject, and if the window lapses the sale is auto-accepted, as on Escrow.com. The artist payout fires on acceptance, still capped by each hold's `dueBy`. A rejection opens a return flow: the work comes back, the gallery inspects it, then the buyer is refunded from trust and operating.
- Why judges care: it is how real escrow closes the gap between paying and receiving the goods.
- Demo visibility: both
- Effort: M
- Demo risk: med, because it delays the current same-day payout beat unless `inspectionDays` is 0 in the demo seed
- Grounding: [Escrow.com: Disputes](https://www.escrow.com/learn-more/how-escrow-works/escrow-dispute), [Escrow.com: buyer unsatisfied](https://www.escrow.com/support/faqs/what-happens-if-the-buyer-is-unsatisfied-with-their-merchandise?amp=true)

### Insolvency with a dispute still open

- What: Extend `declareInsolvency` so that disputed holds are neither paid to the artist nor given to creditors. They stay in trust, marked `awaiting decision`, and resolve later to the artist or the buyer. The insolvency screen shows a third column, "held for dispute: $X, still never creditors."
- Why judges care: it stress-tests the climax beat against the obvious follow-up question.
- Demo visibility: both
- Effort: S
- Demo risk: low, because it's an optional variant of beat 6 and the existing beat is unchanged
- Grounding: [NY Senate: ACA 12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01), from the codebase (`declareInsolvency`)

### Refund ledger caps and idempotency

- What: Each payment carries `refundedCents` and `disputedCents`. Any refund, dispute or reversal must satisfy `refunded + disputed + reversed <= amount`, and duplicate requests are no-ops keyed by an idempotency key. A property test fires random interleavings of refunds, disputes and returns at one payment and asserts that the buyer is never paid twice. That is the failure behind Visa's 13.6 "credit not processed" disputes.
- Why judges care: double refunds are a classic real money bug, and this proves we can't have one.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low, because it isn't shown live
- Grounding: [Stripe: How disputes work](https://docs.stripe.com/disputes/how-disputes-work), [Visa: merchant disputes](https://usa.visa.com/run-your-business/merchant-support/merchant-disputes.html)

### Damage or loss: insurance proceeds go to trust

- What: An artwork can be marked `damaged` or `lost` while the gallery holds it. A deterministic insurance payout (fake feed credit) is then split by the agreement: the artist's share of the agreed value goes into trust as a hold with its own `dueBy`, and the rest goes to operating. If the agreement has no insurance clause, the agent step flags it and a person must enter the value before money moves.
- Why judges care: it covers the case galleries actually fight about, the artist losing the work and the payment together.
- Demo visibility: both
- Effort: M
- Demo risk: med, because it needs new seed data and a clause in the saved agreement answers
- Grounding: [Arts Law Centre](https://www.artslaw.com.au/articles/entry/liability-for-damage-to-consigned-artworks/), [NY Senate: ACA 12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)

### Cross-artist isolation property test

- What: A fuzz test builds a gallery with several artists and random sales. It applies random chargebacks, returns, cancels and insolvency, then asserts that every hold belonging to an unaffected sale is byte-identical before and after, and that `reconcile()` balances at every step. The output is a single readable report.
- Why judges care: it turns "one artist's dispute can't touch another artist's money" into a proof, not a promise.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low, because it isn't shown live
- Grounding: from the codebase (`invariants.test.ts`, `reconcile`), [NY Senate: ACA 12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)
