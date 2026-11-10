# Ramp's platform: what its API and engineering choices suggest for Rescrow

## What we learned

- Ramp's banking endpoints are read-only and in beta: list accounts, a per-day available balance history for each account (amounts in minor units), and "syncable transactions". The scope is `treasury:read`. The banking guide says nothing about webhooks. [Banking guide](https://docs.ramp.com/llms-guides/banking.txt)
- A business can hold more than one Checking Account (`WALLET_ACCOUNT`), but only one Investment Account (`BROKERAGE_ACCOUNT`) per entity. A Checking Account can fund cards and Bill Pay. [Banking guide](https://docs.ramp.com/llms-guides/banking.txt)
- Ramp's webhook events cover card transactions, bills, reimbursements, vendors, purchase orders and vendor agreements. There is no event for an incoming bank deposit, which backs decision D1: polling the deposit feed is the honest design. [Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt)
- Webhook deliveries are signed: `X-Ramp-Signature` is an HMAC-SHA256 of the raw body, computed with a per-subscription secret, and it must be checked before the JSON is parsed. [Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt)
- Each event `id` stays the same across retries and is also sent as `X-Ramp-Webhook-ID`. Ramp warns that duplicates and out-of-order delivery both happen, and tells receivers to store the event before returning 2xx. Retries on 429 and 5xx use exponential backoff with full jitter, up to 10 attempts with delays capped at 60 s, and honor `Retry-After`. [Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt)
- Accounting sync is a loop: fetch objects with `sync_status=SYNC_READY`, push them to the ERP, then post `POST /accounting/syncs`. The body carries an `idempotency_key` that Ramp dedupes on, plus `successful_syncs` and `failed_syncs` lists, each failure with an error message. [ERP integrations guide](https://docs.ramp.com/llms-guides/erp-integrations.txt)
- The ERP guide sorts sync errors into three kinds: user-actionable (for example, a closed period), transient (retry), and needs-integrator (send a reference ID). GL account uploads are all-or-nothing per batch. [ERP integrations guide](https://docs.ramp.com/llms-guides/erp-integrations.txt)
- Ramp's newer API fields give money as a signed integer in minor units plus an ISO 4217 currency code (for example `entity_amount` on transactions). [Developer API guides index and changelog](https://docs.ramp.com/llms-guides.txt)
- Ramp's payments platform keeps each logical transfer as one stable record, separate from its attempts. Retries create new attempt rows that point back to it. One state machine covers every rail, but settlement differs by rail: ACH settles on time, checks on an event. Timestamps are stored in UTC, not as dates. [Builders blog: payments platform](https://builders.ramp.com/post/payments-platform)
- Provider updates are deduplicated with a unique constraint and a `processed_at` flag under a row lock. Periodic polling runs next to webhooks as a backstop, and each bad record fails on its own instead of blocking the batch. [Builders blog: payments platform](https://builders.ramp.com/post/payments-platform)
- Ramp's engineering principles include moving fast on reversible decisions and slowly on irreversible ones, shaping data structures to match what customers handle, and building opinionated products over endless configuration. [Builders blog: engineering principles](https://builders.ramp.com/post/engineering-principles)
- Ramp's audit log API (`GET /audit-logs/events`) keeps adding event types such as "Large transfer initiated", and filters by actor type. [releases.sh mirror of the Ramp changelog](https://releases.sh/ramp/ramp-developer-api), [Ramp Audit Log support page](https://support.ramp.com/ramp-audit-log)
- Ramp pulls renewal dates and payment terms out of vendor contracts and reminds a stakeholder 60 days before a contract ends. That is the same pattern as Rescrow's agreement reader turning a clause into a dated obligation. [Contracts and renewals](https://support.ramp.com/contracts-renewals)
- Ramp Treasury pairs an operating business account with a separate investment account, a two-account sweep structure. [Ramp sweep account explainer](https://ramp.com/blog/business-sweep-account), [Treasury launch release](https://prnewswire.com/news-releases/ramp-launches-ramp-treasury-cash-management-that-maximizes-every-dollar-with-minimal-effort-302357161.html)
- Ramp's recent engineering writing puts weight on visual proof of a change before a human reviews it. [Builders blog post, Oct 2026](https://ramp.com/blog/introducing-inspect)

## How it applies to Rescrow

- Rescrow's trust account maps onto a second `WALLET_ACCOUNT`, which Ramp allows. That makes "per-account, per-day bank balance = ledger balance" a check we can actually run, against the same shape Ramp's balance-history endpoint returns.
- Ramp has no deposit webhook, so polling stays the right design (D1). We can still apply Ramp's own delivery rules (stable ids, duplicates, out-of-order arrival, store before process, backoff) to our polled feed, and test that `reconcile()` survives all of them.
- Ramp engineers live inside the accounting sync loop. A Rescrow export that posts balanced journal entries, with trust held as a liability and not as revenue, and uses their `SYNC_READY` / `idempotency_key` / `failed_syncs` shape, will read as native.
- Rescrow's payout is a single instant event today. Ramp's own platform separates a transfer's intent from its attempts and settles each rail differently. Modeling payouts that way, where a returned payout goes back to trust and never to operating, adds real-world fidelity without loosening the trust guard.
- `IncomingPayment.rampTransactionId` and the injected `Clock` in `engine.ts` already give us idempotent ingest and deterministic time. There is no `BankFeed` module in `src/lib` yet, so the feed ideas below add one.

## Feature ideas

### Two-account bank mirror with daily balance proof

- What: Model two Ramp `WALLET_ACCOUNT`s per gallery (operating, artist trust) and derive a per-day closing balance for each from the ledger, in the shape of `GET /banking/accounts/{id}/balance-history` (date, available balance in cents). A pure `bankToBook(snapshot, day)` checks each account's balance against the ledger buckets (trust = locked holds, operating = commission − creditor claims). The UI shows a small two-row strip, one per account, with a green tick per day. No new money buckets are added, so `reconcile()` is unchanged.
- Why judges care: this is how they would check it against real Ramp data, one account and one day at a time.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a pure function over existing state, so nothing new can stall on screen.
- Grounding: [Banking guide](https://docs.ramp.com/llms-guides/banking.txt); from the codebase (`reconcile.ts`, `galleryTotals`)

### Fault-injected bank feed with a seeded chaos test

- What: Add a `BankFeed` interface with `list({ start, pageSize })` cursor pagination, plus a `FakeRampFeed` that can be seeded to repeat transactions, deliver them out of order, split pages, and return 429 with `Retry-After`. The poller retries with seeded full-jitter backoff (capped, like Ramp's), and ingest stays idempotent on `rampTransactionId`. A property test runs a few hundred seeds and asserts that `reconcile()` balances and that no deposit is counted twice.
- Why judges care: it shows the ingest survives the exact failure modes Ramp documents for its own deliveries.
- Demo visibility: repo-rigor (a "duplicates dropped: 3" counter could appear on screen)
- Effort: M
- Demo risk: low. It runs in tests, and the on-screen counter is optional.
- Grounding: [Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt), [Builders blog: payments platform](https://builders.ramp.com/post/payments-platform); from the codebase (`rampTransactionId`)

### Accounting sync export (trust as a liability, not revenue)

- What: Generate balanced journal entries for each event. For a payment: debit Cash–Trust and Cash–Operating, credit Due to Artists (liability) and Commission Revenue. Payouts and refunds clear the liability. Entries carry `sync_status` (`NOT_SYNCED` → `SYNC_READY` → `SYNCED`), and a fake ERP sink is "marked" with a body shaped like `POST /accounting/syncs` (`idempotency_key`, `successful_syncs`, `failed_syncs`). A test asserts that debits equal credits per entry and that the Due to Artists balance equals `trustCents` from `reconcile()`.
- Why judges care: it plugs into the sync loop Ramp customers already run, and it gets the accounting treatment right.
- Demo visibility: both (a "Journal" tab with T-accounts)
- Effort: M
- Demo risk: low. It is derived data with no state changes.
- Grounding: [ERP integrations guide](https://docs.ramp.com/llms-guides/erp-integrations.txt), [Ramp: double-entry accounting](https://ramp.com/blog/double-entry-accounting)

### Payout intent vs attempt, with rail-specific settlement

- What: Split `Payout` into a stable `PayoutIntent` and one or more `PayoutAttempt`s on a single state machine (`created → submitted → settled | returned`). ACH settles on a clock offset and a wire on a feed event, both driven by the injected `Clock`. A returned attempt (for example R03, no account) moves the money into a "payout in flight" sub-bucket of trust, and it can only be retried to the artist through `releaseTrust`, never to operating. Reconcile adds `inFlightCents` to the trust side, and a test asserts the identity still holds through a return.
- Why judges care: it mirrors how Ramp's own payments platform separates intent from attempts, and shows trust stays put when a payout bounces.
- Demo visibility: both (the artist's phone shows "Sent → Settled")
- Effort: L
- Demo risk: med. It touches the payout path the demo relies on, so it needs the demo-flow test to stay green.
- Grounding: [Builders blog: payments platform](https://builders.ramp.com/post/payments-platform); from the codebase (`releaseTrust`, `Payout`)

### Append-only audit log with Ramp-style events

- What: Add an `AuditEvent` list (`id`, `at`, `actor_type`: gallery_user | artist | system | reader, `event_type` such as "Trust hold locked" or "Trust release refused", `entity`, before/after cents). Every refused `releaseTrust` call (for example, to operating) writes a "Trust release refused" event before throwing, so the guard leaves evidence. The UI gets a filterable log panel.
- Why judges care: an attempted trust breach becomes a visible, attributable record, not just a thrown error.
- Demo visibility: both
- Effort: S
- Demo risk: low. It only appends, and existing flows are unchanged.
- Grounding: [releases.sh mirror of the Ramp changelog](https://releases.sh/ramp/ramp-developer-api), [Ramp Audit Log](https://support.ramp.com/ramp-audit-log); from the codebase (`Activity`)

### Hash-chained ledger log (tamper evidence)

- What: Give each `Activity` / audit event `prevHash` and `hash` fields, where hash = SHA-256 of a canonical JSON of the event plus `prevHash`, using Node's built-in `crypto`. A pure `verifyChain(snapshot)` reports the first broken link. A test edits one historical hold amount in the JSON store and shows that both the chain and `reconcile()` flag it.
- Why judges care: the JSON file store becomes tamper-evident, which answers "what if the gallery edits the file?".
- Demo visibility: both (a "chain intact" badge next to the reconciliation badge)
- Effort: M
- Demo risk: low. Verification is read-only.
- Grounding: from the codebase (JSON file store, `Activity`); same raw-bytes canonicalization concern as the [Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt)

### Signed outbound events for the gallery's systems

- What: Rescrow emits its own events (`hold.locked`, `payout.settled`, `gallery.insolvent`) with a stable `id`, signed with HMAC-SHA256 over the raw body in an `X-Rescrow-Signature` header, the same scheme Ramp uses. Delivery goes to an in-process fake receiver that verifies, dedupes on `id`, and stores the event before acking. Tests cover a tampered body, a replayed id, and out-of-order arrival.
- Why judges care: it matches the integration contract they ship, from the other direction.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It is off the main demo path.
- Grounding: [Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt)

### Deadline radar for holds

- What: A pure `deadlineRadar(snapshot, now)` buckets locked holds by days until `dueBy` (overdue, under 7 days, under 30, later) and lists which agreement clause set each deadline. A "fast-forward" demo control advances the injected clock and shows `releaseDueHolds` paying a hold the moment it comes due.
- Why judges care: the per-payment deadline becomes a visible, dated obligation, the same way Ramp turns contract terms into renewal reminders.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. The clock is already injectable, and the release path already exists.
- Grounding: [Contracts and renewals](https://support.ramp.com/contracts-renewals); from the codebase (`dueBy`, `releaseDueHolds`, `Clock`)

### Money as signed minor units plus currency

- What: Introduce a `Money = { value: number (integer cents), currency: "USD" }` type at the API edge, matching Ramp's amount shape, with constructors that reject non-integers and mixed currencies. The engine keeps integer cents inside, and a test runs every `Snapshot` money field through the validator.
- Why judges care: it is the same money representation as their API, enforced by types and tests.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. Additive, at the edge only.
- Grounding: [Developer API guides index and changelog](https://docs.ramp.com/llms-guides.txt); from the codebase (`money.ts`, `Cents`)

### Sync error taxonomy on the reconciliation badge

- What: Turn `Reconciliation.breaks` from free strings into typed breaks with a category (`user_actionable`, `transient`, `needs_integrator`), a stable code, and a suggested fix. Examples: "payment with no sale" is user-actionable; "feed page missing" is transient; "hold sum ≠ trust balance" is needs-integrator with a reference id. The badge shows the category and fix.
- Why judges care: a failure tells the gallery what to do next, using the same categories Ramp's ERP guide uses.
- Demo visibility: both
- Effort: S
- Demo risk: low. Additive to an existing pure function.
- Grounding: [ERP integrations guide](https://docs.ramp.com/llms-guides/erp-integrations.txt); from the codebase (`reconcile.ts`)

### Isolated per-item failure in batch ingest

- What: When the feed returns a page with a bad transaction (unknown sale, negative amount, wrong currency), quarantine it in a `suspense` list with a reason and keep processing the rest. Reconcile gets a `suspenseCents` term, so unmatched money is counted, not lost. Resolving a suspense item either matches it to a sale or refunds it.
- Why judges care: one bad deposit cannot stall a gallery's books, and unmatched money still balances to the cent.
- Demo visibility: both (a "1 unmatched deposit" chip)
- Effort: M
- Demo risk: med. It adds a reconcile term, so every invariant test has to include it.
- Grounding: [Builders blog: payments platform](https://builders.ramp.com/post/payments-platform)

### Artist statement as a remittance record

- What: For each payout, generate a statement listing every hold it settled: payment date, payment amount, share in basis points, running-total rounding, the clause cited, and the "paid N days before deadline" margin. It renders as a printable page from pure functions, modeled on bill remittance receipts.
- Why judges care: the artist can check every cent against the agreement without trusting the gallery.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. Read-only and already in tier 2 scope.
- Grounding: [releases.sh: remittance receipts in the Ramp changelog](https://releases.sh/ramp/ramp-developer-api); from the codebase (`Payout.holdIds`, `artistShareOfPayment`)
