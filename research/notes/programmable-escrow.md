# Programmable and conditional escrow, done off-chain

## What we learned

- Escrow.com milestone deals have the buyer fund the full amount up front. Each milestone then gets its own inspection period, and money is released per milestone as each one is accepted. The deal completes when every milestone is accepted. ([Escrow.com, How Milestones Escrow Works](https://www.escrow.com/milestones/how-it-works))
- On Escrow.com, the inspection period is set by the parties (1 to 30 calendar days) and starts when the buyer marks the item received or delivery is confirmed. If the buyer does nothing, the period ends on its own and funds are released. ([Escrow.com, Inspection Period](https://www.escrow.com/inspection-period))
- Third-party guides and community posts say Upwork gives the client 14 days to review a submitted fixed-price milestone. If the client stays silent, the funds release automatically, and the clock starts only when work goes through the formal "Submit Work" step. These reports do not come from an official Upwork policy page. ([GigRadar](https://gigradar.io/blog/upwork-payment-protection-fixed-price), [Wise](https://wise.com/gb/blog/upwork-payments), [Upwork Community](https://community.upwork.com/t5/Freelancers/Why-can-t-I-access-the-funds-in-escrow/m-p/807267))
- OpenZeppelin splits escrow into layers. `Escrow` only holds credits per payee. `ConditionalEscrow` adds one hook, `withdrawalAllowed(payee)`, that a subclass fills in. `RefundEscrow` is a lifecycle that ends either in `close()`, where the beneficiary withdraws, or in `enableRefunds()`, where depositors withdraw. Both reject further deposits. ([OpenZeppelin Contracts, utils/Escrow](https://docs.openzeppelin.com/contracts/4.x/api/utils#Escrow))
- OpenZeppelin's `TimelockController` gives every sensitive operation the states Unset, Waiting, Ready and Done, with a minimum delay. A separate canceller role can kill a pending operation, and an operation can require a predecessor to be Done first. The point of the delay is to give affected users time to react before the change takes effect. ([OpenZeppelin, TimelockController](https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController))
- The Solidity "Safe Remote Purchase" example is an explicit state machine (Created, Locked, Release, Inactive). An `inState` guard reverts on any call made in the wrong state, and the state is changed before any money is sent so a recipient cannot trigger a second payout. ([Solidity by Example](https://docs.soliditylang.org/en/latest/solidity-by-example.html))
- The ERC-792 example arbitrable escrow lets the payer release at any time, but the payee only after a reclamation period. When the payer disputes, the payee must deposit the arbitration fee before a timeout. If the payee misses it, the payer reclaims everything. Without a timeout, a silent party could stall the money forever. ([Kleros ERC-792, Implementing an Arbitrable](https://developer.kleros.io/en/latest/implementing-an-arbitrable.html))
- In that same example, the arbitrator's `rule()` accepts only defined rulings while the status is Disputed. The example leaves the "refused to arbitrate" outcome unhandled, so funds would sit in the contract, which is exactly the stuck-money bug a liveness check should catch. ([Kleros ERC-792, Implementing an Arbitrable](https://developer.kleros.io/en/latest/implementing-an-arbitrable.html))
- A hashed timelock contract pays out only to someone who presents the preimage of a hash, and only before a deadline. After the deadline, the payment goes back to the payer. The revealed secret then serves as proof of the event. ([Bitcoin Wiki, Hash Time Locked Contracts](https://en.bitcoin.it/wiki/Hash_Time_Locked_Contracts))
- Safe multisig accounts have a set of owners and a threshold, the number of owner confirmations a transaction needs before it can run. Changing the owners or the threshold itself requires the threshold. ([Safe docs, Smart Account overview](https://docs.safe.global/advanced/smart-account-overview))
- Stripe's separate charges and transfers tie each transfer to the charge that funded it with `source_transaction`. Transfers against one charge cannot add up to more than that charge, and they don't execute until its funds are available. Refunding a charge does not reverse transfers, so the platform has to reconcile that itself. ([Stripe, Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers))
- Stripe offers "funds segregation" as a private preview. It keeps allocated payment funds in a protected state so the platform can't use them for unrelated operations, which is the same promise Rescrow makes for artist money. ([Stripe, Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers))
- Sablier lockup streams fund the full amount up front and unlock it over time. If the sender cancels, the sender recovers only the unstreamed part, and the recipient keeps what has already streamed. ([Sablier, Lockup overview](https://docs.sablier.com/concepts/lockup/overview))
- A Ricardian contract is one document that is both legal prose and machine-readable terms, identified by a hash of its canonical form. Later transactions reference that hash, which links them to the exact text both sides agreed to. Sources disagree on the origin date (1995 or 1996). ([LimeChain](https://limechain.tech/blog/what-is-ricardian-contract), [Wikipedia](https://wikipedia.com/wiki/Ricardian_contract))

## How it applies to Rescrow

- Rescrow is already a `ConditionalEscrow`. `releaseTrust(to: artist|buyer)` is the withdraw function, and the release conditions are "sale paid in full", "dueBy reached" and "gallery insolvent". Today those conditions are spread across `receivePayment`, `releaseDueHolds` and `declareInsolvency`. Making them data would let the UI show, for each hold, which condition will release it and when.
- One gallery-controlled lever on trust remains. `cancelSale` can be called by the gallery alone, and it immediately releases every locked hold to "the buyer", a destination that is only `sale.buyerName`. A gallery in trouble could invent a cancellation and route trust money to a friendly "buyer". Timelocks (OpenZeppelin), thresholds (Safe) and source-of-funds binding (Stripe `source_transaction`) each close part of that gap. (from the codebase)
- `dueBy` is computed from `termsFor(...)` at the moment each payment lands, so re-reading the agreement mid-sale silently changes the deadline on later installments. If a re-read fails its checks, `termsFor` throws and incoming payments are refused. `artistShareBps` is already frozen on the `Sale`; `payoutDays` and the agreement text are not. That is the gap a Ricardian-style hash fixes. (from the codebase)
- Every waiting state in serious escrow designs has a deadline and a default outcome (Escrow.com auto-release, the reported Upwork 14 days, the Kleros fee timeout, the HTLC refund). Rescrow has this for holds (`dueBy`) but would need it for any new state it adds, such as disputes, pending refunds or approvals. Otherwise money can get stuck.
- The useful parts of smart-contract escrow need no chain: an explicit state machine, guards that throw, timeouts with defaults, M-of-N approval and hashes for evidence. All of it is pure TypeScript over the JSON snapshot with an injected `Clock`, so it stays offline and deterministic.

## Feature ideas

### Release rules as data, with a "what releases this hold" panel

- What: Each `EscrowHold` gets a `releaseWhen` tree built from a small closed set of nodes: `anyOf`, `allOf`, `saleComplete`, `after(dueBy)`, `galleryInsolvent`, and later `deliveredWithCode` or `approvedBy`. A pure `evaluate(rule, snapshot, now)` returns `{ releasable, firedBy, nextChange }`. `releaseDueHolds` becomes "release every hold whose rule evaluates true." The artist card shows the rule as a checklist with live ticks, plus "releases on Dec 14 unless the sale completes first."
- Why judges care: It turns release policy into inspectable, testable data instead of logic scattered across three functions, which is how Ramp's own policy engines work.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a refactor behind existing behaviour, and the demo-flow test proves nothing changed.
- Grounding: [OpenZeppelin ConditionalEscrow](https://docs.openzeppelin.com/contracts/4.x/api/utils#Escrow); from the codebase (`releaseDueHolds`, `declareInsolvency`)

### Hold lifecycle as a transition table, tested on every pair

- What: Define `HOLD_TRANSITIONS: Record<HoldStatus, Partial<Record<Action, HoldStatus>>>` (for example `locked --payArtist--> paid` and `locked --refundBuyer--> refunded`). Every state change goes through `transition(hold, action)`, which throws on any pair not in the table, the way `inState` works in Solidity. A test walks every (state, action) pair and asserts the result is either the table's answer or a throw. A second test asserts that `paid` and `refunded` are terminal.
- Why judges care: Illegal moves on money become impossible by construction, and the test shows it exhaustively rather than through examples.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It only adds stricter checks on the same paths.
- Grounding: [Solidity Safe Remote Purchase](https://docs.soliditylang.org/en/latest/solidity-by-example.html)

### Timelocked buyer refunds with an artist objection window

- What: `cancelSale` no longer releases trust immediately. It creates a `PendingRefund { saleId, holdIds, proposedAt, executableAt, status: waiting|ready|done|cancelled }`, where `executableAt` is the proposal time plus N days. During the window, the artist portal shows a countdown and an "Object" button, which moves the refund into a dispute. `executePendingRefunds(now)` releases to the buyer only once the refund is Ready. If a hold's `dueBy` arrives while its refund is still waiting, a stated rule decides the outcome, and a test pins it down. The gallery's own operating-side refund can still happen immediately.
- Why judges care: It closes the one path where the gallery alone can move trust money out, using the same delay-then-execute pattern that protects governance in DeFi.
- Demo visibility: both. A countdown bar on the "buyer cancels" beat, with the artist's phone lighting up.
- Effort: M
- Demo risk: med. It changes the optional `C` beat, so the demo script and demo-flow test must change in the same commit.
- Grounding: [OpenZeppelin TimelockController](https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController); from the codebase (`cancelSale`)

### Refunds bound to the payment that funded them

- What: A refund from trust must name the `IncomingPayment` ids it reverses. It may only return to that payment's originator, recorded from the bank feed's counterparty on ingest, and never to a free-text `buyerName`. Per payment, `refunded ≤ payment.amountCents` and `trust part refunded ≤ that payment's hold`. The refund record keeps the `rampTransactionId` it unwinds. The UI shows each refund line pointing back to the wire it came from. (This is different from the existing "refund lineage" note: the key here is the destination, not the allocation order.)
- Why judges care: It stops a gallery from cancelling a sale and paying the "buyer" refund to an account of its choosing, in the same way Stripe ties transfers to their source charge.
- Demo visibility: both
- Effort: M
- Demo risk: low. It adds a field and a guard; seed payments get counterparties.
- Grounding: [Stripe source_transaction](https://docs.stripe.com/connect/separate-charges-and-transfers); from the codebase (`releaseTrust`, `IncomingPayment.rampTransactionId`)

### Two-key rule for any non-routine trust exit

- What: Routine exits (sale complete, `dueBy` reached, insolvency) run automatically. Any other exit (a refund, an early partial payout, a dispute settlement) needs approvals from a threshold of signers. The signers are artist, gallery and an optional neutral, threshold 2, with the gallery never allowed to count alone. Approvals are stored as `{ exitId, signer, at }` and are bound to a hash of the exit's exact holds, amounts and destination, so changing any of them voids the approvals. `releaseTrust` gets an `authorization` argument and throws without a valid quorum on non-routine paths.
- Why judges care: It applies M-of-N control to the one class of moves that can't be fully automated, and states the rule in code: the gallery is never the only key.
- Demo visibility: both. An approvals chip showing "1 of 2", which turns green when the artist approves on the phone view.
- Effort: M
- Demo risk: med. It adds a click to the cancel beat; keep it off the main recorded path.
- Grounding: [Safe smart account threshold](https://docs.safe.global/advanced/smart-account-overview)

### Every waiting state has a deadline and a default outcome

- What: Each non-terminal state Rescrow adds (pending refund, open dispute, awaiting approval, awaiting delivery) declares `{ deadline, defaultOutcome }` in one table. For example: an artist who doesn't object within the window means the refund executes; a gallery that doesn't respond to a dispute by its deadline means the artist wins. A seeded property test runs random action sequences, then advances the clock past the largest deadline and asserts that every hold is `paid` or `refunded`. That is "no money stuck forever", checked as a liveness property.
- Why judges care: Most escrow bugs are stalls, not thefts; showing a liveness test next to the reconcile safety test signals real rigor.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It is test-side only, plus one small table.
- Grounding: [Kleros ERC-792 fee timeout](https://developer.kleros.io/en/latest/implementing-an-arbitrable.html); [Escrow.com inspection auto-end](https://www.escrow.com/inspection-period)

### Default ruling when a party goes silent in a dispute

- What: A dispute on a hold freezes it and opens a response window for the gallery. If the gallery doesn't post a response, with a bond taken from operating and never from trust, before the deadline, the hold releases to the artist by default. If the gallery responds, a neutral records a ruling as an artist/buyer split in basis points. The split is paid with the same running-total rounding the engine already uses, both halves exit through `releaseTrust`, and the bond goes to the winner from operating. (Other notes cover dispute freezes; the new mechanism here is the bond plus a default outcome on silence.)
- Why judges care: It shows dispute handling that can't be stalled and can't leak cents, with the gallery's money, not the artist's, at risk.
- Demo visibility: both
- Effort: M
- Demo risk: med. It is a new flow; demo it from a seeded state, not live.
- Grounding: [Kleros ERC-792 example escrow](https://developer.kleros.io/en/latest/implementing-an-arbitrable.html); from the codebase (`artistShareOfPayment`)

### Delivery code: a hashlock on "sale complete"

- What: When a sale is created, Rescrow derives a 6-character handover code from a seeded generator and stores only its SHA-256 (Node `crypto`, offline). The code is printed on the collector's invoice. Completing the sale requires full payment and the collector entering the code at handover, or the agreement's timeout passing (the HTLC "refund after deadline" leg, mapped to the existing `dueBy` payout). Entering a wrong code is logged and doesn't release anything.
- Why judges care: It is a conditional release a person can see happen on screen: the collector types a code and the artist's trust pays out.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med. It adds typing to the final beat; pre-fill the code for the recorded take.
- Grounding: [Bitcoin Wiki HTLC](https://en.bitcoin.it/wiki/Hash_Time_Locked_Contracts)

### Ricardian lock: freeze terms and agreement hash on the sale

- What: At `createSale`, store `agreementHash` (SHA-256 of the canonical agreement text), `termsHash` and `payoutDays` on the `Sale`, alongside the `artistShareBps` it already freezes. `receivePayment` computes `dueBy` from the sale's frozen `payoutDays` instead of the live `termsFor()`. That fixes the current behaviour, where a mid-sale re-read can shift later deadlines or block payments. Every hold, payout and statement prints the first 8 hex digits of the hash. An amendment creates a new agreement version, and only new sales use it.
- Why judges care: It fixes a real latent bug and ties every dollar to the exact contract text it was computed under.
- Demo visibility: both. A hash chip on the statement, and the fix covered by a regression test.
- Effort: S
- Demo risk: low. It is additive fields and one changed line in `receivePayment`.
- Grounding: [Ricardian contract](https://limechain.tech/blog/what-is-ricardian-contract); from the codebase (`receivePayment`, `termsFor`)

### Milestone sales for commissioned work

- What: A new sale kind, `commission`, has `milestones: { label, amountCents, acceptedAt? }[]` that must sum exactly to the price (enforced by a guard). Buyer payments fund trust as today. Each milestone's artist share becomes releasable when that milestone is accepted (sketch approved, work delivered), or when its own acceptance window passes without objection. The UI shows the milestones as a horizontal track, with each segment filling and paying out.
- Why judges care: It is real-world fidelity for galleries, since many artists work on commission, and it reuses the same release-rule engine instead of special-casing it.
- Demo visibility: shown-on-screen
- Effort: M (assumes "Release rules as data" exists; L without it)
- Demo risk: med. It is a new sale type; show it as a second seeded artist rather than altering the main script.
- Grounding: [Escrow.com milestones](https://www.escrow.com/milestones/how-it-works); [Upwork milestone reports](https://gigradar.io/blog/upwork-payment-protection-fixed-price)

### Pending-operations queue: everything that will move, and when

- What: A pure `scheduledMoves(snapshot, now)` lists every future trust movement: each hold's earliest release, each pending refund's `executableAt`, and each dispute's default date. Every item shows its amount, destination, the condition blocking it and its ETA, sorted by time. The gallery page shows it as a timeline. A "jump to next" key advances the injected clock to the next item, so the demo can skip ahead 60 days and show a deadline payout actually firing.
- Why judges care: It makes the escrow's future auditable at a glance, and the clock jump shows determinism live.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. It is read-only, and the clock jump reuses the existing `Clock` injection.
- Grounding: [OpenZeppelin TimelockController operation states](https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController); from the codebase (`Clock`, `releaseDueHolds`)

### Cancellation keeps what the artist already earned

- What: Make `cancelSale`'s rule explicit and table-driven. Shares already paid on their deadline stay with the artist, which already happens. An agreement can also name a non-refundable deposit percentage (cited by the agreement reader from saved answers); on cancellation, the artist share of that deposit is released to the artist and the rest is refunded. A property test checks that `artistKept + buyerRefunded == trustLocked` for every cancellation point. The cancel screen shows a two-colour bar of who gets what.
- Why judges care: Cancellation becomes a precise, visible split instead of "refund everything locked," matching how streaming escrows treat what was already earned.
- Demo visibility: both
- Effort: M
- Demo risk: low. With no deposit clause, behaviour is unchanged.
- Grounding: [Sablier cancellation](https://docs.sablier.com/concepts/lockup/overview); from the codebase (`cancelSale`)
