# Production double-entry ledger design

How the ledgers behind Modern Treasury, TigerBeetle, Square, Stripe, Uber, Airbnb and Formance work, and what Rescrow can take from them.

## What we learned

- Modern Treasury ledger transactions are mutable while pending and permanent once posted or archived. A posted mistake is fixed in one of two ways. You can post a full reversal followed by a corrected transaction, or post a single delta entry for the difference. [Modern Treasury: enforcing immutability](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)
- In Modern Treasury, account balances are never edited directly. Each account stores posted and pending debit and credit totals plus a normal balance, and posted, pending and available balances are computed from those totals on read. Only a pending entry can be replaced: it gets a `discarded_at` timestamp. [Modern Treasury: how to scale a ledger, part II](https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-ii)
- Modern Treasury "balance locks" attach a condition to an entry, for example `available_balance_amount: { gte: 0 }`. If posting would break the condition, the whole transaction is rejected with a 422. Category locks apply the same check to the combined balance of a group of accounts. [Modern Treasury: lock on account balance or version](https://docs.moderntreasury.com/ledgers/docs/lock-on-account-balance-or-version)
- Each Modern Treasury account has a `lock_version` that goes up whenever its balance changes. A write can pass the version it expects and fails if the account has moved on. You can also ask for balances `as of` a past `effective_at`, and list every version of a transaction. [Modern Treasury: verify prior ledger states](https://docs.moderntreasury.com/ledgers/docs/verify-prior-ledger-states)
- A TigerBeetle pending transfer reserves funds in the `debits_pending` and `credits_pending` fields. A later transfer that references it posts it, voids it, or lets it expire on a timeout. It can be resolved only once. A partial post settles part of the amount and returns the rest to the source. [TigerBeetle: two-phase transfers](https://docs.tigerbeetle.com/coding/two-phase-transfers/)
- In TigerBeetle, accounts and transfers can't be changed once created. Transfer IDs double as idempotency keys. A numeric `code` on each transfer records why the money moved, and amounts are integers in the smallest currency unit, for example cents for USD. [TigerBeetle: data modeling](https://docs.tigerbeetle.com/coding/data-modeling/)
- TigerBeetle account flags like `debits_must_not_exceed_credits` make the database itself refuse a transfer that would overdraw the account. For upper and lower bounds, a recipe chains linked transfers, and the chain either fully applies or fully fails. [TigerBeetle: balance bounds](https://docs.tigerbeetle.com/coding/recipes/balance-bounds/)
- TigerBeetle fixes a mistake with new transfers in the opposite direction. They carry a dedicated correction `code` and the original's `user_data_128`, so the original and its fix stay linked on one timeline. [TigerBeetle: correcting transfers](https://docs.tigerbeetle.com/coding/recipes/correcting-transfers/)
- Square's Books service records each journal entry as a set of book entries that must sum to zero. Apart from the running balance on each book, it only ever inserts rows. Each book also keeps a version counter that goes up with every entry. [Square: Books, an immutable double-entry accounting database](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)
- Stripe's Ledger is an append-only log that can be replayed to rebuild any past state. Money waiting in transit sits in "clearing" accounts, which should return to zero, so a nonzero clearing balance points to a broken flow. A completeness check requires a ledger event for every upstream record ID. [Stripe: Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)
- Uber's LedgerStore seals records in time windows, typically 30 minutes long. Each window gets a signed manifest that lists its time range and every record's checksum, and no writes are accepted after sealing. Corrections to a sealed window go into separate "revisions" that keep the original. [Uber: migrating LedgerStore from DynamoDB to Docstore](https://www.uber.com/en-US/blog/dynamodb-to-docstore-migration/)
- In Stripe-style idempotency keys, the server stores each key with its request parameters and the response it returned. A retry gets the stored response back. Reusing the key with different parameters returns 409, because the client has a bug. [Brandur: implementing Stripe-like idempotency keys](https://brandur.org/idempotency-keys)
- Airbnb built one shared idempotency library, Orpheus, and used it across its payment services, rather than fixing double payments separately in each one. [Airbnb: avoiding double payments](https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb)
- In the Formance ledger, accounts can't go negative, except for the special `@world` account that stands for money entering from outside. An account can be allowed a bounded overdraft with `allowing overdraft up to`, and scripts are not idempotent by default. [Formance: first transaction](https://docs-git-main-formance.vercel.app/ledger/get-started/hello-world/your-first-transaction), [Formance: overdraft](https://docs-git-main-formance.vercel.app/modules/numscript/reference/overdraft)

## How it applies to Rescrow

- Rescrow keeps state, not a journal. `releaseTrust` changes `hold.status` in place, `operatingBalanceCents` is a field that gets edited, and `reconcile()` checks totals derived from the current snapshot. Every production ledger above works the other way round: balances come from an append-only log of balanced entries. This is the biggest gap a Ramp engineer will notice.
- A trust hold is close to a TigerBeetle pending transfer with a timeout at `dueBy`, but the timeout behaves in reverse. When TigerBeetle times out, it voids the funds back to the source. When Rescrow's deadline passes, it pays the artist. Completing the sale is a "post" to the artist, and a cancellation is a "void" back to the buyer. The notes and code comments should state this difference instead of calling the two the same thing.
- Partial posts must not be copied. In TigerBeetle, the unposted remainder goes back to the source, which for Rescrow would let trust money flow back toward the gallery. Any deduction (for example, the tier-2 framing charge) has to be applied to the split before the hold is locked. It can never come out of trust.
- The trust guard is currently an `if` inside `releaseTrust`. Balance locks and account flags show how to make it a property of the trust account, checked when an entry is posted, so no code path can get around it.
- The specced `BankFeed` ingest (idempotent on `rampTransactionId`) isn't built yet, according to `docs/spec-A-backend.md` and a grep of `src`. The Brandur and Orpheus pattern says what "idempotent" should mean for it. A replay returns the original result, and a replay with a different amount is an error, not a silent skip.
- Integer cents, splits rounded on the running total, and `reconcile()` after every operation already match how TigerBeetle and Modern Treasury handle amounts and balances. The ideas below extend that work rather than replace it.

## Feature ideas

### Shadow append-only journal

- What: Add `journal: JournalEntry[]` to the Snapshot. Each entry holds `{ id, at, code, saleId, postings: [{ account, deltaCents }] }`, and every engine operation (split, payout, refund, deadline payout, creditor claim) appends one, next to the mutations it already makes. Accounts are named in a hierarchy like `bank:incoming`, `gallery:operating`, `trust:artist:<id>`, `artist:<id>:paid`, `buyer:<saleId>:refunded`, `creditors`. Postings in an entry must sum to zero, and entries are only appended, never edited.
- Why judges care: this is how the ledgers they know work, and it turns `reconcile()` from a check of totals into a check against the log.
- Demo visibility: both
- Effort: M
- Demo risk: low. It runs next to the current code and replaces nothing.
- Grounding: [Square Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/), [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement), from the codebase (`engine.ts`, `reconcile.ts`)

### Journal-derived balances must equal the snapshot

- What: A pure function `balancesFromJournal(journal)` folds the postings into per-account balances. `reconcile()` gets new named breaks that fire when the folded balances disagree with `operatingBalanceCents`, with the sum of locked holds, or with the sum of payouts, or when any entry fails to sum to zero. The existing 300-sale random test also checks the two views match after every operation.
- Why judges care: there are two independent records of the same money, and a test proves they agree to the cent.
- Demo visibility: repo-rigor
- Effort: S, once the journal exists
- Demo risk: low. It's test-only, plus one extra line on the reconciliation panel.
- Grounding: [Modern Treasury: scale part II](https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-ii), from the codebase (`invariants.test.ts`)

### Trust account rules enforced at posting time

- What: Each ledger account carries rules as data, for example `{ minBalance: 0, allowedCounterparties: ["artist:*", "buyer:*"] }` on `trust:*`. Every posting goes through one `post(entry)` that checks the rules and throws a typed `LedgerRejected` error (returned as `{ error }` with a 400, per the repo's route contract) before anything changes. In the insolvency beat, a "sweep trust to creditors" attempt is rejected by the ledger itself, and the error code appears on screen.
- Why judges care: the trust guarantee becomes a rule on the account that every posting must pass, the way TigerBeetle flags and Modern Treasury balance locks work.
- Demo visibility: both
- Effort: M
- Demo risk: low. It's deterministic, and the rejection is the point of the beat.
- Grounding: [Modern Treasury balance locks](https://docs.moderntreasury.com/ledgers/docs/lock-on-account-balance-or-version), [TigerBeetle balance bounds](https://docs.tigerbeetle.com/coding/recipes/balance-bounds/), [Formance overdraft](https://docs-git-main-formance.vercel.app/modules/numscript/reference/overdraft)

### Allowed-flow matrix, tested cell by cell

- What: A table `FLOWS[code] = { from: pattern, to: pattern }` lists every legal money movement, for example `SPLIT_ARTIST: bank:incoming -> trust:artist:*` and `REFUND_BUYER: trust:* -> buyer:*`. A test walks every pair of account kinds and asserts that only the listed pairs post. A `/ledger` panel shows the matrix with the trust-to-gallery and trust-to-creditor cells marked as blocked.
- Why judges care: the full list of ways money can move fits on one screen, and there is a test for every pair.
- Demo visibility: both
- Effort: S
- Demo risk: low. It's a static table plus a test.
- Grounding: [TigerBeetle data modeling (`code` as the why)](https://docs.tigerbeetle.com/coding/data-modeling/)

### Clearing account that must return to zero

- What: Every incoming payment first posts in full to `clearing:unsplit`, and the split moves it out to trust and operating. After each ingest, `clearing:unsplit` must be exactly 0, or `reconcile()` reports a named break listing the payment IDs still stuck in it. The reconciliation panel shows "Unsplit receipts: $0.00" with a check mark.
- Why judges care: it's the same zero-balance check Stripe uses to catch broken money flows, applied to the moment money is split.
- Demo visibility: both
- Effort: S
- Demo risk: low
- Grounding: [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)

### Holds as pending transfers, with pending and posted columns

- What: Treat each hold's lifecycle the way two-phase transfers work. Locking puts the share in the artist's trust as pending. Sale completion or the `dueBy` date posts it to the artist, a cancellation voids it back to the buyer, and a hold can be resolved only once. Each artist's trust row shows "pending in trust" and "paid out". Comments and a test state the difference from TigerBeetle: the timeout pays the artist instead of voiding, and partial posts back to the source are not allowed.
- Why judges care: the hold rules map onto a well-known two-phase design, and the code is explicit about where they differ from it.
- Demo visibility: both
- Effort: M
- Demo risk: low. It names states that already exist and adds a column.
- Grounding: [TigerBeetle two-phase transfers](https://docs.tigerbeetle.com/coding/two-phase-transfers/), from the codebase (`HoldStatus`, `releaseDueHolds`)

### Idempotent feed ingest with a request fingerprint

- What: Build the specced `syncFeed`, keyed on `rampTransactionId`, and store `{ key, fingerprint: hash(saleId, amountCents, method), result }` for each ingest. A replay with the same fingerprint returns the original hold and changes nothing. A replay with the same key but a different amount throws `IdempotencyConflict` and logs an alert. Tests cover a burst of 50 duplicate polls and one mismatched replay.
- Why judges care: it's the double-deposit bug every payments team has dealt with, handled the way Stripe and Airbnb handle it.
- Demo visibility: repo-rigor, plus an optional "feed replayed: 0 changes" line on screen
- Effort: M
- Demo risk: low
- Grounding: [Brandur: idempotency keys](https://brandur.org/idempotency-keys), [Airbnb Orpheus](https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb), from the codebase (`docs/spec-A-backend.md`)

### Hash-chained journal with a tamper check

- What: Each journal entry stores `prevHash` and `hash = sha256(prevHash + canonicalJSON(entry))`, using Node's built-in `crypto`, which works offline and gives the same result every time. `verifyChain()` walks the chain and names the first entry that doesn't match. In the demo, someone hand-edits one amount in the JSON store, and the reconciliation badge turns red with "entry 7 was altered after it was written".
- Why judges care: it makes "immutable" something you can check, in the spirit of Uber's sealing.
- Demo visibility: both
- Effort: M
- Demo risk: med. The hand edit on camera has to be scripted, but it can be a single button that corrupts a copy of the data.
- Grounding: [Uber LedgerStore sealing](https://www.uber.com/en-US/blog/dynamodb-to-docstore-migration/)

### Day-close seal and corrections as revisions

- What: A "close the day" action writes a manifest `{ from, to, entryCount, entryHashes, rootHash }` and refuses any later entry dated inside that window. Fixing a closed day means a new correction entry dated today, with `correctsEntryId` and a reason, and the sealed entry stays untouched. A test shows that a backdated write fails once the day is sealed.
- Why judges care: it matches how month-end close works for real finance teams, which is the work Ramp's customers do.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low
- Grounding: [Uber LedgerStore revisions](https://www.uber.com/en-US/blog/dynamodb-to-docstore-migration/), [Modern Treasury immutability](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)

### Cancellation as linked reversal entries

- What: A buyer cancelling posts `REFUND_BUYER` entries that reverse each split. They carry the original `saleId` as a correlation ID, and each one points to the entry it reverses, so the earlier entries are never edited. The `/ledger` view groups a sale's full history (splits, reversals, payouts) on one timeline, and a test asserts each sale's entries net to the expected final balances.
- Why judges care: corrections done as new entries instead of edits are the rule in every ledger they have worked on.
- Demo visibility: both
- Effort: S, once the journal exists
- Demo risk: low
- Grounding: [TigerBeetle correcting transfers](https://docs.tigerbeetle.com/coding/recipes/correcting-transfers/)

### Balances as of any moment (time scrub)

- What: `balancesAsOf(journal, t)` folds only entries with `at <= t`. A slider on `/present` scrubs through the demo and redraws operating, trust and paid-out balances at each step, with the reconciliation identity holding at every point, including the instant before and after insolvency.
- Why judges care: replaying the log to any past state is something a ledger built from stored state can't do, and it looks good on screen.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med. It adds a new interaction on the presenter page, so it needs a key binding and a reset path.
- Grounding: [Modern Treasury: balances as of effective_at](https://docs.moderntreasury.com/ledgers/docs/verify-prior-ledger-states), [Stripe Ledger replay](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)

### Account versions and stale-write rejection

- What: Each ledger account gets a `version` that goes up with every posting. Release paths pass the version they read, and `post()` throws `StaleVersion` if the account moved in the meantime, for example when a deadline payout and a sale-completion payout race for the same hold. A test fires both through `store.mutate` and shows exactly one payout and one rejection.
- Why judges care: it shows the design holds up when two requests hit the same money at once, which a single-user demo never tests.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low
- Grounding: [Modern Treasury lock_version](https://docs.moderntreasury.com/ledgers/docs/lock-on-account-balance-or-version), [Square Books version counter](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/), from the codebase (`store.ts` mutate queue)

### Journal inspector panel

- What: A `/ledger` page, or a drawer on `/present`, lists journal entries as two-column debit and credit rows with the entry's code and a running per-account balance. A green "sums to $0.00" tag sits on each entry. Clicking a payment on the main screen highlights its entry and the trust account it moved.
- Why judges care: they can see the actual double-entry record behind each animation, not only the totals.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. It's read-only and derived from the Snapshot.
- Grounding: [Square Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)

### Completeness check against the bank feed

- What: Every bank-feed transaction ID must map to exactly one `payment_received` journal entry, and every payment must map back to a feed transaction. `reconcile()` reports missing and orphaned IDs by name. A test drops one entry and expects the check to name the missing transaction.
- Why judges care: it ties the ledger back to the bank, the same completeness rule Stripe runs on every upstream record.
- Demo visibility: repo-rigor
- Effort: S, once the feed exists
- Demo risk: low
- Grounding: [Stripe Ledger completeness](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement), from the codebase (`docs/spec-A-backend.md` BankFeed)
