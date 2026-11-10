# Gaps and extension points in the Rescrow codebase

A read of the engine, store, routes, seed and presenter on the `big-build` branch, looking for rules the code does not enforce, flows that cannot happen yet, invariants no test checks, and screens that could show more. Line numbers refer to the files as they stand on that branch.

## What we learned

- The trust guard is a runtime check on an argument, not a structural rule. `releaseTrust` throws if `to` is not `"artist"` or `"buyer"`, but holds are plain objects in the snapshot. Any other function could set `hold.status = "paid"` or change `operatingBalanceCents` directly, and nothing would stop it except review. [engine.ts L92-115](../../src/lib/escrow/engine.ts#L92-L115)
- The sale freezes the split but not the deadline. `createSale` copies `artistShareBps` onto the `Sale`, but `receivePayment` calls `termsFor()` again for every payment to compute `dueBy`. If the agreement is re-read with different payout days, one sale gets mixed deadlines. If a re-read fails a verification check, `termsFor` throws and an open sale can no longer record a payment that has already arrived. [engine.ts L200-L210, L286](../../src/lib/escrow/engine.ts#L286)
- Deadlines run on the wall clock and only fire when something polls. `releaseDueHolds` is called from `GET /api/state`, so a hold is paid at its deadline only when someone loads the page. The demo cannot show a deadline payout, because the 30 to 60 day windows never elapse on camera. [state/route.ts](../../src/app/api/state/route.ts), [engine.ts L326-347](../../src/lib/escrow/engine.ts#L326-L347)
- The seeded open hold has no deadline. `hold_lamps_1` (Theo, received Oct 30, 14-day terms) has no `dueBy`, so the deadline rule never applies to it, even though under its terms it falls due Nov 13. [seed.ts L278-287](../../src/lib/seed.ts#L278-L287)
- Insolvency settles money but not the artworks. `ArtworkStatus` includes `"returned"`, but nothing ever sets it. After `declareInsolvency`, unsold consigned works stay `"consigned"` in the failed gallery's inventory, and an open sale stays `"open"` with its work marked `"sold"`, with no path to resolve either. [types.ts L33](../../src/types.ts#L33), [engine.ts L354-398](../../src/lib/escrow/engine.ts#L354-L398)
- A cancellation after a deadline payout is not modeled end to end. `cancelSale` leaves any already-paid share with the artist, so the buyer gets back less than they paid and nothing records the shortfall. `ledgerFor` then skips the refund row completely when no hold was refunded (`if (refunded.length === 0) continue`), so an operating debit appears with no ledger line. When a sale has both deadline-paid and refunded holds, the row shows `-paid`, which overstates the refund. No test covers cancel-after-deadline. [engine.ts L414-428](../../src/lib/escrow/engine.ts#L414-L428), [ledger.ts L61-83](../../src/components/ledger.ts#L61-L83)
- The ledger labels every non-insolvency payout "Same day payout from artist trust", including deadline payouts made while the sale is still open. [ledger.ts L44-58](../../src/components/ledger.ts#L44-L58)
- The bank feed is not built. `IncomingPayment.rampTransactionId` exists and is documented as idempotent, but nothing sets or checks it, and there is no `BankFeed` interface in `src`. Payments arrive only through a demo route keyed on `saleId`. An overpayment is rejected with an error, although in reality that money has already landed. [types.ts L107-117](../../src/types.ts#L107-L117), [payment/route.ts](../../src/app/api/demo/payment/route.ts), [engine.ts L251-255](../../src/lib/escrow/engine.ts#L251-L255)
- Every payment is final the moment it lands. `PaymentMethod` includes `"ach"` and `"card"`, but there is no pending or cleared state and no return or chargeback path. Theo's agreement says he is paid within 14 days of "cleared funds", while the engine starts his clock at receipt. [types.ts L105](../../src/types.ts#L105), [seed.ts L24](../../src/lib/seed.ts#L24)
- The clauses the reader extracts are stored as `notes` strings and never enforced. These include Theo's framing deduction capped at $400, his written consent for installment terms over six months, Mara's 10% discount shared equally, Ines's approval for discounts over 10%, and the shipping exclusion. `termsFor` also takes the first agreement for an artist and ignores `signedOn`, the term length and the gallery. [seed.ts L50-88](../../src/lib/seed.ts#L50-L88), [engine.ts L55-72](../../src/lib/escrow/engine.ts#L55-L72)
- The random property test never calls `reconcile()`. It runs 300 single-sale sequences and checks totals through `galleryTotals`. Nothing interleaves several sales, cancellations, deadline payouts, re-reads and insolvency with a reconciliation after every step. [invariants.test.ts](../../src/lib/escrow/invariants.test.ts)
- `reconcile()` checks the gallery-level identity and payout-to-hold totals, but has no per-artist or per-sale sub-ledger checks. It does not check that each sale's holds add up to `shareOf(paid, bps)`, that a payout's holds belong to that payout's artist, that a paid sale has no locked holds, or that trust is zero after insolvency. When `openingBalanceCents` is missing, it derives the opening from the operating balance, which makes the operating check true by construction. [reconcile.ts L38-102](../../src/lib/escrow/reconcile.ts#L38-L102)
- The gallery has no way to spend money. With no expense operation, "trust is untouchable" is never tested against a real spend or an overdraft attempt, and `cancelSale` can push operating below zero. The only place that is caught is a reconciliation break. [engine.ts L427](../../src/lib/escrow/engine.ts#L427), [reconcile.ts L89](../../src/lib/escrow/reconcile.ts#L89)
- Some demo-facing UI details are wrong or hidden. The "Gallery goes under" button shows the key hint `I`, but the handler and the demo script use `B`. Reconciliation breaks appear only in a hover tooltip. Several screens read `snapshot.galleries[0]` instead of a gallery id. [present/page.tsx L81, L156, L255](../../src/app/present/page.tsx#L156), [TrustProof.tsx](../../src/components/TrustProof.tsx), [GalleryAccount.tsx](../../src/components/GalleryAccount.tsx)

## How it applies to Rescrow

- The strongest claim, that the gallery can never touch trust, rests on one function and on convention. Making it structural would turn the pitch's "the rule is code" into something a reviewer can check. One way is a journal of transfers with an allow-list of account pairs, plus a test that scans the source for direct writes to hold status. Another is a live, on-screen refusal.
- Almost every gap here sits on a real-world path the demo never takes: deadline payouts, reversals, unmatched deposits, a cancellation after a deadline payout, and works left in a failed gallery. These are the questions a payments engineer asks first, and each is a pure-function change with a test.
- Reconciliation already balances to the cent. The next level of rigor is finer-grained checks: per sale, per artist, and per bank account against the books, plus tests that inject faults and confirm each one produces a named break.
- The finale shows creditors taking operating cash, but it never shows what the artist would have lost without Rescrow. A deterministic counterfactual, built from numbers the engine already has, would make the climax concrete.
- Small fixes cost little and remove risk on camera: the `I`/`B` key hint, the payout label, the missing seeded `dueBy`, and surfacing breaks as visible text.

## Feature ideas

### Freeze terms per sale and run a demo clock

- What: copy `payoutDays` (and the agreement id and version) onto the `Sale` when it is created, so later re-reads can neither change nor block an open sale. Add a stored clock offset (`demoClock.offsetDays`) that the clock reads, plus a "Jump 30 days" key, so a hold reaches its `dueBy` on camera and pays out as `deadline_payout` while the buyer is still paying. Also give the seeded Theo hold its missing `dueBy`, set relative to reset time on the demo clock rather than as a fixed date, and use the clock in `releaseDueHolds` instead of `Date.now`.
- Why judges care: the per-payment deadline is the product's core promise, and right now no one can watch it happen.
- Demo visibility: both
- Effort: M
- Demo risk: med. A seeded `dueBy` written as a fixed date would trigger a payout of Theo's $2,400 on the first poll after Nov 13, so the date has to be relative to reset. Otherwise jumping the clock is opt-in, reset clears the offset, and frozen terms remove a way the demo can currently throw mid-sale.
- Grounding: from the codebase ([engine.ts L286](../../src/lib/escrow/engine.ts#L286), [seed.ts L278-287](../../src/lib/seed.ts#L278-L287), [state/route.ts](../../src/app/api/state/route.ts))

### Random operation sequences with reconciliation after every step

- What: a seeded generator that runs several hundred random sequences across all three artists. Each step is one of sale, payment (even, uneven or final), cancel, clock jump with deadline release, re-read of terms, or insolvency. After every step it asserts that `reconcile()` is balanced. It also checks a hold state machine: `locked` moves only to `paid` or `refunded`, `releasedAt` is set exactly when a hold is not locked, and trust never goes negative. A failing sequence prints its seed and its shortest failing prefix.
- Why judges care: this is how ledger teams test, by checking invariants over arbitrary histories rather than three hand-picked paths.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It is test-only, though it will likely surface the cancel-after-deadline issue, which has to be fixed first.
- Grounding: from the codebase ([invariants.test.ts](../../src/lib/escrow/invariants.test.ts), [reconcile.ts](../../src/lib/escrow/reconcile.ts))

### Sub-ledger reconciliation and fault-injection tests

- What: extend `reconcile()` with per-sale and per-artist checks, each producing a named break:
  - each sale's holds equal `shareOf(paidSoFar, bps)`;
  - a paid sale has no locked holds;
  - every hold in a payout belongs to that payout's artist and gallery;
  - trust is zero after insolvency;
  - `openingBalanceCents` is required rather than derived.

  Then write one test per tamper (move $1 from trust to operating, duplicate a payout, flip a hold to paid without a payout, change a sale's split, and so on), each asserting its specific break. Show the breaks as visible text in `TrustProof` instead of only in a tooltip.

- Why judges care: it shows reconciliation detects real errors, because every way of breaking the books has a test that names it.
- Demo visibility: both
- Effort: M
- Demo risk: low. These are pure checks, and the seed and demo flow already balance.
- Grounding: from the codebase ([reconcile.ts L38-102](../../src/lib/escrow/reconcile.ts#L38-L102), [TrustProof.tsx](../../src/components/TrustProof.tsx))

### "Gallery tries to spend trust" on screen

- What: add a gallery `spend(amountCents, payee)` operation that can only draw on operating and refuses an overdraft. Add a demo route and a key that tries to pay "June rent" for more than operating holds and then tries `releaseTrust(to: "operating")`. Both refusals appear in the activity feed as a new `blocked` kind, quoting the exact error, while the trust balance stays put.
- Why judges care: the trust rule becomes something they watch fail on purpose, not a test they are told about.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. The route only records refusals, and the money state does not change.
- Grounding: from the codebase ([engine.ts L92-115](../../src/lib/escrow/engine.ts#L92-L115), [trust.test.ts L61](../../src/lib/escrow/trust.test.ts#L61))

### Insolvency counterfactual: what the artist would have got

- What: a pure `insolvencyCounterfactual(snapshot)` that recomputes the failure as if trust had been commingled with operating. Artists' unpaid shares join the pool of unsecured claims, and that pool is paid pro rata at a configurable recovery rate (default 8.5 pence per pound, the figure the demo already cites). The finale shows two bars per artist, "with Rescrow" at 100% and "commingled" at the recovered amount, with both totals reconciled to the cent.
- Why judges care: it puts a dollar figure on the product's value at the demo's climax.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. It is read-only and computed from the snapshot, so it cannot affect the real books.
- Grounding: from the codebase ([engine.ts L354-398](../../src/lib/escrow/engine.ts#L354-L398)), and the recovery figure sourced in [demo-script.md](../../docs/demo-script.md)

### Return the art, not just the money, on insolvency

- What: in `declareInsolvency`, set every unsold consigned work at that gallery to `"returned"` and log a `work_returned` activity. Mark each open sale `"frozen"` (a new additive status), and record the buyer's paid-in gallery share as a claim on the estate. The phone shows "Threshold returned to your studio", and the ledger lists buyer claims next to creditors.
- Why judges care: §12.01 makes the consigned work trust property too, and the type for it already exists but is never used.
- Demo visibility: both
- Effort: S
- Demo risk: low. The money paths do not change, and only statuses and log lines are added.
- Grounding: from the codebase ([types.ts L33](../../src/types.ts#L33), [seed.ts L13](../../src/lib/seed.ts#L13))

### Pending, cleared and reversed payments

- What: give `IncomingPayment` a `status` of `pending`, `cleared` or `returned`, with a per-method clearing delay (wire 0 days, ACH 2, card 0, plus a reversal window). A hold can be paid out only when its payment has cleared. The clock for "cleared funds" agreements (Theo) starts at clearance, not receipt. An ACH return or chargeback on a locked hold refunds that hold to the buyer through `releaseTrust(to: "buyer")`. If the share was already paid out, the loss comes from operating and trust is never touched.
- Why judges care: reversibility is the classic way payments fail, and it shows who bears that loss.
- Demo visibility: both
- Effort: M
- Demo risk: med. It changes when the final payout fires, so the scripted wires should stay at zero delay.
- Grounding: from the codebase ([types.ts L105-117](../../src/types.ts#L105-L117), [seed.ts L24](../../src/lib/seed.ts#L24))

### Bank feed with idempotent ingest and a suspense bucket

- What: build the `BankFeed` interface the docs promise: `list({ cursor })` returns pages of transactions with id, amount, memo and date, and a `FakeRampFeed` replays a script. `ingest()` matches each transaction to a sale by memo reference, is a no-op on a `rampTransactionId` it has already seen, and sends unmatched or excess deposits to a `suspenseCents` bucket that reconciliation counts, instead of throwing. Tests replay the feed twice, out of order and with a duplicate page.
- Why judges care: it shows how the real Ramp integration would work: polling, cursors, duplicate delivery and money that arrives without a reference.
- Demo visibility: both
- Effort: M
- Demo risk: low. The demo routes keep working, and the feed is an additional way to bring payments in.
- Grounding: from the codebase ([types.ts L115-116](../../src/types.ts#L115-L116), [engine.ts L251-255](../../src/lib/escrow/engine.ts#L251-L255))

### Framing deduction applied at the split, not drawn from trust

- What: add `deductions: { kind: "framing", capCents, citation }` to the terms and `framingCents` to the sale. The deduction reduces the artist's share at split time, spread across installments on the same running total. It is never a release from trust, so the guard stays absolute. The engine refuses a deduction above the cited cap ($400 for Theo), and the statement shows the line with its quote.
- Why judges care: it adds a real money deduction without opening any path for money to leave trust.
- Demo visibility: both
- Effort: M
- Demo risk: low. It applies only to Theo's works, which are not part of the scripted story.
- Grounding: from the codebase ([seed.ts L23](../../src/lib/seed.ts#L23), [engine.ts L174-184](../../src/lib/escrow/engine.ts#L174-L184))

### Enforce discount and consent clauses

- What: turn three notes into structured fields and rules in `createSale`:
  - a `discountBps` with `freeDiscountCapBps` (10% for Mara and Ines);
  - an `approvals` record required above that cap;
  - a `maxInstallmentMonths` that needs a consent record beyond six months (Theo).

  Mara's "shared equally" rule computes the share on the discounted price. Each refusal names the clause and its quote.

- Why judges care: the agreement stops being only a source of two numbers and becomes rules the engine enforces.
- Demo visibility: both
- Effort: M
- Demo risk: low. The scripted sale has no discount and three installments.
- Grounding: from the codebase ([seed.ts L10, L25, L36](../../src/lib/seed.ts#L10), [engine.ts L186-233](../../src/lib/escrow/engine.ts#L186-L233))

### Explicit refund records and correct cancel-after-deadline handling

- What: add `Refund { saleId, fromTrustCents, fromOperatingCents, shortfallCents }`, written by `cancelSale`. The shortfall is any share already paid to the artist on its deadline, now owed to the buyer by the gallery out of operating. Rebuild the ledger refund row and reconciliation's `refundedToBuyersCents` from these records instead of deriving them. Also label deadline payouts correctly in `ledgerFor`, and add a test that cancels after a deadline payout.
- Why judges care: it fixes a case where the screen and the books disagree, and replaces a derived number with a recorded one.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. The scripted cancellation (after payment 1) produces the same numbers.
- Grounding: from the codebase ([engine.ts L414-428](../../src/lib/escrow/engine.ts#L414-L428), [ledger.ts L44-83](../../src/components/ledger.ts#L44-L83))

### Hash-chained activity log

- What: give each `Activity` a `prevHash` and a `hash`, a SHA-256 over its fields and the previous hash, computed with `node:crypto` and stable key ordering. `verifyChain(snapshot)` returns the first broken link. A small "log intact" badge sits next to the reconciliation badge, and a test edits an old entry and expects the break at that index.
- Why judges care: with tamper evidence, a gallery cannot quietly rewrite its history afterwards.
- Demo visibility: both
- Effort: M
- Demo risk: low. Hashes are deterministic, and the seed and reset rebuild the chain.
- Grounding: from the codebase ([engine.ts L37-53](../../src/lib/escrow/engine.ts#L37-L53), [types.ts L159-167](../../src/types.ts#L159-L167))

### Three-way trust reconciliation

- What: model the trust account as its own simulated bank balance, moved only by the split and by `releaseTrust`. Reconcile three figures that must agree: the bank balance, the sum of locked holds, and the per-artist sub-ledger (locked holds grouped by artist). Show a three-column proof card, with one row per artist, that turns red with a named break if any figure drifts.
- Why judges care: it is the standard control for client trust accounts, and it shows trust as a real account, not a derived number.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is computed alongside the existing badge.
- Grounding: from the codebase ([reconcile.ts](../../src/lib/escrow/reconcile.ts), [engine.ts L501-508](../../src/lib/escrow/engine.ts#L501-L508))

### Presenter polish before recording

- What: fix the "Gallery goes under" key hint (`I` to `B`). Show reconciliation breaks as visible text. List every locked hold with its own due date on the phone, not just the earliest. Replace `snapshot.galleries[0]` with the story's gallery id.
- Why judges care: what appears on camera is accurate.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. These are copy and display changes only.
- Grounding: from the codebase ([present/page.tsx L156, L255-261](../../src/app/present/page.tsx#L156), [TrustProof.tsx](../../src/components/TrustProof.tsx))
