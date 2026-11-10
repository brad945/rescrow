# US payment rails, settlement timing, and payments that bounce

## What we learned

- **Push vs pull is what decides the risk.** Money the buyer pushes to the gallery (wire, RTP, FedNow, ACH credit) is close to final once it lands. Money the gallery pulls (ACH debit, card, deposited check) can be taken back days or months later. ACH debits are returnable, a card can be charged back, and a check can bounce after the funds were made available. Sources for each are below.
- **Fedwire is final on credit.** A Fedwire payment to the receiving bank is final and irrevocable once it is credited to that bank's account or the payment order is sent to it. The only way back is a request that the other side may refuse. [Federal Reserve, Fedwire core principles](https://www.federalreserve.gov/paymentsystems/fedfunds_coreprinciples.htm)
- **Instant payments are final too, and returns are voluntary.** The receiving bank of an instant payment can be asked to send it back but doesn't have to. The Clearing House describes RTP as "immediate, final settlement to the payee." [Atlanta Fed, Take on Payments](https://www.atlantafed.org/research-and-data/publications/take-on-payments/2023/10/30/how-do-you-say-irrevocable)
- **FedNow is credit-push only and runs 24/7/365.** Each transfer is capped at $10,000,000. Settled transfers can't be reversed by the sender, and the network carries only a return _request_ message. [Increase, FedNow overview](https://increase.com/documentation/fednow)
- **RTP raised its per-transaction limit from $1M to $10M in February 2025.** It runs 24/7, 365 days a year. [The Clearing House](https://www.theclearinghouse.org/payment-systems/Articles/2025/06/RTP-10m-Limit)
- **Same Day ACH has three windows.** A transfer must be submitted before the 4:45pm ET cutoff on a business day and be $1,000,000 or less to settle the same day. Anything later or larger settles the next business day. [Increase, FedACH](https://increase.com/documentation/fedach), [Nacha, $1M limit](https://www.nacha.org/news/same-day-ach-payment-limit-increase-1-million)
- **ACH return windows depend on the code.** Administrative returns have 2 banking days: R01 insufficient funds, R02 account closed, R03 no account, R04 invalid number, R08 stop payment, R16 frozen, R29 corporate unauthorized. Consumer unauthorized returns have 60 calendar days: R05, R07, R10. [Plaid, ACH return codes](https://plaid.com/resources/ach/ach-return/)
- **A transfer can count as "settled" before it is safe.** At Column, an outbound debit settles if no return arrives within 2 business days, but returns can still arrive for up to 60 calendar days. Each entry can be returned only once. The originating bank can dishonor a return within 5 banking days, using codes R61 to R70. [Column, ACH returns](https://docs.column.com/ach/returns)
- **Late returns are possible.** One can go through if the originating bank accepts it, and the originator then has 10 banking days to produce proof of authorization. A return shows up as a new transaction tied back to the original transfer. [Increase, ACH returns](https://www.increase.com/documentation/ach-returns)
- **The originator can ask for money back too.** Since October 1, 2024, an originating bank can request a return (R06) for any reason. The receiving bank must report its decision within 10 banking days. [Nacha, Oct 1 2024 rules](https://www.nacha.org/rules/risk-management-topics-october-1-2024)
- **Fraud monitoring now applies to incoming credits.** Phase 1 of Nacha's 2026 rules requires receiving banks to monitor incoming credits. A bank that suspects fraud or "false pretenses" may return a credit with R17 and is exempt from the normal funds-availability rule for it. So even a pushed ACH credit is not perfectly final. [Nacha, Fraud Monitoring Phase 1](https://www.nacha.org/newrules)
- **Ledgers usually split "pending" from "available".** Lithic posts an incoming ACH as pending at Settled and moves it to available only at Released, a separate later event. A return started after that takes the money back out of available. [Lithic, ACH payments lifecycle](https://docs.lithic.com/docs/ach-payments-lifecycle)
- **Reg CC defines when a payment has been "received".** Electronic payments must be available by the business day after receipt. A payment counts as received only once the bank holds final collected funds, and only up to the amount collected. [12 CFR 229.10 (Cornell LII)](https://www.law.cornell.edu/cfr/text/12/229.10)
- **Escrow law already has a "good funds" rule.** California bars title and escrow companies from paying out of escrow before the deposit is available. Drafts must be collected before they can be paid out, while cash and electronic payments are exempt from the next-day wait. [Cal. Ins. Code 12413.1 (FindLaw)](https://codes.findlaw.com/ca/insurance-code/ins-sect-12413-1/)
- **Cards and checks can come back late.** Visa cardholders typically have about 120 days to dispute a charge, and longer for future-delivery purchases. The FTC warns it "can take weeks for a bank to figure out" a check is fake, and the depositor repays it. [ClearSale, chargeback time limits](https://clear.sale/blog/what-is-the-time-limit-on-chargebacks), [FTC, fake check scams](https://consumer.ftc.gov/articles/how-spot-avoid-and-report-fake-check-scams)
- **Deadlines need a banking calendar.** FedACH doesn't process on Federal Reserve holidays. In 2026 that includes Veterans Day (Nov 11), Thanksgiving and Christmas. "2 banking days" and "60 calendar days" fall on different dates. [FRB Services, 2026 FedACH holiday schedule](https://www.frbservices.org/news/fed360/issues/2026-holiday-schedule-fedach-services/)

## How it applies to Rescrow

- **Rescrow treats every payment as final the moment it lands.** `receivePayment` locks the artist's share right away, and a fully paid sale pays out the same day. For wires and instant payments that is correct. For an ACH debit, card or check, Rescrow could pay the artist with money the buyer's bank later takes back.
- **`PaymentMethod = "wire" | "ach" | "card"` is too coarse.** An ACH credit pushed by the buyer and an ACH debit pulled by the gallery carry very different return risk, so `ach` needs to split into `ach_credit` and `ach_debit`. `rtp`, `fednow` and `check` should be added so the finality rules can be written as data.
- **A returned payment has to leave the books without breaking the trust guard.** If the hold is still locked, the artist's share leaves through `releaseTrust(to: buyer)`, the same path `cancelSale` already uses, and the commission comes out of operating. If the share was already paid out, the loss falls on operating. It must never come out of another artist's trust.
- **`reconcile()` has no term for money that came in and went back out on its own.** Adding a "returned" column keeps the to-the-cent proof honest when a payment bounces.
- **The Ramp feed is polled, not pushed (PRD).** So a return is just another transaction with its own id that points to the original. The existing idempotency on `rampTransactionId` carries over.
- **Each hold's `dueBy` is in calendar days today.** Return windows are a mix of banking days and calendar days, so a small holiday calendar makes both deadlines exact and still deterministic.

## Feature ideas

### Good-funds gate on trust payouts

- **What:** Each hold gets a `finalAt` timestamp worked out from its rail: wire, RTP and FedNow are final on receipt; ACH debit after 2 banking days; check after a configured collection period. Payout of a hold happens at the later of sale-complete and `finalAt`. Until then the hold shows as `settling` rather than `locked`. Following Reg CC's idea of "received" (collected funds), the agreement's payout days count from `finalAt`, so `dueBy = finalAt + payoutDays` and the deadline can always be met with good funds. The demo's final payment is a wire, so the same-day payout beat is unchanged.
- **Why judges care:** It mirrors a real escrow rule (California's good-funds law) and shows we know "landed" is not the same as "final".
- **Demo visibility:** both
- **Effort:** M
- **Demo risk:** low. Wire-funded demo payments behave exactly as today; only non-wire rails change.
- **Grounding:** [Cal. Ins. Code 12413.1](https://codes.findlaw.com/ca/insurance-code/ins-sect-12413-1/), [12 CFR 229.10](https://www.law.cornell.edu/cfr/text/12/229.10), [Column, ACH returns](https://docs.column.com/ach/returns)

### Returned payment flow with R-codes

- **What:** Add a `PaymentReturn { id, paymentId, code: "R01" | "R02" | "R10" | ..., returnedAt, amountCents, rampTransactionId }` and a `returnPayment()` engine function. If the hold is still locked or settling, the artist's share leaves trust through `releaseTrust(to: buyer)` with reason `return:R01`, and the gallery's commission is debited from operating, which is allowed to go negative. `paidSoFar` drops and the sale goes back to `open`. `reconcile()` gains `returnedCents`: opening + received = operating + trust + paid + refunded + claimed + returned. Return codes and their windows live in one table, and a return filed after its code's window is rejected unless marked `late: true`.
- **Why judges care:** Handling a bounce the way real ACH returns work, with named codes and windows, shows real-world fidelity.
- **Demo visibility:** both (an optional "payment 2 bounced, R01" key, like the existing `C` cancel key)
- **Effort:** M
- **Demo risk:** med. A new key press adds a beat to a demo capped at 3:00, so keep it optional like the cancel beat.
- **Grounding:** [Plaid, ACH return codes](https://plaid.com/resources/ach/ach-return/), [Increase, ACH returns](https://www.increase.com/documentation/ach-returns), from the codebase (`cancelSale` refund path)

### Artist payout bounces back into trust

- **What:** When a payout to the artist comes back (R02 account closed, R03 no account), the payout is marked `returned`, its holds go back to `locked` under the same artist, and a `payout_returned` event asks for new bank details. None of that money touches operating. A test asserts that a returned payout raises trust for that artist only, by exactly the payout amount.
- **Why judges care:** It shows trust money protected in the other direction too. A failed payout can't quietly turn into gallery cash.
- **Demo visibility:** both (artist phone view shows "payout returned, update your bank"; repo has the invariant test)
- **Effort:** S
- **Demo risk:** low. It is a single state change on the artist view.
- **Grounding:** [Plaid, ACH return codes](https://plaid.com/resources/ach/ach-return/), [Lithic, ACH payments lifecycle](https://docs.lithic.com/docs/ach-payments-lifecycle)

### Late return absorbed by operating, never by other artists

- **What:** If a payment is returned after its hold was already paid to the artist (for example an R10 60 days later), Rescrow doesn't claw the money back from the artist. The full amount is debited from operating, and a `returnShortfallCents` line records the part that wasn't covered by a locked hold. A property test checks that no return ever lowers trust belonging to a different artist or sale. If the gallery is insolvent, the shortfall is listed alongside creditor claims rather than taken from trust.
- **Why judges care:** It makes the policy "the gallery carries rail risk, artists don't" explicit and enforced in code.
- **Demo visibility:** repo-rigor
- **Effort:** M
- **Demo risk:** low. It isn't shown live and lives in tests.
- **Grounding:** [Increase, ACH returns](https://www.increase.com/documentation/ach-returns), [Plaid, ACH return codes](https://plaid.com/resources/ach/ach-return/), from the codebase (`declareInsolvency`)

### Rail table as data

- **What:** Replace the three-value `PaymentMethod` with a `RAILS` table keyed by `wire | rtp | fednow | ach_credit | ach_debit | card | check`. Each row records direction (push or pull), finality rule (on receipt, N banking days, N calendar days), per-transaction cap ($1M Same Day ACH, $10M RTP and FedNow), and which return codes can apply. Engine rules read the table instead of branching on strings, and one test per row pins the values.
- **Why judges care:** It turns rail knowledge into one reviewable, sourced table that the other features build on.
- **Demo visibility:** repo-rigor
- **Effort:** S
- **Demo risk:** low. It is pure data plus a type change.
- **Grounding:** [Increase, FedNow](https://increase.com/documentation/fednow), [The Clearing House, RTP limit](https://www.theclearinghouse.org/payment-systems/Articles/2025/06/RTP-10m-Limit), [Nacha, $1M Same Day ACH](https://www.nacha.org/news/same-day-ach-payment-limit-increase-1-million)

### Return transactions in the bank feed

- **What:** The fake `BankFeed` can emit a return transaction with its own id and an `originalTransactionId`. Ingest is idempotent on the return's id and matches it to the original payment. A return with no matching original, or a second return for the same payment, is rejected and appears as a named break in `reconcile()`, mirroring the network rule that an entry can be returned only once.
- **Why judges care:** It fits the polled feed we already model, and the edge cases (duplicates, orphans) are what a payments engineer looks for.
- **Demo visibility:** repo-rigor
- **Effort:** S
- **Demo risk:** low. It is backend and tests only.
- **Grounding:** [Column, ACH returns](https://docs.column.com/ach/returns), [Increase, ACH returns](https://www.increase.com/documentation/ach-returns), from the codebase (`rampTransactionId`)

### Banking-day calendar for deadlines

- **What:** A pure `addBankingDays(date, n)` that skips weekends and a hard-coded list of 2026 Federal Reserve holidays, next to the existing `addDays`. Return windows use banking days or calendar days as their code requires (R01 is 2 banking days, R10 is 60 calendar days). `dueBy` keeps calendar days unless the agreement says business days. Tests cover the Thanksgiving week and Veterans Day edges.
- **Why judges care:** Off-by-one-holiday deadlines are a classic payments bug, and getting them exact offline shows care.
- **Demo visibility:** repo-rigor
- **Effort:** S
- **Demo risk:** low. It is deterministic and has no network calls.
- **Grounding:** [FRB Services, 2026 FedACH holidays](https://www.frbservices.org/news/fed360/issues/2026-holiday-schedule-fedach-services/), [Plaid, ACH return codes](https://plaid.com/resources/ach/ach-return/)

### Finality badges on each hold

- **What:** Each hold row and the artist's phone view show the rail and a small status: "Final" for a wire, or "Settling, returnable until Nov 13" for an ACH debit, with a thin progress bar from received to `finalAt`. The badge reads straight from the Snapshot, so the UI needs no new logic.
- **Why judges care:** It shows on screen, in a second, that the system knows each dollar's risk.
- **Demo visibility:** shown-on-screen
- **Effort:** S
- **Demo risk:** low. It is display-only and needs no extra demo beat.
- **Grounding:** [Lithic, ACH payments lifecycle](https://docs.lithic.com/docs/ach-payments-lifecycle), from the codebase (Snapshot polling)

### Random-sequence reconciliation test

- **What:** A seeded property test generates random sequences of payments on mixed rails, returns, late returns, payout bounces, cancels and insolvency. After every step it asserts that `reconcile()` balances to the cent, that trust per artist never drops except through that artist's payout or a refund to that sale's buyer, and that no trust cent reaches operating or creditors. A fixed seed keeps it deterministic, and failing seeds are saved as regression cases.
- **Why judges care:** It shows the invariant holds under any order of events, not just the demo path.
- **Demo visibility:** repo-rigor
- **Effort:** M
- **Demo risk:** low. It isn't shown live.
- **Grounding:** from the codebase (`invariants.test.ts`, `reconcile.ts`)

### Payout rail and cutoff planner

- **What:** When a payout is due, choose its rail deterministically. Use RTP or FedNow if the artist's bank is marked instant-capable and the amount is within the $10M cap. Otherwise use Same Day ACH if the payout is before 4:45pm ET and at most $1M. Otherwise use next-day ACH. Each payout records `rail` and `expectedSettleAt`, and the statement says "Sent by RTP, final 10:02am" or "Same Day ACH, settles today". A $1.5M payout is never split to fit under the cap, following Nacha's rule.
- **Why judges care:** "Paid the same day" becomes a claim the code can back up for a given time of day and amount.
- **Demo visibility:** both
- **Effort:** M
- **Demo risk:** low. The fixed demo clock gives a fixed result.
- **Grounding:** [Increase, FedACH](https://increase.com/documentation/fedach), [Nacha, $1M Same Day ACH](https://www.nacha.org/news/same-day-ach-payment-limit-increase-1-million), [Increase, FedNow](https://increase.com/documentation/fednow)

### Gallery-funded chargeback reserve for card payments

- **What:** A card payment's artist share can be charged back for about 120 days. Rescrow still pays the artist on schedule, but moves an equal amount from operating into a `chargebackReserve` sub-ledger owned by the gallery (not trust) until the window closes. A chargeback is paid from that reserve first. `reconcile()` adds a reserve term. Insolvency treats the reserve as gallery property, so creditors can take it but trust is unaffected.
- **Why judges care:** It keeps the artist whole without pretending card money is final, and keeps two kinds of "held" money cleanly apart.
- **Demo visibility:** repo-rigor
- **Effort:** M
- **Demo risk:** low. The demo uses wires.
- **Grounding:** [ClearSale, chargeback time limits](https://clear.sale/blog/what-is-the-time-limit-on-chargebacks), from the codebase (`declareInsolvency`)

### ACH return-rate monitor

- **What:** A pure function over a gallery's payments and returns that computes the unauthorized return rate (R05, R07, R10, R11, R29, R51) and the overall return rate. It flags the gallery at Nacha's 0.5% and 15% thresholds, and the gallery dashboard shows the two rates with the thresholds marked.
- **Why judges care:** It is a small, real compliance signal that payments teams track.
- **Demo visibility:** shown-on-screen
- **Effort:** S
- **Demo risk:** low. It is a read-only number.
- **Grounding:** [Plaid, ACH return codes](https://plaid.com/resources/ach/ach-return/)
