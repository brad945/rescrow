# Cross-border art sales: FX, multi-currency ledgers, fairs abroad and wire fees

What changes when the collector pays in euros, the artist lives in Berlin, or the work sells at a fair in London, and how a ledger keeps every minor unit exact across currencies.

## What we learned

- Currencies don't all have two decimals. Payment APIs take amounts in the smallest unit: JPY, KRW and VND have 0 decimals, and BHD, JOD, KWD, OMR and TND have 3. Adyen also lists CLP, CVE, IDR and ISK as cases where its own table differs from ISO 4217, and says its table wins. [Adyen: currency codes](https://docs.adyen.com/development-resources/currency-codes)
- Stripe documents more edge cases. ISK and UGX are zero-decimal in practice, but they are sent as two-decimal values that must end in `00`. HUF and TWD can be charged with decimals, but manual payouts must be divisible by 100, so a HUF 10.45 balance can only pay out HUF 10. [Stripe: supported currencies](https://docs.stripe.com/currencies)
- Modern Treasury gives every ledger account one fixed currency and reports a `currency_exponent` with each balance (2 for USD, 0 for JPY). Debits must equal credits within each currency. Its USD-to-JPY example is one atomic transaction with two balanced pairs of entries, one per currency, and the rate goes in metadata. [Modern Treasury: use multiple currencies](https://docs.moderntreasury.com/ledgers/docs/use-multiple-currencies)
- hledger warns that recording a conversion with only an implied rate lets one currency turn into another "in flight". Its fix is to post each currency against an `equity:conversion` account, so every currency balances on its own and the conversion account keeps the history of exchanges. [hledger: cost notation](https://hledger.org/cost-notation.html)
- Without trading accounts, Selinger argues, you can't tell an imbalance caused by currency exchange from one caused by an arithmetic or data-entry error. That is the reason to keep FX in its own named account. [Selinger: multiple currency accounting in GnuCash](https://www.mathstat.dal.ca/~selinger/accounting/gnucash)
- Under US GAAP, a foreign-currency transaction is recorded at the rate on the transaction date. Monetary items still open are remeasured at each balance-sheet date and at settlement, and the difference goes to income as a transaction gain or loss. [KPMG: foreign currency handbook](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2025/handbook-foreign-currency.pdf)
- The ECB publishes euro reference rates around 16:00 CET on working days, based on a concertation among central banks around 14:10 CET. The ECB says they are for information, not for transactions. The rate a bank actually executes at is a different number. [ECB: euro foreign exchange reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)
- On Ramp Bill Pay, the FX rate for a foreign-currency payment is set when the payment is initiated, and the rate shown on the bill beforehand is only an estimate. Local-currency rails cover EUR, GBP, JPY, CAD, MXN and others. Most transfers take 1 to 5 business days. "Fast FX" (about 30 minutes) is not offered to New York State businesses, and the demo gallery is in New York. A SWIFT USD transfer has a $20 fee when it is funded from an external bank. [Ramp: international transfers on Bill Pay](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay)
- SWIFT charge codes decide who pays wire fees. With OUR, the sender pays everything and the full amount arrives. With SHA, each side pays its own bank and intermediary fees come out of the payment. With BEN, every fee is deducted from the payment. The ISO 20022 equivalents are DEBT, SHAR and CRED. Under SHA or BEN, the amount credited can be less than the invoice. [SEPA for Corporates: BEN, OUR and SHA](https://www.sepaforcorporates.com/swift-for-corporates/payment-fees-the-difference-between-ben-our-and-sha/amp/)
- The UK taxes imported works of art on a reduced value. Customs multiplies the value by 25% and then applies the 20% standard rate, for an effective 5%. Works brought in for exhibition "with a view to possible sale" fall under special procedures, which need full VAT security unless the trader uses temporary admission. [HMRC Imports manual IMPS05200](https://gov.uk/hmrc-internal-manuals/imports/imps05200)
- An ATA carnet can cover works of art brought into the UK for exhibition with a view to possible sale. Many other countries' carnet rules exclude goods meant for sale. [GOV.UK: which goods an ATA carnet covers](https://www.gov.uk/guidance/find-out-which-goods-an-ata-carnet-will-cover)
- The UK Artist's Resale Right moved from euros to pounds for sales from 1 April 2024. It applies at £1,000 or more, uses cumulative bands from 4% down to 0.25%, and is capped at £12,500. It is paid through collecting societies and covers resales, not the first sale of a consigned work. [GOV.UK: artist's resale right](https://www.gov.uk/guidance/artists-resale-right)
- A foreign individual gives a US payer Form W-8BEN to certify foreign status, ideally before payment. Without it, the payer may have to withhold. Whether a foreign artist's share of a consignment sale is withholdable income at all is a separate question that we did not verify. [IRS: instructions for Form W-8BEN](https://www.irs.gov/instructions/iw8ben)

## How it applies to Rescrow

- Today `Cents` is a bare `number`, `formatCents` hardcodes USD, and `reconcile()` works in one currency. The cheapest faithful model keeps USD as the gallery's functional currency. Every ledger amount stays integer USD cents, and `reconcile()` keeps its equation. Foreign currency is recorded as provenance on the payment (original currency, minor units, exponent, executed rate), with a second check proving the conversion was exact.
- Rates have to come from a seeded, dated table so the app stays offline and deterministic. Store rates as integers or ratios (for example, USD micro-units per EUR unit) and do the multiplication in `BigInt`. Never use a float rate.
- The artist's share needs one stated rule for each new edge case. Is it computed in the buyer's currency or in USD? On the invoiced amount or the amount that landed? Where do rounding residuals go? Each answer becomes a test and a line in the decisions log. `shareOf` rounds per payment today, and D5 already establishes running-total rounding, so the FX residual must be applied before the split, never inside trust.
- Anything the gallery owes because of the sale (import VAT, wire fees, FX spread) is paid from operating. None of it is a way out of trust. `releaseTrust(to: artist|buyer)` stays the only exit. That rules out folding resale royalties or tax withholding into trust, since each would need a third exit.
- A foreign artist's payout deadline should mean the money arrives, not that it is sent. Ramp's 1 to 5 business days, and no Fast FX for a New York gallery, turn `dueBy` into a scheduling problem with a lead time.

## Feature ideas

### FX provenance on every payment

- What: Add `original: { currency, minor, exponent }`, `rateId` and `executedRate` (an integer numerator over a power-of-ten scale) to `IncomingPayment`. The fake BankFeed emits a EUR wire with these fields, and ingest checks that `amountCents === roundHalfEven(minor × rate)` after adjusting exponents, all in `BigInt`. The split and trust logic stay unchanged because they already see USD cents.
- Why judges care: it shows we know the rate is data with a source and a date, not a magic multiplier.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it is additive and the USD path is untouched.
- Grounding: [Modern Treasury: use multiple currencies](https://docs.moderntreasury.com/ledgers/docs/use-multiple-currencies), [Ramp: international transfers](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay), from the codebase (`IncomingPayment`, `shareOf`)

### Reference rate vs executed rate, with the spread shown

- What: Seed a small dated table of ECB-style reference rates next to the bank's executed rate for each payment. Each EUR payment card shows "reference 1.0841, executed 1.0790, spread 47 bps = $41.18". The spread is booked as a gallery FX cost from operating, so the artist's share uses the USD that actually landed (or the reference rate, if the agreement says so).
- Why judges care: Ramp sells FX, and showing the gap between the mid-market rate and the executed rate is the honest view their engineers will recognize.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low, because the numbers are static seed data.
- Grounding: [ECB: reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), [Ramp: international transfers](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay)

### Short wires: SHA/BEN fee deductions with an explicit rule

- What: Record `chargeBearer: "OUR" | "SHA" | "BEN"`, `invoicedMinor` and `creditedMinor` on a wire. The rule, read from an agreement clause, is that the artist's share is computed on the invoiced amount, so trust is fully funded and the gallery covers the shortfall from operating. If operating can't cover it, the payment is flagged `underfunded` and the share is computed on the net amount, with the gap shown as owed by the gallery. Reconcile still balances, because received means what landed.
- Why judges care: every finance engineer has seen a wire arrive $15 short, and the model handles it without leaking a cent.
- Demo visibility: both
- Effort: M
- Demo risk: med, because it adds a branch to the split path and needs tests around the operating top-up.
- Grounding: [SEPA for Corporates: BEN, OUR and SHA](https://www.sepaforcorporates.com/swift-for-corporates/payment-fees-the-difference-between-ben-our-and-sha/amp/)

### Installments in euros: the share is exact in the buyer's currency

- What: For a €22,000 sale in three installments, compute the artist's 50% with D5 running-total rounding in euro cents first, then convert both the trust leg and the operating leg at that payment's rate. Any USD rounding residual from the conversion goes to operating, never to trust. The statement shows the artist got exactly €11,000.00 across three different rates, plus the USD value each day.
- Why judges care: it answers "whose currency is the share in?" with a test, not a shrug.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it is pure functions with property tests.
- Grounding: [KPMG: foreign currency handbook](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2025/handbook-foreign-currency.pdf), from the codebase (D5 in `docs/PRD.md`)

### Currency registry and minor-unit property tests

- What: Add a `currencies.ts` table with each currency's exponent (USD 2, JPY 0, KWD 3) and its payout quirks (ISK and UGX sent as two decimals ending in `00`; HUF and TWD payouts divisible by 100). Add a `Money { currency, minor }` type used only at the FX boundary, plus fast-check properties: conversion never creates or destroys minor units beyond the recorded residual, and formatting round-trips.
- Why judges care: zero- and three-decimal currencies are a classic production bug, and property tests show we went looking for it.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because nothing on screen depends on it.
- Grounding: [Adyen: currency codes](https://docs.adyen.com/development-resources/currency-codes), [Stripe: supported currencies](https://docs.stripe.com/currencies)

### Per-currency reconciliation with a conversion account

- What: Alongside the USD `reconcile()`, add `reconcileByCurrency()`. Each EUR receipt is posted as two balanced pairs through an `fx:conversion` account (EUR in, EUR out to conversion; USD in from conversion, USD split to operating and trust). The proof is that every currency nets to zero on its own and the conversion account equals the recorded spread plus rounding.
- Why judges care: it is the textbook way to separate FX effects from bugs, which is the property Rescrow promises "to the cent".
- Demo visibility: repo-rigor
- Effort: L
- Demo risk: low on screen, but it is a large change to test thoroughly.
- Grounding: [hledger: cost notation](https://hledger.org/cost-notation.html), [Selinger: GnuCash multiple currencies](https://www.mathstat.dal.ca/~selinger/accounting/gnucash), [Modern Treasury: use multiple currencies](https://docs.moderntreasury.com/ledgers/docs/use-multiple-currencies)

### Pay a foreign artist in their own currency

- What: An artist record gets `payoutCurrency: "EUR"`. `releaseTrust(to: artist)` is unchanged and still moves USD out of trust. The `Payout` records `quoteRate`, `rateSetAt` (initiation) and `deliveredMinor`. The artist portal shows "€5,412.30 sent at 1.0790, rate fixed at initiation". Trust is measured and released in USD, so the FX risk after release sits with the payment rail, not with trust.
- Why judges care: it mirrors how Ramp Bill Pay sets the rate at initiation, and the trust guard is still one function.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low, because the conversion is seeded and stored as metadata on an existing exit.
- Grounding: [Ramp: international transfers](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay)

### Deadline means arrival: rail-aware payout scheduling

- What: Compute `initiateBy = dueBy − railLeadDays` on a business-day calendar. Lead days are 0 for a US ACH same-day payout, 1 to 5 for international, and Fast FX is skipped because the gallery is in New York State. Weekends and a seeded holiday list are excluded. The sweep releases a hold at `initiateBy`, not at `dueBy`, and a test proves a Friday deadline for a Berlin artist triggers on Tuesday.
- Why judges care: it turns "never later than the agreement" from a promise into a scheduling guarantee across borders.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it is a pure date function driven by the demo clock.
- Grounding: [Ramp: international transfers](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay), from the codebase (`EscrowHold.dueBy`)

### Art fair abroad: temporary admission and import VAT

- What: A work shipped to a London fair carries `importStatus: "temporary_admission"`. If it sells to a UK buyer, the app computes UK import VAT as 25% of value × 20% = 5%, books it as a gallery liability in operating, and records that the artist's share is computed on the price excluding VAT. If it is re-exported unsold, the status closes with no VAT. Trust never pays tax.
- Why judges care: real art-market fidelity that most fintech demos never reach, with a clear line between the gallery's tax and the artist's money.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med, because tax rules vary and the screen must label it as an illustrative UK case.
- Grounding: [HMRC IMPS05200](https://gov.uk/hmrc-internal-manuals/imports/imps05200), [GOV.UK: ATA carnet goods](https://www.gov.uk/guidance/find-out-which-goods-an-ata-carnet-will-cover)

### Foreign payee check before the first payout

- What: A foreign artist must have `taxForm: { kind: "W-8BEN", receivedAt }` on file before `releaseTrust(to: artist)` sends a payout. If it is missing, the hold stays locked in trust (it is never redirected), the dashboard shows "Waiting on W-8BEN", and the deadline sweep raises an alert instead of paying. No amount is deducted.
- Why judges care: it shows compliance gates that block an exit without ever creating a new one.
- Demo visibility: both
- Effort: S
- Demo risk: low, because it is one guard plus a badge. The tax treatment itself is out of scope and the screen says so.
- Grounding: [IRS: instructions for Form W-8BEN](https://www.irs.gov/instructions/iw8ben)

### Insolvency with artists in three currencies

- What: Seed one US artist, one paid in EUR and one in GBP. At beat 6, show trust broken down by each artist's payout currency, pay each in their own currency, and show creditors taking only operating USD. Reconcile and per-currency balances both show green.
- Why judges care: the demo climax holds even when the money crosses borders, which matches the Stephen Friedman case (a London gallery) used as the hook.
- Demo visibility: shown-on-screen
- Effort: M (after "Pay a foreign artist in their own currency")
- Demo risk: med, because it changes the climax screen and needs a full dry run.
- Grounding: from the codebase (`POST /api/demo/insolvency`), [Ramp: international transfers](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay)

### Resale royalty as a documented boundary

- What: Don't build an ARR deduction. Add a short decisions-log entry and a test that `releaseTrust` rejects a `collecting_society` destination. ARR applies to resales and is paid to collecting societies, so supporting it would need a new audited exit and belongs to a secondary-market extension.
- Why judges care: knowing what not to build, and why, is part of the rigor story.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low, because it is documentation plus one test.
- Grounding: [GOV.UK: artist's resale right](https://www.gov.uk/guidance/artists-resale-right)
