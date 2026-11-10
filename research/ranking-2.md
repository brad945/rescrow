# What Rescrow builds next, round two

All eight picks of [`ranking.md`](ranking.md) have shipped: the live trust-guard refusal, the double-entry journal with rules on its accounts, refund records, the demo clock, the planted-break catalogue and hold transition table, idempotent bank ingest, the Books view, and the seeded whole-engine random test. This round picks six more from the 214 in [`ideas.md`](ideas.md), in build order. Four are the plan for the remaining time; the last two are built only if time remains.

**Rubric.** Every pick was scored on seven tests:

1. **Judge impact.** Is it visible where a judge looks (`/books`, `/gallery`, the artist portal and statements, the phone on `/present`), or is it rigor a reviewer notices in the repo? Judges care most about ledgers, correctness, idempotency, payment rails and finance-team workflows.
2. **No new `/present` key or button.** The recorded take is already full. A pick may change what existing screens show.
3. **Full-stack coherence.** Does it name its backend change, API, UI surface and tests, and reuse the journal, the Books view, the refund records and the demo clock rather than building beside them?
4. **Offline and deterministic.** No network and no external services at runtime: the same inputs always give the same outputs.
5. **Buildable.** Can one engineer build it, with tests, in 1 to 3 hours?
6. **Safety.** Reconcile and the journal stay balanced, and `releaseTrust` / `postTrustRelease` stay the only exit from trust. The numbers pinned in `src/app/api/demo-flow.test.ts` don't move: $49,836.27 to creditors, $8,000 to Ines and $2,400 to Theo after insolvency, and $12,000 to Ines at completion.
7. **Honesty.** No claim the code can't back: no legal advice, no live Ramp calls, no real bank balances.

Each pick's **Why it wins** field scores all seven, in that order.

**One product, not a pile.** Round one made every cent take exactly one legal path. Round two makes the books something a gallery's accountant can sign off on, and something an artist can check without trusting the gallery.

- Pick 1 makes every payment, payout and artist reconcile on its own, not just the grand totals. The artist sees their own independent check on their statement.
- Pick 2 books the gallery's commission the way an agent should: as the buyer's deposit until the sale completes. That removes the one simplification `/books` admits to today.
- Pick 3 shows the artist every buyer payment with its bank transaction id, and when each share was paid against its deadline.
- Pick 4 closes the month. It refuses while reconcile shows any break (pick 1's included), then seals the month so any later change to it is a named break.
- Picks 5 and 6, if time remains: a payout deadline queue on `/books`, and a mapping onto the gallery's own chart of accounts that refuses to mix trust money into operating cash or income.

**Hours and cut line.** The plan (picks 1 to 4) is estimated at 6.25 hours, and the two stretch picks at 2.25 more.

| Picks   | Hours | Status                                                     |
| ------- | ----- | ---------------------------------------------------------- |
| 1 to 3  | 4.25  | The plan                                                   |
| 4       | 2     | The plan, built last of the four. Drop it if the day slips |
| 5 and 6 | 2.25  | Only if time remains                                       |

Every pick leaves the main branch green and the demo script working on its own, so the build can stop after any of them.

**Why this order.** Pick 1 adds checks only, and pick 4 gates on them. Pick 2 is read-only and fixes a stated weakness on a screen judges already see. Pick 3 is small, read-only and the only pick on the artist's side. Pick 4 has the most value for a finance audience but is the largest and adds a route, so it comes last in the plan. The deadline queue (pick 5) is behind the close because the phone already shows each share's lock-to-deadline bar, so on `/books` it repeats that view rather than adding a new one. No pick changes `journal.ts`.

**Shared shape changes.** These are additive and listed once here:

- `src/types.ts` gains `PeriodClose` (pick 4), and `Snapshot` gains an optional `closedPeriods?: PeriodClose[]`. A missing value means nothing is closed. It is not added to `KEYS` in `src/lib/store.ts` and `SEED_VERSION` stays at 3, so an existing `data/db.json` keeps loading; `createSeed()` doesn't set it, so no call site changes.
- `ActivityKind` gains `period_closed` (pick 4), logged with `galleryId` and a null `artistId`, so it never appears on the phone. `ActivityFeed.tsx` maps kinds through a `Partial` record, so it shows as "Event" until it gets a label.
- `POST /api/books/close` (pick 4) is added to `src/app/api/routes.test.ts`, not to the `ROUTES` map in `demo-flow.test.ts`, because `/present` never calls it. `closePeriod` joins both engine-name regexes in `architecture.test.ts`'s "routes run on the demo clock" test (the `MUTATORS` constant and the inline call-extracting `text.match(...)`), so the route must pass `clockFor(...)`.
- `CHART` in `src/lib/books.ts` gains `2020` (pick 2). It is a GL-only change: no journal account, code or posting changes.
- No pick adds a `JournalCode` or an account kind, adds a write to the money-write manifest, touches `src/components/story.ts` or the key handler in `src/app/present/page.tsx`, or changes `docs/demo-script.md`. The optional lines below are additions a presenter may use, not changes to the 2:30 script.

## 1. Sub-ledger checks: every payment, payout and artist reconciles on its own (I-005, I-004)

**Why it wins**

- **Rubric:** impact: `both`. It is rigor in `reconcile.ts`, plus a visible per-artist check on the statement and the portal · no new key: yes · coherence: it extends `reconcile()`, and with it the planted-break catalogue, the model test and pick 4's close gate · offline: yes, pure functions · buildable: M, low end · safety: high. It only adds checks · honesty: high. Each check compares two independently derived numbers and names the record
- Today `reconcile()` proves the gallery's totals: the identity, operating, trust per artist against the journal, and refund records.
- Totals can balance while individual records are wrong. Suppose one cent moves from Ines's first hold to her second. Every total, the journal and the per-artist trust balance still agree, so no check fires today.
- Sub-ledger checks catch that kind of error. They answer the question a payments engineer asks next: "does each payment reconcile, or just the sum?"
- It covers the parts of I-004 ("stuck money") that need no clock: money left in trust on a sale that is finished.

**Backend**

`src/lib/escrow/reconcile.ts` gains `subLedgerBreaks(s, galleryId)`. `reconcile()` appends its breaks after `journalBreaks`. Each is a named break:

- **Each payment's hold is its running-total share.** For each sale, the payments are taken in recorded order (the order `receivePayment` pushes them). Hold _i_ must equal `shareOf(cum_i, sale.artistShareBps) - shareOf(cum_{i-1}, sale.artistShareBps)`, the formula `artistShareOfPayment` uses, with the sale's frozen `artistShareBps`. `shareOf` comes from `src/lib/money.ts`, which `reconcile.ts` already imports from, so there is no new dependency on the engine. A payment without exactly one hold is skipped here, because the existing payment-to-hold checks already name it; indexing a missing hold would throw inside `TrustProof`.
- **Each hold belongs where it says.** Its `artistId` and `galleryId` match its sale's, and its payment's `saleId` is its own `saleId`.
- **No money left behind (I-004, the clock-free part).** These have no `locked` hold:
  - a sale with status `paid` or `cancelled`
  - any sale at a gallery with status `insolvent`
- **Each payout is made of its own artist's paid holds.**
  - every id in `holdIds` exists and is `paid`
  - each of those holds has the payout's `artistId` and `galleryId`
  - those holds sum to the payout's `amountCents`

  Today only the gallery-wide totals are compared.

New exported `artistAccount(s, galleryId, artistId)` returns `{ shareReceivedCents, heldCents, paidCents, refundedCents, agrees, journalAgrees }`:

- **The identity, from two sources.** `shareReceivedCents` is computed from the **payments**, not the holds: for each of the artist's sales at the gallery, `shareOf(sum of that sale's payments, sale.artistShareBps)`. Held, paid and refunded are summed from the **holds** by status. `agrees` is true when the first equals the sum of the other three. A missing, extra or resized hold makes it false.
- **The journal side.** `journalAgrees` checks a third source, the journal (`balancesOf`):
  - `trust:<g>:<artist>` equals `heldCents`
  - `artist:<g>:<artist>` equals that artist's payouts

The seed already satisfies every check:

- Mara's hold is 900,000, which is `shareOf(1_800_000, 5000)`.
- Theo's is 240,000, which is `shareOf(400_000, 6000)`.

The part of I-004 that needs a clock, "a hold past its `dueBy` must have been paid", is deliberately **not** a reconcile break. `reconcile()` takes no clock, and `TrustProof` runs it in the browser between polls of `/api/state`, so a share reaching its deadline between two polls would flash a red break on camera. It becomes pick 4's overdue gate instead, with `now` passed in.

Also deliberately left out: I-004's `clearing:unsplit` account. It would change the postings of every `RECEIPT_SPLIT`, the `glLines` receipt case and the `openingJournal` replay, which is money-path churn with no new check that the running-total rule above doesn't already give.

**API**

- None.
- Every route already returns the `Snapshot` that `reconcile()` reads.

**UI**

- **Statement footer.** `src/app/artist/[artistId]/statements/[payoutId]/page.tsx` adds one line from `artistAccount()`, for example: "Your account at Lowline Gallery: your share of buyer payments $12,000.00 = held $0.00 + paid to you $12,000.00 + returned to buyers $0.00. Checked against the payments, the trust holds and the separate journal ✓". If either check fails, the line says which one, in plain text.
- **Portal.** `src/app/artist/[artistId]/page.tsx` shows the same line under "Held in trust for you".
- **TrustProof.** No layout change. New breaks appear in its existing visible list (`TrustProof.tsx`), like every other break.

**Demo beat**

None required. After the happy path, the statement linked from Ines's phone ("View statement") now ends with her own account line. A presenter can point at it without a key.

**Tests**

New planted breaks in `src/lib/escrow/reconcile.test.ts`. The catalogue matches each expected break by regex against `breaks.join("\n")`, so new checks can't fail the existing rows. Each new row asserts its own named break:

- **One cent shifted between Ines's two holds.** No other check fires on this one, which is the reason the pick exists.
- a `locked` hold left on Mara's completed Tidewater sale
- a hold relabelled to another artist
- a payout whose `holdIds` include a hold of another artist
- a payout whose amount differs from its holds by one cent
- a `locked` hold left after insolvency

The existing plants "a payment loses its hold", "gets two holds" and `pay_ghost` still produce their own breaks and must not throw.

Unit tests for `artistAccount()`:

- `agrees` and `journalAgrees` hold for every seeded artist and at every step of the demo
- `agrees` turns false when one of the artist's holds is deleted, and when one is resized by a cent
- `journalAgrees` turns false when one `artist:` posting is edited

The existing healthy-state assertions must stay quiet. Each one asserts that `reconcile(...).breaks` equals `[]`:

- `demo-flow.test.ts`'s `balanced()`, run at every step
- the model test, after every step of 250 seeded runs, including deadline payouts, covered refunds, duplicates and insolvency
- `books.test.ts`, `journal.test.ts` and `ramp.test.ts`

A false positive on any real path fails CI before it can reach the screen.

**Invariants**

- It only adds checks, so money, the journal and the pinned numbers are untouched.
- `releaseTrust` is untouched.

**Effort** About 1.5 hours.

**Risk**

- Low.
- The per-payment check must use the order payments were recorded, not `receivedAt`, which can tie to the millisecond under a fixed test clock.
- It must skip, not index, a payment without exactly one hold (see Backend).

## 2. Commission held as the buyer's deposit until the sale completes, with cash and accrual views (I-144, I-145)

**Why it wins**

- **Rubric:** impact: `both`, on `/books`, a screen judges already see · no new key: yes · coherence: a pure change to `glLines` in `books.ts`, built on the journal and the refund records, and shown on pick 4's close card · offline: yes · buildable: M, low end · safety: high. It is read-only · honesty: high. It removes a simplification the screen currently has to confess
- `/books` states one simplification in two places:
  - the header comment of `src/lib/books.ts` (lines 8 to 10)
  - the trial-balance footnote in `src/app/books/page.tsx`

  Both say commission is booked as revenue when each payment lands and reversed on cancel.

- A gallery is an agent. Its commission is earned when the sale completes, and until then the gallery's part of each installment is the buyer's deposit. Booking it that way is the accounting a gallery's accountant (and Ramp's accounting product) would expect.
- `cancelSale` already behaves as if this were true: it hands the gallery's part back to the buyer.

**Backend**

`src/lib/books.ts`:

- `CHART` gains `2020 Buyer deposits, gallery part`, a credit-normal liability.
- **`RECEIPT_SPLIT`.** Debit 1010 and credit **2020** for the gallery's part, instead of crediting 4010. The trust lines are unchanged (1020 / 2010).
- **Recognition on the completing receipt.** If a receipt completes its sale, the same GL entry adds: debit 2020, credit 4010, for the sum of that sale's gallery parts so far.
  - A receipt completes its sale when the running total of that sale's payments, up to and including this one, equals `priceCents`. This is decided from the running total, never from the sale's current `status`.
  - A GL entry's content is therefore fixed when its journal entry posts and never changes later. The QuickBooks export can still be deduplicated on `DocNumber`.
- **`OPERATING_TO_BUYER`.** Debit **2020** for the gallery's part (the deposit goes back), debit 5010 for any covered share, and credit 1010.
  - Only open sales can be cancelled, so the deposit is always still in 2020.
- **Insolvency.**
  - `OPERATING_TO_CREDITORS` is unchanged.
  - An open sale's deposit stays in 2020 after operating cash goes to the administrator, so it shows as still owed to that buyer.
  - That is the honest picture after the insolvency beat: the work's buyer paid the gallery's part and has not been made whole. Rescrow doesn't claim what the administrator will pay them.
- **Seed.**
  - Tidewater's single receipt completes its sale, so it is recognised at once.
  - Theo's open Four Lamps sale leaves $1,600.00 in 2020.

New `incomeStatement(lines, basis: "accrual" | "cash")`:

- **Accrual:** revenue is 4010.
- **Cash:** revenue is the gallery's part of buyer cash received, less the gallery's part refunded.
- Covered refunds (5010) are an expense on both bases.

**API**

None. The views are built in the browser from the `Snapshot` by pure functions, as `/books` already is.

**UI**

`src/app/books/page.tsx`:

- The trial balance gains the 2020 row.
- The footnote changes to: "The gallery's part of each payment is held as the buyer's deposit (2020) until the sale completes, then recognised as commission (4010). A cancelled sale returns it from 2020."
- A small "Commission earned" card with an Accrual / Cash toggle. The toggle is component state only.

`books.ts`'s header comment is updated to match.

**Demo beat**

Optional, about 5 seconds, on `/books` after `B`:

> The gallery's part of the buyer's two payments is still shown as owed to that buyer. It was never revenue, and Ines's trust was never the gallery's at all.

**Tests**

`src/lib/books.test.ts`:

- The existing "every GL entry balances" and tie-out tests run unchanged over `history()`.
- In "the ledger accounts match the engine's own balances":
  - 2020 equals the gallery parts of open sales
  - 4010 equals the gallery parts of completed sales
- A completing receipt's GL lines are identical whether `glLines` runs right after it or at the end of `history()` (export stability).
- A cancelled sale nets to 0 in 2020.
- `incomeStatement`:
  - cash minus accrual equals the 2020 balance at every step of `history()`
  - in a history where every sale completes or is cancelled, the two are equal

There are no byte-for-byte golden export files today, only a same-run stability check, so nothing golden needs regenerating.

**Invariants**

- It reads only. The journal, `reconcile()` and the pinned numbers can't change.
- Account 1020 still equals 2010, so the tie-out badge is unaffected.

**Effort** About 1.5 hours: three GL cases, the income statement, the toggle and five tests.

**Risk**

- Low.
- The one judgement call is the completing-receipt test. A redelivered final payment posts no journal entry, so it can't recognise revenue twice.

## 3. Buyer payments and when each share was paid, on the artist portal (I-125, I-128)

**Why it wins**

- **Rubric:** impact: `shown`, on the artist portal and statements · no new key: yes · coherence: it surfaces round one's `rampTransactionId` (idempotent ingest) and `dueBy` (demo clock) where the artist sees them · offline: yes · buildable: S, about 1.25 hours · safety: high. It is read-only · honesty: high. It shows only recorded dates and the payout's recorded reason
- Artists in the research notes needed a lawyer to find out whether a collector had paid. The portal today shows only "Buyer has paid $X of $Y".
- This pick lists every payment, with the same bank transaction id that idempotent ingest keys on, so an artist can match it to the gallery's word.
- The scorecard measures the problem the product solves, from the records.

**Backend**

New `src/lib/artist.ts`, with pure functions only.

`artistPayments(s, artistId)` returns one row per payment on the artist's sales:

- the work, and "payment _n_ of _N_"
- `receivedAt`, method and amount
- `rampTransactionId`
- the share locked from it
- its hold's status: held, paid with date, or returned to the buyer
- `dueBy`
- for a paid hold, how it was paid, by the payout's recorded `reason`, with the dates shown rather than inferred:
  - completion (`sale_complete`, or no `reason` as on the seeded `po_tidewater`): "paid when the sale completed, _d_ days before the deadline", where _d_ is the number of whole UTC calendar days from the payout date to the `dueBy` date. Counting calendar days, not `floor(ms / day)`, means a share released seconds after it was locked on a 60-day window reads 60, not 59.
  - `deadline`: "paid at the deadline check: due _dueBy date_, paid _payout date_". On the demo clock the two dates are one day apart, because `T` jumps 61 days past a 60-day window and `releaseDueHolds` pays on the next poll. The row shows both dates rather than calling it "on the deadline".
  - `insolvency`: "paid out of trust when the gallery became insolvent", with no day count. The statement page already words this reason the same way.
  - a hold without `dueBy` (Mara's seeded hold): "no deadline on record"

`paymentScorecard(s, artistId)` classifies paid shares by payout `reason`, never by comparing timestamps:

- paid at completion, before the deadline
- paid at the deadline check
- paid when the gallery became insolvent

Insolvency payouts are not counted as on time or late: the buyer never finished paying, and the gallery failed. Shares returned to the buyer are excluded.

**API**

None.

**UI**

`src/app/artist/[artistId]/page.tsx`:

- New "Buyer payments" card, with a row per payment and its bank transaction id in a monospace face.
- The scorecard line, for example "3 shares paid when the sale completed, all before the deadline", or after `T` and completion, "1 paid at the deadline check · 2 paid when the sale completed".

The statement page:

- adds the bank transaction id under each buyer payment
- adds the per-share line from `artistPayments` ("60 days before your deadline", "at the deadline check: due … paid …", or the insolvency wording)
- changes the footer's `deadline` branch (`statements/[payoutId]/page.tsx`, line 150) from "on the payout deadline in your agreement" to "at the deadline check in your agreement, while the buyer was still paying", so the footer agrees with the dates in the rows above it. No test pins that string.

The phone on `/present` is unchanged, which keeps its 720px layout as recorded.

**Demo beat**

None required. A presenter who opens Ines's statement after the happy path sees `rtx_<saleId>_1` to `_3` next to her three shares.

**Tests**

- Happy path through the engine, sending the same `rampTransactionId`s `stepFor` puts in each payment body (`rtx_<saleId>_<n>`): Ines has three rows carrying those ids. Run once with a frozen clock and once with a clock that advances a few seconds per call (as the wall clock does): every share reads "60 days before the deadline" both times, and the scorecard reads 3 paid when the sale completed.
- `T` after payment 1 (`advanceClock`, 61 days), then the remaining payments: the first share reads "at the deadline check" with its two dates one day apart, and the scorecard reads 1 at the deadline check and 2 at completion.
- `B` after payment 2: Ines's shares and Theo's seeded share read "when the gallery became insolvent", carry no day count, and land in the insolvency tally only.
- Cancel after payment 1: the share reads "returned to the buyer" and is excluded from the scorecard.
- The seeded Mara row shows "no deadline on record" without throwing.
- A share locked at 23:59:59 UTC and released at 00:00:01 the next day reads 59, which is correct by calendar date.

**Invariants**

- It reads only. Money and the pinned numbers can't change.

**Effort** About 1.25 hours.

**Risk**

- Low.
- The wording is the risk, and it is fixed by rule: the row reports the payout's recorded reason and its recorded dates, never a computed "late" or "on time".

## 4. Month-end close that refuses to run while the books don't reconcile, then seals the month (I-149)

**Why it wins**

- **Rubric:** impact: `both`. Closing the month is the finance-team workflow at the centre of the judges' own accounting product · no new key: yes. The button is on `/books`, not `/present` · coherence: it gates on `reconcile()` (with pick 1's sub-ledger checks) and on the demo clock's due holds, shows pick 2's trial balance and the existing tie-out as context, and seals the journal round one built · offline: yes · buildable: M, the largest pick in the plan · safety: high. It moves no money and doesn't change `journal.ts` · honesty: high. It seals with entry counts and totals, and says what that does and doesn't prove
- Round one deferred this because it needed the Books view and a sync-status model first. The Books view now exists. This pick drops the "nothing waiting to sync" check and says so, rather than waiting for I-148.
- It ties the product's guarantee to a monthly ritual: the books can't be closed while anything fails to reconcile, and once closed, any later change to that month is a named break.

**Backend**

`src/types.ts`:

- `PeriodClose { id, galleryId, month, through, closedAt, entryCount, totals, checks }`
  - `month` is `YYYY-MM`; `through` is its last instant (UTC).
  - `totals` is the journal balance of each of the gallery's accounts as of `through`.
  - `checks` uses the existing `VerificationCheck` type.
- the optional `Snapshot.closedPeriods` described above

`src/lib/books.ts` gains the pure helper `nextMonthToClose(s, galleryId)`: the month after the gallery's latest close, or, if it has none, the month of its earliest journal entry. The page labels its button with it and the server checks against it, both from the same snapshot.

`src/lib/escrow/engine.ts`:

- The `due` predicate inside `releaseDueHolds` is extracted and exported as `isDue(hold, nowMs)`. `releaseDueHolds` calls it, so its behaviour is unchanged.
- **`closePeriod(s, { galleryId, month }, clock)`**, beside the other state changes so it can use the module's private `log()`. `engine.ts` may import `books.ts` and `reconcile.ts`, because neither imports the engine, so there is no cycle.
  - **Which month.** `month` must equal `nextMonthToClose(s, galleryId)`, so months close in order and none is skipped. After `T` jumps 61 days, the button still offers the earliest open month, and the next click offers the one after it. A stale page that sends the wrong month gets a 400 naming the right one.
  - **Has it ended.** The month's `through` must be before `clock.now()`.
  - **Gates.** Both are recorded as `VerificationCheck`s. If either fails, it throws `EscrowError` naming each failure, and nothing changes:
    - `reconcile()` has no breaks, including pick 1's
    - no locked hold of the gallery `isDue` at `clock.now()`
  - **Context, not gates.** The trial balance through `through` and `trustTieOut` are recorded on the close for the card to show. They are not gates: `glLines` builds every GL entry balanced from its parts, and the tie-out's per-artist test repeats reconcile's own trust-per-artist check, so neither can fail on its own. Calling them checks would overstate the close.
  - **Seal.** On success it records `entryCount` and `totals` for the gallery's journal entries dated through `through`, appends the close and logs `period_closed` with the month in its text ("Books closed for October 2026").
  - **Insolvent galleries.** A close is allowed after insolvency. It moves no money, and an administrator needs the books closed most of all; the close then records that trust still ties out to the cent.

`src/lib/escrow/reconcile.ts`:

- For each close of the gallery, the journal entries dated through its `through` must still number `entryCount` and fold to `totals`.
- An edited, deleted or inserted entry in a closed month is a named break, for example "Books closed for October 2026 with 4 entries and operating $41,836.27; the journal now shows 5 entries".
- **What the seal proves.** It catches any later edit made without also rewriting the close record.
- **What it doesn't prove.** Whoever controls the data file can rewrite both. No hash is used, because the same limit applies to a hash anyone holding the file can recompute; that is why round one rejected I-015. The `/books` footnote says this in one line.

Deliberately not built, and named as missing on screen:

- a preventive lock that refuses postings dated into a closed month. No live path can post backdated today (every entry is stamped `clock.now()`, the demo clock only moves forward, and reset drops every close), so the lock would guard nothing reachable while adding a check under every money move on the day of recording. It is the next step, in `apply()`.
- sync status (I-148)
- the second lock level, where the reviewer must differ from whoever paid out
- reopening a closed period

**API**

New `POST /api/books/close` with body `{ galleryId, month }`, validated with zod:

- Inside one `mutate`, it first runs `releaseDueHolds(latest, clockFor(latest))`, exactly as every `/api/state` poll does, then `closePeriod(..., clockFor(latest))`. A deadline that passed since the last poll is paid first, so the button doesn't refuse with "overdue" on camera; the overdue gate becomes a defensive assertion.
- It returns the full `Snapshot` with status 200.
- If a gate fails or the month is wrong, it returns `{ error }` with status 400, listing every failure.

**UI**

`src/app/books/page.tsx`:

- **The button.** "Close October 2026", with the month from `nextMonthToClose(snapshot, GALLERY)`, disabled with "October 2026 hasn't ended" while it is the current month. It goes through the existing `act()` from `useSnapshot`, so a 400 shows its reasons as visible text.
- **Closed periods card.** Each close is listed with its two gates ticked, its entry count, its trial balance and tie-out shown as context, and a "Sealed" tag.
- **Footnote.** "Months in UTC. Sealed by entry count and totals: this catches later edits, not someone who rewrites the whole file. Postings into a closed month are detected, not yet refused. Not synced to an accounting system."

**Demo beat**

None in the 2:30 script. In the live final, on `/books`, about 10 seconds:

> Close the month. Rescrow refuses if anything fails to reconcile, down to each payment. Once it's closed, any change to that month shows up as a named break.

**Tests**

New `src/lib/escrow/close.test.ts`, on `createSeed()` with a fixed clock:

- **Happy close.** It records two passing gates, an `entryCount` equal to the seed's entries dated in the month, and `totals` equal to `balancesOf` over them.
- **Refusals.** Each one leaves the snapshot deep-equal and names its own failure:
  - a planted extra cent in operating (reconcile)
  - a planted trust posting (reconcile's trust-per-artist check)
  - Theo's hold made due by a clock past its `dueBy`, calling `closePeriod` directly without a release first (overdue)
  - the same month closed twice
  - a month after the next one to close (gap)
  - the current month (not ended)
- After a close, a payment at the current clock still posts normally, and `reconcile()` stays clean.
- After `B`, a close succeeds.
- **Seal.** Planted breaks in `reconcile.test.ts`: a closed-month entry edited, one deleted, one inserted directly into the array.

Elsewhere:

- `routes.test.ts`: 200 returns a `Snapshot`; a deadline that passes before the close is paid and the close still succeeds; a second close of the same month, a wrong month and a bad body are each a 400.
- `architecture.test.ts`: `closePeriod` added to both engine-name regexes, so its route is held to `clockFor`.
- `releaseDueHolds`'s existing tests run unchanged after `isDue` is extracted.
- `demo-flow.test.ts` is unchanged. The script never closes a period.

**Invariants**

- `closePeriod` moves no money and adds no journal entry, so reconcile's identity and every pinned number are unchanged. The route moves money only through the same `releaseDueHolds` call every poll already makes.
- `journal.ts` is unchanged, so `releaseTrust` and `postTrustRelease` stay the only exit from trust.
- `reset` returns a fresh seed with no closes.

**Effort** About 2 hours: the type, the helper, `closePeriod`, the seal in reconcile, the route, both architecture regexes, about ten close tests, three seal plants and the card.

**Risk**

- Low to medium. It is the largest pick in the plan, so it comes last of the four.
- Month boundaries are in UTC, so a payment at 9pm New York time on 31 October is in November's books. The card says so.

## 5. Payout deadline ladder on the books (I-202)

**Why it wins**

- **Rubric:** impact: `shown`, on `/books` · no new key: yes. It reacts to the existing `T` jump · coherence: it reads the frozen `payoutDays` and `dueBy` on each hold, the demo clock (`clockFor`) and pick 4's `isDue` · offline: yes. `now` is a parameter · buildable: S, about 1 hour · safety: high. It is read-only · honesty: high. Each deadline names its source
- Round one cut this to keep the demo clock to 2 hours, and named it the natural first addition to the Books view.
- It turns "every share is paid by its deadline" into the queue a finance team works from, like a lender's curtailment list.
- It is a stretch pick because the phone on `/present` already shows each locked share's lock-to-deadline bar; this puts the same facts in the accountant's view.

**Backend**

New `deadlineLadder(s, galleryId, nowIso)` in `src/lib/books.ts`:

- **Buckets.** Every `locked` hold of the gallery goes in one of these:
  - overdue (`isDue` at `now`)
  - due within 7 days
  - due in 8 to 30 days
  - due later
  - no deadline on record (a hold without `dueBy`)
- **Row.** Each row gives the artist, work and amount, `lockedAt` and `dueBy`, whole UTC calendar days left, and the window's source: "60 days from receipt, fixed on the sale", from `sale.payoutDays`. For a sale without it, the window is "from the agreement".
- **Totals.** The bucket totals sum to the gallery's locked holds.

**API**

None.

**UI**

`src/app/books/page.tsx`:

- New "Payout deadlines" card, computed with `deadlineLadder(snapshot, GALLERY, clockFor(snapshot).now())`. The page adds an import of `clockFor` from `engine.ts` (it imports only `reconcile` and `books` today).
- The overdue bucket shows in red with the line "Past its deadline: paid out on the next poll." `/api/state` runs `releaseDueHolds` on every poll, so the bucket is normally empty.
- The view follows the demo clock: after `T` on `/present`, Ines's first share and Theo's share leave the ladder (paid at the deadline check), and each later payment's share appears 60 days out on the demo clock.

**Demo beat**

None required. The `T` take on `/present` is unchanged.

**Tests**

- `deadlineLadder` against `createSeed()` with a fixed `now`:
  - Theo's $2,400 is "due within 7 days" at `SEED_NOW`
  - it is overdue at `SEED_NOW` plus 5 days
- After `releaseDueHolds` at that time, the overdue bucket is empty.
- At every step of `books.test.ts`'s `history()`, the bucket total equals `reconcile().trustCents`.
- A hold without `dueBy` lands in "no deadline on record", never in "later".

**Invariants**

- It reads only. No money moves and no pinned number can change.

**Effort** About 1 hour.

**Risk**

- Low.
- Day boundaries are in UTC, stated in the card's footnote.

## 6. Map the books onto the gallery's own chart of accounts (I-146)

**Why it wins**

- **Rubric:** impact: `both`. Mapping into the customer's chart is the core of the judges' own accounting product · no new key: yes · coherence: it feeds the existing CSV and QuickBooks exports in `books.ts`, and picks up pick 2's 2020 account · offline: yes. The gallery's chart is a fixture in the repo · buildable: S to M · safety: high. It is read-only and refuses unsafe mappings · honesty: high. It is labelled as export mapping, not a sync
- Today the exports use Rescrow's own codes (1010 to 5010), which no gallery's bookkeeper has.
- The interesting part is what the mapping refuses. Mapping restricted trust cash to the operating bank account, or due-to-artists to income, would commingle trust money on paper even though the bank never did. This pick refuses that, with a reason per line.

**Backend**

New `src/lib/chart.ts`:

- **The gallery's chart.** `GALLERY_CHART` is a fixture shaped like a small-business chart with account types: Bank, Other Current Liability, Income, Equity, Expense. It includes a separate "Trust account (artists)" bank line.
- **`validateMapping(mapping, galleryChart)`.** It is all-or-nothing, and it returns every reason a mapping is refused:
  - 1020 is not mapped to a Bank account
  - 1020 and 1010 are mapped to the same account
  - 2010 or 2020 is not mapped to a liability
  - 2010 or 2020 shares a gallery account with 1010, income or another liability that isn't owed to artists or buyers
  - a Rescrow account is left unmapped

  Other many-to-one mappings, such as both equity codes onto one equity account, are allowed: that is ordinary practice and mixes no trust money.

- **Exports.** `toCsv` and `toQuickBooksJson` take an optional validated mapping and write the gallery's account numbers and names in `AccountRef`. Without one, they write Rescrow's codes as today.

**API**

None. The mapping is chosen on the page and kept in the browser's local storage. The page says so: "saved in this browser only".

**UI**

`/books` gets an "Export to your chart" card:

- one select per Rescrow account
- the refusal reasons shown as visible text
- the export buttons use the mapping once it validates

**Demo beat**

None.

**Tests**

- One test per refusal reason.
- Two equity codes mapped to one gallery equity account validate.
- A valid mapping exports with the gallery's codes, and debits still equal credits.
- Re-exporting with the mapping is byte-stable.
- The trial balance is unchanged by any mapping.

**Invariants**

- It reads only. Money, reconcile and the pinned numbers can't change.

**Effort** About 1.25 hours.

**Risk**

- Low.
- Only built if picks 1 to 4 land with time to spare.

## Considered and rejected

- **I-131 (clause-gated deductions):** still the strongest runner-up, and it now loses on safety as well as budget. Theo is the only artist with a deduction clause, and his seeded Four Lamps hold is in the take: it is narrated going out on its own deadline at `T` (`docs/demo-script.md`), and it is the pinned $2,400 in `demo-flow.test.ts`. A deduction applied to his split or payout is exactly the change that could move a pinned number. It would also change `artistShareOfPayment`, the function the 2:00 to 2:20 code cut shows, and add a third term that pick 1's per-payment check, cancel and the statement would all have to carry. Next round, after the live final.
- **I-089 (suspense bucket):** no route ingests from the bank feed. `ingest()` in `src/lib/feed/ramp.ts` is test-only, and unmatched transactions there are only listed. Unapplied cash would need a new route, a new account kind and a reconcile term (2.5 to 3 hours) for a state no screen can produce today. It is the natural step once a real poller exists.
- **I-007 (three-way reconciliation):** round one's rejection stands. The feed is still simulated, so the bank leg would be generated from the same events as the ledger.
- **I-115 (ownership cap):** `createSale` already refuses any work that isn't `consigned` ("is not available for sale"), so selling a whole work twice is blocked. Fractional ownership isn't in the product.
- **I-116 (double-sell button):** it needs a new `/present` key, which this round rules out.
- **I-097 (with and without Rescrow):** round one's honesty rejection stands. It needs an assumed recovery rate for an invented gallery.
- **I-098 (Stephen Friedman waterfall):** it puts a different gallery's reported figures, in pounds, on the climax screen beside Lowline's computed ones. The hook already cites them in words.
- **I-100 (lowest intermediate balance tracer):** it needs invented rent and payroll debits to have anything to trace.
- **I-090 (feed chaos test):** `ramp.test.ts` already proves a duplicated and reordered page books each transaction once. The 429 and `Retry-After` half needs a poller with backoff that doesn't exist, so it would test new scaffolding rather than the product.
- **I-064 (returned payment with R-codes):** `paidSoFar` and `nextInstallment` count every payment. A returned ACH would mean reworking the running-total split and the installment count in the money path. That is M to L, too close to the recording.
- **I-148 (sync status):** L. Pick 4 states plainly that it is not built.
- **I-150 (auditor's journal-entry test pack):** Rescrow has no manual entries, so its central tests (manual entries touching 1020 or 2010, posted on a weekend or after close) would all pass vacuously.
- **I-152 (sold-out-of-trust audit):** pick 1 covers the same per-payment and per-payout completeness inside `reconcile()`, where the model test already runs it.
- **I-013 (typed reconciliation breaks):** it changes the shape of `Reconciliation.breaks`, which `TrustProof` and many tests read, for no new visible check.
- **I-210 (invariant counter):** `reconcile()` runs in the browser on every render, so a stored counter would count screen renders, not checks of the books.
- **I-206 (live T-accounts):** `/books` already lists each journal entry with its postings and "sums to $0.00". Animating T-accounts on `/present` needs space the phone layout doesn't have.
- **I-204 (insolvency Sankey):** round one's reason stands: medium risk on the climax screen for a point `TrustProof` already makes in one line.
- **I-015, I-175 and I-188 (hash chains, signed checkpoints, golden hashes):** round one's rejections stand. Pick 4 deliberately seals with counts and totals and states the same limit.
- **I-017, I-039, I-061, I-105, and I-008 / I-030 / I-031:** round one's safety rejections stand. Each either contradicts Theo's framing clause, changes the narrated split or the $49,836.27 at `B`, or changes the insolvency route the recording uses.

## As built

Where the shipped code differs from this plan:

- `SEED_VERSION` is 4, not 3: seeded sales gained their frozen payout windows after this plan was written, which needed a reseed.
- The trust tie-out compares the engine's records (locked holds) with the general ledger's 2010, not 1020 with 2010, because those two are written together and couldn't disagree.
- Deadline payouts are stamped at each share's own `dueBy`, so the artist timeline says "paid on its deadline" rather than "at the deadline check".
- A payment or a cancellation pays any share already past its deadline first, so a late share is never swept into a completion payout or refunded.
