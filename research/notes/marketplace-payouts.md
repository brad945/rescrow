# Marketplace and platform payouts: splits, reserves, delayed payouts

## What we learned

- With Stripe's separate charges and transfers, the charge lands on the platform and the platform decides how much to transfer to each seller. One charge can feed several transfers, and the `transfer_group` label only links the records together. It has no effect on how money moves. [Stripe: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- A transfer tied to a charge (`source_transaction`) can't exceed that charge, and all the transfers from one charge together can't exceed it either. The transfer inherits the charge's pending period, so the seller's funds become available on the same day the charge settles. [Stripe: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- Refunding a Stripe charge doesn't touch transfers already sent. The platform has to recover the money itself, by reversing the transfer or sending less next time. If an ACH or SEPA payment fails after a transfer went out, the platform's balance covers the transfer. [Stripe: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- Stripe's "funds segregation" preview puts each payment's funds into an allocated state that can only be transferred to a connected account. Platform payouts, unrelated refunds, unrelated chargebacks and Stripe fees can't touch it. This is the closest real analogue to Rescrow's trust. [Stripe: funds segregation](https://docs.stripe.com/connect/funds-segregation)
- Under funds segregation, a refund draws first on that same payment's remaining allocated funds and only then on the platform balance. Stripe's example: a 100 EUR refund after 60 EUR was transferred takes 40 EUR from allocated funds and 60 EUR from the platform. [Stripe: funds segregation](https://docs.stripe.com/connect/funds-segregation)
- Every Stripe account has `pending` and `available` balances, and only available funds can be paid out. A platform also has a `connect_reserved` balance that covers connected accounts' negative balances. If a negative balance lasts 180 days, Stripe sweeps the reserve to clear it. [Stripe: Connect account balances](https://docs.stripe.com/connect/account-balances)
- Stripe recommends that platforms hold funds only when there is "a clear purpose and a commitment" to pay them out on a defined event. Its manual payout guide says manual payouts are not escrow. [Stripe: account balances](https://docs.stripe.com/connect/account-balances), [Stripe: manual payouts](https://docs.stripe.com/connect/manual-payouts)
- Stripe's payout schedules can be daily (after `delay_days`), weekly on named weekdays, monthly on day numbers, or manual. A monthly payout set for the 29th, 30th or 31st goes out on the last day of a shorter month. [Stripe: manage payout schedule](https://docs.stripe.com/connect/manage-payout-schedule)
- Adyen requires split instructions that cover the whole transaction amount. A split with no account goes to the platform's "liable" balance account. A `Remainder` split type catches what is left over after currency conversion. [Adyen: split transactions](https://docs.adyen.com/platforms/online-payments/split-transactions)
- Adyen offers three chargeback behaviors: take the whole amount from the platform's liable account, take it from one named balance account, or split it by the original payment's split ratio. [Adyen: split chargebacks](https://docs.adyen.com/platforms/online-payments/split-transactions/split-chargebacks)
- Adyen caps a payout at the available balance, which is settled funds minus any negatives already known to be coming. A balance account can stay negative for up to 30 days, with a warning at 20 days by default. After that, Adyen takes the amount from the platform's liable account. [Adyen: payout amount](https://docs.adyen.com/platforms/payout-amount), [Adyen: verify balances](https://docs.adyen.com/platforms/reconciliation-use-cases/verify-balances)
- Adyen's balance report gives an opening and a closing balance per balance account per day. Its accounting report lets you rebuild a balance by summing the individual entries. [Adyen: verify balances](https://docs.adyen.com/platforms/reconciliation-use-cases/verify-balances)
- Etsy's payment account reserve holds a percentage of each physical-item sale. It releases the funds once tracking shows the order in transit, or else when a default holding period ends, and the reserve absorbs refunds and chargebacks if the seller's balance goes negative. eBay's transaction holds usually release 2 days after delivery is confirmed, or about 31 days after the buyer pays. [Etsy: payment account reserve](https://help.etsy.com/hc/articles/360058722214), [eBay: payment holds](https://www.ebay.co.uk/help/selling/getting-paid/getting-paid-items-youve-sold/payments-hold-managed-payments-seller?id=4816)
- For off-platform deals, Artsy points buyers to Escrow.com. The buyer pays escrow, the seller ships with tracking, the buyer inspects the work and accepts or rejects it, and the payment is released only after acceptance. The whole process usually takes 5 to 20 days. [Escrow.com x Artsy](https://escrow.com/partners/landing/artsy)
- A "for benefit of" (FBO) account is one pooled bank account holding money for many users. An internal ledger tracks each user's share, and the company holding the account doesn't own the funds. [Modern Treasury: FBO accounts](https://moderntreasury.com/learn/what-is-an-fbo-account)

## How it applies to Rescrow

- Rescrow's trust is per payment: one hold per incoming payment (`reconcile()` breaks if a payment has anything other than exactly one). That matches the per-charge model of Stripe's funds segregation more closely than Stripe's ordinary platform balance. We should say so in the pitch and enforce it in more places, so no release ever exceeds the hold it came from.
- Every platform treats money that has been received but hasn't settled as a separate state. Today Rescrow locks a hold the moment a payment is recorded and can pay it out the same day. A wire is final, but ACH and card payments can still be returned or disputed. A pending-versus-available distinction would add real-world fidelity.
- All of these platforms have to answer "who eats a loss after the money moved?" Stripe and Adyen put it on the platform's liable account by default. For Rescrow the platform is the gallery, and the answer has to be the gallery's operating account, never the trust and never an artist already paid. Today `cancelSale` leaves a deadline-paid share with the artist, so the buyer gets back less than they paid and nothing records that gap. That is a real hole to close.
- Adyen's negative-balance rules (a 30-day limit, a 20-day warning, then the liable account pays) give us a ready-made, defensible policy for a gallery that owes money it doesn't have.
- Daily opening and closing balances per account (Adyen) and sums over individual entries (Stripe and Adyen accounting reports) are how real platforms prove balances. These are the natural next steps after `reconcile()`'s single identity.

## Feature ideas

### Settlement states: pending to available

- What: Add `availableAt` to each `EscrowHold`, worked out from the payment method using a fixed table (wire: same day; ACH: 2 business days; card: 2 days). The UI shows each hold as a "pending" or "available" badge. A completed-sale payout releases only available holds and queues the rest for the day they settle. Rule for the conflict case: when `availableAt` is later than `dueBy`, the hold pays on `availableAt`, and the activity log names the reason. Tests cover a weekend ACH, a same-day wire, and a hold whose `availableAt` is later than its `dueBy`.
- Why judges care: anyone who has worked on Ramp's payments side knows received is not the same as settled, and it shows we do too.
- Demo visibility: both
- Effort: M
- Demo risk: low, because the demo payments are wires, which settle the same day, so the script doesn't change.
- Grounding: [Stripe: account balances](https://docs.stripe.com/connect/account-balances), [eBay: payment holds](https://www.ebay.co.uk/help/selling/getting-paid/getting-paid-items-youve-sold/payments-hold-managed-payments-seller?id=4816)

### Returned payment (ACH return) with the gallery liable

- What: Add a `returnPayment(paymentId)` operation for an ACH payment that bounces after the split. If the payment's hold is still locked, it goes back to the buyer's bank through `releaseTrust(to: "buyer")`, and the gallery's part comes out of operating. If the hold was already paid to the artist, the artist keeps it, and the gallery's operating account covers the full return. A new reconcile term `returnedCents` keeps the identity balanced. The property test: no return ever reduces another hold or any artist payout.
- Why judges care: it is the failure Stripe documents for separate charges and transfers, and our answer protects the artist.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it is a separate optional key press like `C` and the main path doesn't touch it.
- Grounding: [Stripe: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), from the codebase (`releaseTrust`, `reconcile`)

### Refund lineage: each refund draws on its own payment's hold first

- What: Add partial refunds of a single installment. The refund draws first on that payment's own locked hold and the matching gallery part. Any shortfall, for example when the artist share was already paid at the deadline, comes from gallery operating, never from another payment's hold, even one belonging to the same artist. Each `Payout` and refund records a `sourcePaymentId`, like Stripe's `source_transaction`. The invariant test: total released from a hold is never more than the hold.
- Why judges care: it shows Rescrow already works like Stripe's funds segregation, with tests that prove it.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because it is backend-only and the existing cancel flow is a special case of it.
- Grounding: [Stripe: funds segregation](https://docs.stripe.com/connect/funds-segregation), from the codebase

### Close the cancel-after-deadline gap

- What: Today, cancelling a sale after a deadline payout refunds the buyer only the locked share plus the gallery part. The share already paid to the artist is never refunded and isn't recorded anywhere. Fix it: the artist keeps that share, the gallery's operating account pays it to the buyer, and a new activity kind `gallery_covered_refund` records it. Add a test that the buyer is refunded exactly what they paid, and that trust and the artist's payouts don't change.
- Why judges care: finding and fixing a real edge case in our own money logic is the rigor they look for.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low, because the demo never cancels after a deadline payout.
- Grounding: from the codebase (`cancelSale`), [Stripe: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers) (a refund doesn't undo transfers)

### Gallery negative balance with a 30-day clock

- What: When an operation covered by the gallery (a return, a chargeback or a covered refund) costs more than operating holds, operating goes negative instead of throwing. That debt is recorded as `owedByGalleryCents`. On day 20 the screen shows a warning banner. On day 30 the gallery is blocked from new sales until the debt is paid. Trust is never used to fund the shortfall, and the test shows `releaseTrust` refusing it. `reconcile()` no longer flags a negative operating balance when it is backed by a recorded debt.
- Why judges care: it is Adyen's real policy, and it shows the trust guard holds even when the gallery is underwater.
- Demo visibility: both
- Effort: M
- Demo risk: med, because it changes the existing "negative operating is a break" check, so existing tests need care.
- Grounding: [Adyen: payout amount](https://docs.adyen.com/platforms/payout-amount), [Adyen: verify balances](https://docs.adyen.com/platforms/reconciliation-use-cases/verify-balances), [Stripe: account balances](https://docs.stripe.com/connect/account-balances)

### Chargeback policy read from the agreement

- What: Add `chargebackPolicy: "gallery" | "pro_rata"` to `AgreementTerms`, with the agreement reader's saved answer citing the clause. Under `gallery`, the whole dispute comes out of operating. Under `pro_rata`, the artist's share of the disputed amount comes out of that payment's own locked hold and nothing else. If that hold was already paid, the gallery covers it. While a dispute is open, the disputed hold shows a new `disputed` status and is frozen. If it is still frozen at its `dueBy`, the activity log records the deadline being extended by the dispute.
- Why judges care: it maps Adyen's chargeback options onto consignment law without ever opening a second way out of trust.
- Demo visibility: both
- Effort: M
- Demo risk: med, because the new hold status touches the UI badges and the deadline logic.
- Grounding: [Adyen: split chargebacks](https://docs.adyen.com/platforms/online-payments/split-transactions/split-chargebacks)

### Split instructions that must cover every cent

- What: Replace the single artist-share number on each payment with a `splits[]` array of lines: artist (to trust), gallery commission (to operating), and optional framing deduction or co-artist lines. A validator throws unless the lines add up exactly to the payment. A single `remainder` line, always the gallery commission, absorbs rounding, so it is clear where every odd cent goes. The UI shows the split as a stacked bar per payment.
- Why judges care: it is Adyen's full-amount rule, and it turns the running-total rounding into something you can see and test.
- Demo visibility: both
- Effort: M
- Demo risk: low, because the default split reproduces today's numbers exactly.
- Grounding: [Adyen: split transactions](https://docs.adyen.com/platforms/online-payments/split-transactions), from the codebase (D5 running-total rounding)

### Append-only balance journal

- What: Record every money movement as an immutable `JournalEntry {id, at, account: operating|trust|artist|buyer|creditors, amountCents, type, paymentId, holdId}`. Each movement writes a pair of entries that sum to zero. Balances are derived by summing entries. `reconcile()` gains a check that the derived balance equals the stored balance for every account, and that every pair sums to zero. A replay test rebuilds the whole snapshot from the journal alone.
- Why judges care: double-entry with derived balances is how Ramp's own ledger engineers think.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because it sits alongside existing state and doesn't replace it.
- Grounding: [Adyen: verify balances](https://docs.adyen.com/platforms/reconciliation-use-cases/verify-balances) (rebuilding a balance from accounting entries)

### Daily statement chain

- What: Add a pure function `dailyStatements(snapshot, galleryId)` that returns, for each day and each account (operating, trust), the opening balance, credits, debits and closing balance. The test checks that every day's closing equals the next day's opening and that the last closing equals the live balances. The screen shows a compact table, or a small-multiples chart of trust versus operating per day, through the insolvency day.
- Why judges care: it is the bank-statement view finance teams use, and the chain is a strong invariant to test.
- Demo visibility: both
- Effort: S
- Demo risk: low, because it only reads data.
- Grounding: [Adyen: verify balances](https://docs.adyen.com/platforms/reconciliation-use-cases/verify-balances)

### Trace a dollar (transfer group view)

- What: Give every sale a `transferGroup` id. A view graphs the sale's money: payments, each split into a hold and the gallery part, then each hold into its payout or refund. It is a small Sankey or column flow built from snapshot data by a pure function in `src/lib`. Clicking a payout highlights the exact payments it came from.
- Why judges care: it shows on screen that every trust dollar is accounted for, with no hand-waving.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med, because it is new UI and needs a careful layout at 1440 x 900.
- Grounding: [Stripe: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers) (`transfer_group`)

### Artist payout schedule, always capped by the deadline

- What: Let an artist choose how deadline payouts arrive: immediately, weekly on a set weekday, or monthly on a set day. A monthly day of 29 to 31 falls back to the last day of shorter months. The same-day payout on sale completion always overrides the schedule, and no scheduled date may fall after a hold's `dueBy`, so the schedule can only make payment earlier. Tests cover February, leap years and a `dueBy` that falls before the next scheduled day.
- Why judges care: it is an edge-case-heavy date rule with a clear, tested legal limit.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low, because the default "immediately" matches current behavior.
- Grounding: [Stripe: manage payout schedule](https://docs.stripe.com/connect/manage-payout-schedule)

### Delivery and inspection gate before "complete"

- What: Add `delivered` and `accepted` states after a sale is fully paid. Completion, and with it the same-day payout, happens when the buyer accepts the work, or automatically N days after delivery if the agreement sets an inspection window. The per-payment `dueBy` still applies, so inspection can never delay an artist past their deadline. The present page gets one extra beat: "Collector accepts the work."
- Why judges care: it matches how art really changes hands (the Escrow.com flow Artsy uses) instead of treating the last payment as delivery.
- Demo visibility: both
- Effort: M
- Demo risk: med, because it changes when the main demo's payout fires, so it would need a demo-script update and the demo-flow test.
- Grounding: [Escrow.com x Artsy](https://escrow.com/partners/landing/artsy), [eBay: payment holds](https://www.ebay.co.uk/help/selling/getting-paid/getting-paid-items-youve-sold/payments-hold-managed-payments-seller?id=4816)

### Ledger-versus-bank check for the trust account

- What: The fake `BankFeed` also reports the trust account's bank balance, built deterministically from the same events. A pure check compares it with the sum of locked holds and, when they differ, shows a named break with the gap in cents. A test injects a stray bank debit and shows the check catching it. The screen shows a "Trust: ledger = bank" tick next to the reconcile badge.
- Why judges care: in a pooled FBO-style account, the ledger is the only record of who owns what, so it has to be checked against the bank.
- Demo visibility: both
- Effort: S
- Demo risk: low, because it is deterministic and read-only.
- Grounding: [Modern Treasury: FBO accounts](https://moderntreasury.com/learn/what-is-an-fbo-account), [Adyen: verify balances](https://docs.adyen.com/platforms/reconciliation-use-cases/verify-balances)
