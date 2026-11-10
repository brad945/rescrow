# What Rescrow builds next

This ranking picks eight features from the 214 in [`ideas.md`](ideas.md), in build order. Each one adds depth to the first draft without breaking the recorded demo.

**Rubric.** Every pick was scored on six tests:

1. **Judge impact.** Is it visible in a three-minute recording, or is it rigor a reviewer notices in the repo? The judges care most about ledgers, correctness, idempotency, payment rails and finance-team workflows.
2. **Full-stack coherence.** Does it name its backend change, API, UI surface, demo beat and tests, and does it reuse the picks before it?
3. **Offline and deterministic.** No network and no external services at runtime: the same inputs always give the same outputs.
4. **Buildable.** Can one engineer build it, with tests, in 1 to 3 hours?
5. **Safety.** Reconcile stays balanced, `releaseTrust` stays the only exit from trust, and the numbers pinned in `src/app/api/demo-flow.test.ts` don't move. Those numbers are $49,836.27 to creditors, $8,000 to Ines and $2,400 to Theo after insolvency, and $12,000 to Ines at completion.
6. **Honesty.** No claim the code can't back.

Each pick's **Why it wins** field gives its scores.

**One product, not a pile.** The picks share one storyline: _every cent has exactly one legal path, and you can watch the system refuse the others._

- Pick 1 shows the guard refusing a move on camera, on Ines's phone.
- Pick 2 puts a double-entry journal beside the engine's records, so the refusal becomes a rule on the trust account itself.
- Pick 3 makes cancelled buyers whole, through that journal.
- Pick 4 lets a judge watch the per-payment deadline fire, which pick 3 made safe to show.
- Picks 5 and 6 make the books hard to fool: a reconciler proven able to fail, and idempotent bank ingest.
- Picks 7 and 8 reuse the journal: a general-ledger (GL) view for the gallery's accountant, and a random whole-engine test that exercises every pick above it.

**Hours and cut line.** The estimated total is 14.5 hours for all eight picks.

| Picks   | Hours | Status                                 |
| ------- | ----- | -------------------------------------- |
| 1 to 4  | 7.5   | The plan, with about 30 minutes' slack |
| 5 and 6 | 3     | Next if time remains                   |
| 7 and 8 | 4     | Drop first                             |

Every pick leaves the main branch green and the demo script working on its own, so the build can stop after any of them.

**Why this order.** Pick 1 gives the recording a new visible beat in the first hour. The journal comes second because picks 3, 5, 6 and 7 all build on it, and it is the strongest signal for judges who read ledgers. The refund fix comes before the demo clock because the clock makes the short-refund bug reachable on stage. The two pure-rigor picks that need no new visual (5 and 6) sit just past the line, where they can still land on a good day.

**Shared shape changes.** These are additive and listed once here:

- `Snapshot` gains `journal: JournalEntry[]` (pick 2) and `refunds: Refund[]` (pick 3). Both are added to `KEYS` in `src/lib/store.ts`, so an old `data/db.json` is reseeded instead of loading without them. The store already handles stale files this way for `artistShareBps`.
- `Snapshot` gains an optional `clockOffsetMs` (pick 4), defaulting to 0.
- `ActivityKind` gains `trust_move_refused` (pick 1), `gallery_covered_refund` (pick 3) and `feed_duplicate` (pick 6). `ActivityFeed.tsx` maps kinds through a `Partial` record, so a new kind falls back to "Event" until it gets a label.
- Every new activity row is logged with the sale's `galleryId` and `artistId`. The phone on `/present` lists only rows where `artistId` is the story artist (`src/app/present/page.tsx:252-254`), so a row without an artist would never appear on camera.
- No test builds a `Snapshot` by hand. They all start from `createSeed()`, which keeps a fixed default (pick 4), so the new fields only need a seed value and no call site changes.
- Every pick that adds a route adds it to the `ROUTES` map in `demo-flow.test.ts`, or `call()` throws "has no route".

## 1. The trust guard refusing a move, live, plus presenter fixes (I-016, I-214)

**Why it wins**

- **Rubric:** impact `both` (a refusal on camera, plus three on-screen fixes) · coherence: pick 2 rewires the same beat onto the journal's account rule, and `G` joins the existing `R C B` keys · offline: yes, a pure engine call · buildable: S · safety: high, no money moves · honesty: high, the row shows the real guard's real error text.
- PRD point 2 says the gallery can never spend trust money. Today that is a slide claim.
- With this pick, judges watch the gallery try to spend the $8,000 held for Ines. The runtime guard in `releaseTrust` (`src/lib/escrow/engine.ts:98`), the same check any untyped JSON caller hits, refuses it. The refusal lands on Ines's phone and under the balance strip, while every balance stays put.
- It also fixes three on-screen inaccuracies a careful judge would catch.
- It needs nothing from the later picks, so it ships first.

**Backend**

- New `attemptTrustMove(s, { saleId, kind: "rent" | "creditor" }, clock)` in `engine.ts`.
- It collects **that sale's** locked holds, not the whole gallery's. After payment 2 that is Ines's $4,000 + $4,000 = $8,000, which matches the narration. Gallery scope would also sweep in Theo's seeded $2,400 (`hold_lamps_1`) and show $10,400.
- It calls `releaseTrust` with the destination `"operating"` (for "pay June rent from trust") or `"creditors"` (for "the bank sweeps the trust account"). `releaseTrust` checks before it changes anything (`engine.ts:98-102`), so the attempt leaves state untouched.
- It catches the `EscrowError` and logs a `trust_move_refused` activity with `galleryId`, `artistId` (the sale's artist, `art_ines` in the story), the amount and the exact error text. Nothing else changes.
- `releaseTrust`'s TypeScript signature stays `"artist" | "buyer"`. The cast happens at this one entry point, which is exactly the kind of untyped caller the runtime check exists for. Pick 2 replaces the cast with a real ledger posting that the trust account refuses.
- If the sale has no locked hold (for example, right after the sale and before payment 1), it throws `EscrowError("Nothing in trust to try")`.

**API**

- New `POST /api/demo/attempt` with body `{ saleId, kind }`, validated with zod like the other demo routes.
- A refusal is the expected outcome of this action, so the route returns 200 with the full Snapshot.
- A bad body, or nothing in trust, returns `{ error }` with status 400.
- `docs/spec-A-backend.md` gets one line recording the 200 as a deliberate exception to the "errors are 400" rule, so nobody later "fixes" it.

**UI**

`/present`:

- A new `G` key and a "Gallery tries to spend trust" button next to "Gallery goes under". It shows only when `step.canFail` is true. `stepFor` adds the `/api/demo/attempt` body for the story sale.
- The phone's notification list (`present/page.tsx:357-371`) styles rows by kind: a `trust_move_refused` row gets the danger border and a "Refused" label. It arrives at the top of the list because it carries Ines's `artistId`.
- `TrustProof` shows the latest refused move as one visible line under "Books balance to the cent", for example "Refused: $8,000.00 from Ines Duarte's trust to operating".

Presenter fixes (I-214):

- The "Gallery goes under" key hint at `src/app/present/page.tsx:156` says `I`, but the handler listens for `B`. Change it to `B`.
- `TrustProof.tsx:33` hides reconciliation breaks in a `title` tooltip. Show them as visible text.
- Replace `snapshot.galleries[0]` with the story's `GALLERY` id at `present/page.tsx:255` and in `GalleryAccount.tsx` (lines 11 and 87).

**Demo beat**

Optional, about 10 seconds. After payment 2, press `G`:

> The gallery tries to pay June rent out of the eight thousand held for Ines. Refused, with the reason, on her phone, and not a cent moved.

The 2:30 script works without it.

**Tests**

- Engine test for both kinds: `galleries`, `holds`, `payments` and `payouts` are deep-equal before and after. The activity list grows by exactly one `trust_move_refused` row, with `artistId === "art_ines"` and `amountCents === 800_000`.
- Engine test: Theo's seeded hold is untouched and not counted.
- Route test: 200 returns a Snapshot. Calling it after the sale but before payment 1 returns 400 ("Nothing in trust to try"), which is reachable from reset because the attempt is scoped to the story sale.
- New `demo-flow.test.ts` case, with `/api/demo/attempt` added to `ROUTES`: press → four times, call the attempt, then `B`. It asserts the same `4_983_627`, `800_000` and `240_000`.

**Invariants**

- No money moves, so reconcile is unchanged.
- No new exit from trust: the attempt goes through `releaseTrust` and is refused there.
- Operating is untouched, so creditors' $49,836.27 is the same whether or not `G` was pressed.
- The existing demo-flow cases are unchanged.

**Effort** About 1.25 hours.

**Risk**

- Low.
- One judgement call is wording: the row must say "refused", not "failed", so it doesn't read as a bug on camera.
- The phone list keeps only its top 4 rows, so after `G` and then `B` the refusal may scroll off. That's fine, because the insolvency beat is the story by then.

## 2. Double-entry journal with trust rules on the account (I-001, I-002, I-018)

**Why it wins**

- **Rubric:** impact `rigor`, plus one visible tag · coherence: the foundation picks 3, 5, 6 and 7 reuse, and it rewires pick 1's beat · offline: yes · buildable: M, top of the range · safety: high, it mirrors balances and tightens the guard · honesty: high, it is described as a mirror journal checked against the records, not as the source of balances.
- Every money move becomes a zero-sum entry in an append-only journal written alongside the existing records. `reconcile()` then has a second, independent record to compare against, to the cent. Balances are not yet derived from the journal: doing that would recompute every pinned number through new code a day before the recording. The mirror is the step before it, and says so in its doc comment.
- It turns "the only way out of trust" from a comment on `releaseTrust` into a rule on the trust account, enforced when an entry is posted.
- After this pick, pressing `G` is refused by the trust account's rule, not just by a string check.

**Backend**

New `src/lib/escrow/journal.ts`:

- **Accounts**, all scoped by gallery: `equity:opening:<gallery>`, `operating:<gallery>`, `trust:<gallery>:<artist>`, `external:buyer:<saleId>`, `external:artist:<artist>` and `external:creditors:<gallery>`. Trust is keyed by gallery and artist so a per-gallery reconcile stays correct when one artist consigns to two galleries.
- **`ACCOUNT_RULES`** (I-002), rules as data: `trust:*` has `minBalance: 0` and may be debited only by `TRUST_TO_ARTIST` or `TRUST_TO_BUYER`. `operating:*` has `minBalance: 0`.
- **`JournalEntry`:** `{ id, at, code, postings: { account, cents }[], ref }`.
- **Codes:** `RECEIPT_SPLIT`, `TRUST_TO_ARTIST`, `TRUST_TO_BUYER`, `OPERATING_TO_BUYER`, `OPERATING_TO_CREDITORS`, `OPENING`.
- **`post(s, entry)`:** throws `LedgerRejected` (a subclass of `EscrowError`, so routes still return 400) before anything changes if any of these fail:
  - the entry has at least one posting
  - the postings sum to zero
  - every amount is a non-zero integer
  - the code is known
  - every account's rule in `ACCOUNT_RULES` holds, including no balance below its minimum
- **One door for trust debits:** `post()` refuses any entry that debits a `trust:*` account. `journal.ts` exports a single `postTrustRelease(s, entry)` that allows only `TRUST_TO_ARTIST` and `TRUST_TO_BUYER`. Only `releaseTrust` in `engine.ts` calls it.

Hooks. **A hook whose total is zero posts nothing**, because a zero entry would be rejected and turn a legal operation into a 400:

- `receivePayment` posts one `RECEIPT_SPLIT`: buyer to operating plus trust.
- `releaseTrust` posts one entry per call: trust to the artist, or trust to the buyer. It already has each hold's artist and sale, so the private `payOut` doesn't need to be exported. With an empty `holds` list it posts nothing.
- `cancelSale` posts the operating-to-buyer part, unless it is 0.
- `declareInsolvency` posts operating to creditors, unless operating is 0.
- `attemptTrustMove` (pick 1) now builds a trust-to-operating (or trust-to-creditors) entry and submits it to `post()`. `post()` refuses it under `ACCOUNT_RULES`, and that `LedgerRejected` text is what the refused row shows. The `releaseTrust` runtime check stays as a second layer.

Seed. `createSeed()` calls `openingJournal(seed)`, which posts only `OPENING` entries and **never debits trust**, so it needs no exception to either guard:

- `equity:opening:gal_lowline` funds `operating:gal_lowline` with the seeded operating balance.
- It funds `trust:gal_lowline:art_theo` with 240,000, Theo's locked hold.
- Mara's completed sale is history from before the journal started, so it is posted net: the buyer side to operating for the gallery's part, and the artist's part straight to `external:artist:art_mara`, never through trust.

`reconcile()` gains named breaks when a journal balance disagrees with the records:

- `operating:<gallery>` against `operatingBalanceCents`
- each `trust:<gallery>:<artist>` against that artist's locked holds at that gallery
- external artist and buyer totals against payouts and refunds

**API**

- No new route.
- Every state-changing route (`demo/*`, `state`, and `agent/read` in saved mode) already returns the full Snapshot, which now carries `journal`. `agent/warm` and the streaming `agent/extract` are unaffected.

**UI**

- `TrustProof` adds "journal agrees" next to "Books balance to the cent".
- The pick's only new screen element is that tag. The Journal list and the flow-matrix panel move to pick 7, which already builds a books view.

**Demo beat**

Repo rigor, with no required beat. During the 2:00 to 2:20 code cut, the script can show `ACCOUNT_RULES` and `post()` instead of, or after, `artistShareOfPayment`. Pick 1's `G` beat now shows the ledger's refusal text.

**Tests**

New `journal.test.ts`:

- `post()` rejects an unbalanced entry, an empty entry, a zero amount, a float amount, a trust overdraft and a trust debit to operating, and the snapshot is deep-equal after each rejection
- `postTrustRelease` rejects any code other than the two trust codes
- the seed's journal folds to the seed's balances, and contains no trust debit
- the zero cases post nothing and still succeed: cancel of an open sale with no payments, insolvency with operating at 0, and cancel after every hold was paid on its deadline (built by calling `releaseDueHolds` with a late clock)

Architecture test (I-018) scans `src/**`, skipping `*.test.ts` files. It fails the build if any of these happens:

- a file other than `engine.ts` and `seed.ts` imports a posting function (`post`, `postTrustRelease`, `openingJournal`) from `journal.ts`. Read-only folds such as `balancesOf(journal)` may be imported anywhere, which is how `reconcile.ts` and pick 7's `books.ts` use the journal.
- a file other than `engine.ts` imports `postTrustRelease`, or code in `engine.ts` outside `releaseTrust` calls it
- a file other than `engine.ts` contains a `.status =` assignment. Today the only such lines are in `engine.ts`, and the only hold one is at line 110.

Pick 1's tests now also assert the refused row carries the `LedgerRejected` text.

The existing `demo-flow.test.ts` `balanced()` helper picks up the new journal breaks automatically through `reconcile()`.

**Invariants**

- The journal mirrors existing balance changes and never replaces them, so every pinned number is computed exactly as today.
- `post()` refuses trust debits outright, and the architecture test pins `postTrustRelease` to `releaseTrust`. That makes `releaseTrust` the only code that can debit trust, a stronger rule than today's.
- The "every intermediate step keeps the books balanced" test now also checks the journal at every step from reset.

**Effort** About 3 hours.

**Risk**

- Medium-low.
- It touches all four functions that move money (`receivePayment`, `releaseTrust`, `cancelSale`, `declareInsolvency`) plus the seed, so a missed hook shows up as a red break on camera.
- That is also why it comes early: the demo-flow test catches a missed hook at once.
- If it overruns, the Journal UI was already moved out, so nothing visible is lost.

## 3. Refund records that make the buyer whole (I-076, I-083)

**Why it wins**

- **Rubric:** impact `rigor`, with a visible ledger row · coherence: posts through pick 2's journal, and is the prerequisite for pick 4 · offline: yes · buildable: M (small) · safety: high, the scripted `C` numbers are unchanged · honesty: high.
- It fixes a real case where the books balance but the buyer is short-changed. If a share was already paid to the artist on its deadline, `cancelSale` today refunds only the locked holds plus the gallery's part.
- Pick 4 makes that path reachable on stage, so this pick lands first.

**Backend**

New `Refund { id, saleId, buyerName, fromTrustCents, fromOperatingCents, coveredByGalleryCents, holdIds, at }` in `Snapshot.refunds`.

`cancelSale` writes the `Refund` record:

- The locked holds go back through `releaseTrust(buyer)`. If none are locked (every share was paid on its deadline), that call releases nothing and posts nothing.
- The gallery's part comes from operating.
- Any share already paid to the artist stays with the artist, and the gallery repays it to the buyer from operating, logged as `gallery_covered_refund` with the sale's `galleryId` and `artistId`.
- If operating can't cover it, the cancel throws instead of taking operating negative.

Refund caps (I-083):

- Per sale, the refunded total must equal the paid total, never more.
- A second cancel is already refused by the status check, and that refusal is now tested.

`reconcile()`:

- reads `refundedToBuyersCents` from the `Refund` records
- checks each record against its holds and the journal
- extends the expected-operating formula with the covered amount

`ledgerFor` in `src/components/ledger.ts` builds refund rows from the records.

**API**

- No new route.
- `/api/demo/cancel` returns the Snapshot with `refunds`.

**UI**

- `/gallery` ledger: a refund row splits into "from trust" and "from operating".
- Artist statement: a deadline-paid share that was kept is labelled "kept, paid on the deadline".

**Demo beat**

Unchanged. The optional `C` beat after payment 1 shows the same caption, and `fromOperatingCents` equals the gallery's half.

**Tests**

- Engine test: cancel after a deadline payout means the buyer gets back exactly what they paid, the artist keeps the deadline share, and reconcile and journal are clean.
- Engine test: cancel after every hold was paid on its deadline (no locked holds) still succeeds, with `fromTrustCents` 0.
- Engine test: cancel with too little operating cash throws and leaves the snapshot deep-equal.
- The existing demo-flow cancel case adds an assertion that the refund record total equals the payments.

**Invariants**

- Trust money still leaves only through `releaseTrust(buyer)`. The covered amount comes from operating, never from another hold.
- The scripted `C` path has no paid holds, so the numbers are the same as today.
- `B` happens on a sale with no cancel, so creditors are unchanged.

**Effort** About 1.25 hours.

**Risk**

- Low.
- The reconcile formula change is the delicate part. Pick 5's planted breaks cover it later, and this pick's own deadline-then-cancel test covers it now.
- Known limit: when operating can't cover the refund, the buyer has no path inside Rescrow. A recorded shortfall is a follow-on, not part of this pick.

## 4. Demo clock and deadline payouts you can watch (I-201)

**Why it wins**

- **Rubric:** impact `both`, the strongest new visual · coherence: uses picks 2 and 3 · offline: yes, the clock is a stored offset and the seed takes `now` as an argument · buildable: M · safety: medium, see Risk · honesty: high, the key is labelled as a demo clock ("Day +61").
- The per-payment deadline (D4 in the PRD) is the core promise for long payment plans. Today nobody can watch it happen.
- It also fixes a latent bug: Theo's seeded hold `hold_lamps_1` has no `dueBy`, so `releaseDueHolds` would never pay it on a deadline.

**Backend**

- `Snapshot.clockOffsetMs`, with a default of 0.
- `clockFor(s)` returns a `Clock` whose `now()` is wall time plus the offset. Every route uses it inside `mutate`, including both `releaseDueHolds` calls in `/api/state`.

Seed:

- `createSeed(now = SEED_NOW)`, where `SEED_NOW` is the fixed constant `2026-11-09T16:41:12.000Z`. **Every** seed timestamp is computed as an offset from `now`, so the default call returns exactly today's seed, dates included. The 37 existing `createSeed()` calls across 13 files need no change.
- Only `store.ts:63` and `src/app/api/demo/reset/route.ts:9` pass the wall-clock time.
- That moves all of Theo's history together: `sale_lamps.createdAt`, his payment, `hold_lamps_1.lockedAt`, and the seeded activity rows `act_seed_3` and `act_seed_4` keep their current spacing relative to reset. Mara's history moves the same way, so the seeded feed stays in order.
- `hold_lamps_1` gains `dueBy` 14 days after its payment (his agreement's term), which is 4 days after reset. A fixed `dueBy` of 2026-11-13 would pay Theo on the first poll after that date and change the insolvency beat.

New `advanceClock(s, { days })` raises the offset (1 to 120 days), then runs `releaseDueHolds`.

`stepFor` in `story.ts` sets `canFail` to false while `clockOffsetMs > 0`. After `T`, Ines's first share has already been paid, so the insolvency caption would truthfully say $4,000 instead of the narrated $8,000. Hiding `B` makes that take impossible instead of relying on a script note.

**API**

- New `POST /api/demo/advance { days }` returns the full Snapshot.
- `/api/demo/reset` zeroes the offset through the new seed.

**UI**

`/present`:

- A new `T` key ("Day +61"), shown only while the story sale is open.
- The phone draws each of Ines's locked holds as a bar from lock to `dueBy`, with the days left.
- The deadline payout row already carries Ines's `artistId`, so it appears in her phone's notifications.

**Demo beat**

Optional, its own take: `R`, then → until payment 1 lands, then `T`.

> Sixty-one days later the buyer still owes two payments. Ines's agreement says each share is due sixty days from receipt, so Rescrow paid her $4,000 out of trust anyway. Theo's fourteen-day share went too.

The `B` button is hidden after `T`, so this take can't collide with the insolvency take.

**Tests**

Engine tests:

- `advanceClock` past `dueBy` pays exactly the due holds as `deadline_payout`
- the sale stays open
- the remaining payments still bring Ines to `1_200_000` in total
- reconcile and journal are clean
- a cancel after `T` returns the buyer's full payment (pick 3's path)

Seed tests:

- `createSeed()` with no argument deep-equals today's seed apart from Theo's new `dueBy`
- Theo's `dueBy` is after `now`, so polling `/api/state` right after reset pays nothing

Existing test change. `trust.test.ts:116-120` ("leaves holds alone before their deadline and returns the same state") breaks, because Theo's seeded hold is now due by 2027-01-09. It changes to:

- assert that the story sale's holds are all still `locked`, and drop `toBe(s)`
- add a sibling case that `releaseDueHolds` at `SEED_NOW` plus 3 days returns the same state

The case at `trust.test.ts:100` keeps passing. Theo's hold pays as a separate payout, and the newest activity row is still a `deadline_payout`.

`story.test.ts`: `canFail` is false when `clockOffsetMs > 0`.

New `demo-flow.test.ts` case, with `/api/demo/advance` added to `ROUTES`: `T` after payment 1, then the rest of the script. Ines still totals `1_200_000`.

The existing insolvency case is untouched.

**Invariants**

- Deadline payouts already go through `payOut` and then `releaseTrust(artist)`, so there is no new exit.
- Operating is untouched by deadline payouts. With offset 0, which is every existing case, every pinned number holds.
- The existing demo-flow cases never call `advance`, and `B` can't follow `T`.

**Effort** About 2 hours. The aging ladder (I-202) is left out to keep it there.

**Risk**

- Medium. This is the only pick that changes seed timestamps and how routes get their clock.
- A forgotten `clockFor` in one route would stamp a payout before the insolvency that caused it, and the step-7 caption filters on `paidAt >= insolventAt` (`story.ts:39`).
- The demo-flow insolvency case catches this.

## 5. A reconciler proven able to fail (I-190, I-019)

**Why it wins**

- **Rubric:** impact `rigor` · coherence: its corruption table covers picks 2 and 3 · offline: yes · buildable: S · safety: high, it only adds checks · honesty: high, it removes a check that could never fail.
- Most "we reconcile" claims never test that the checker can fail. This pick does, and it fixes a real hole.
- When `openingBalanceCents` is missing, `reconcile.ts:63-68` derives the opening balance from operating itself. The operating balance then cancels out of both the operating check and the overall equation, so a planted cent in operating goes undetected entirely.
- The hold transition table makes illegal status moves impossible by construction, and proves it exhaustively rather than by example.

**Backend**

`reconcile.ts`:

- A missing `openingBalanceCents` becomes a named break ("No opening balance on file") instead of a derived value.
- The only seeded gallery, `gal_lowline`, already sets it (`seed.ts:101`).

`engine.ts`:

- Gains `HOLD_TRANSITIONS`: `locked` goes to `paid` or `refunded`, and both of those are terminal.
- Gains `transition(hold, to)`, which `releaseTrust` uses instead of assigning `status` directly.

**API** None.

**UI**

- None new.
- Breaks already show as text after pick 1.

**Demo beat** Repo rigor, no beat.

**Tests**

New `reconcile.breaks.test.ts`, a table of planted corruptions applied to a mid-demo snapshot. Each one asserts its own named break:

- one extra cent in operating, with and without an opening balance on file
- a deleted hold
- one hold listed in two payouts
- a hold marked paid with no payout
- trust above receipts
- a missing opening balance
- a journal entry edited after posting (pick 2)
- a refund record that disagrees with its holds (pick 3)

A transition test walks every (state, action) pair.

**Invariants**

- It only adds checks.
- The seed and every demo step already pass them, which the existing demo-flow cases prove.

**Effort** About 1 hour.

**Risk**

- Low.
- If a planted corruption turns out not to be caught, that is a finding to fix, and the reason this pick exists.

## 6. Idempotent Ramp transaction ingest, with a redelivery key (I-088, I-091, I-093)

**Why it wins**

- **Rubric:** impact `both` · coherence: reuses the journal and adds a completeness check to `reconcile()` · offline: yes, the feed is a local fake · buildable: M · safety: high, a duplicate moves nothing · honesty: high, the feed is called simulated, as `docs/demo-script.md` already says.
- Ramp's banking API is read-only and has no deposit webhook, so Rescrow would poll. Polls with overlapping windows, and pages retried after a timeout, return transactions already seen.
- Idempotent ingest is the first thing a payments engineer checks.
- `IncomingPayment.rampTransactionId` already exists in `src/types.ts:116`, with the comment "ingesting the same id twice is a no-op", but nothing implements it yet. This pick makes the comment true.

**Backend**

`receivePayment` accepts an optional `rampTransactionId` and assigns `clock.id("rtx")` when it is missing, so direct engine callers (`engine.test.ts`, `trust.test.ts`, `invariants.test.ts`) get an id too. It checks the id first, before the sale-status and gallery-active checks, so a redelivery after completion or after insolvency is still a no-op.

The duplicate check compares **only the fields the caller sent**: `saleId` always, and `method` and `amountCents` only when present. `stepFor` sends no amount and the engine fills in `nextInstallment`, which is 0 once the sale is paid, so comparing a filled-in amount would turn a retried final payment into a conflict.

- **Same id, matching details:** money is unchanged, no journal entry is posted, and one `feed_duplicate` activity row is logged with the sale's `galleryId` and `artistId`, so it shows on Ines's phone.
- **Same id, different details:** throws `IdempotencyConflict` (a subclass of `EscrowError`) naming both versions.

New `src/lib/feed/ramp.ts`, which is **test-only scaffolding**. No route or timer calls it, and the ranking doesn't claim a polling loop exists:

- a `BankFeed` interface with `list({ cursor })`
- a `FakeRampFeed` that replays a scripted page list and can deliver pages twice or out of order
- `ingest(s, txns, clock)`, which matches the memo `RSC-<saleId>` to a sale

Seeded payments get fixed `rampTransactionId`s.

`reconcile()` gains a completeness break (I-093) when either of these is true:

- two payments share an id
- a payment has no id

**API**

- `/api/demo/payment` accepts an optional `rampTransactionId` and passes it through.
- `stepFor` in `src/components/story.ts` passes a deterministic `rtx_<saleId>_<n>` in each payment body.
- New `POST /api/demo/redeliver { galleryId }` re-posts the gallery's latest payment with its stored id, amount and method, and returns the full Snapshot.

**UI**

`/present`:

- A new `D` key. The phone shows "Ramp delivered rtx_… again: already booked, nothing moved" as a notification, in a neutral style.
- The balances visibly don't change.

**Demo beat**

Optional, about 5 seconds, after any payment:

> The next poll of Ramp's transactions overlaps the last one and returns a wire we've already booked. Rescrow recognises it. Nothing moves.

**Tests**

Engine tests:

- a duplicate is a no-op (`galleries`, `payments`, `holds`, `payouts` and `journal` are deep-equal) and logs one row with the sale's `artistId`
- a retried final payment with no amount is a no-op, not a conflict
- a conflicting duplicate (different amount sent) returns 400
- a duplicate after the sale is paid is still a no-op
- a duplicate after insolvency is still a no-op

Feed tests: `FakeRampFeed` delivering a page twice and reordered ingests each transaction exactly once, and reconcile is clean.

Pick 5's corruption table gains "two payments share an id".

`demo-flow.test.ts`:

- `story.test.ts` keeps passing because the body only gains a field.
- New case, with `/api/demo/redeliver` added to `ROUTES`: press `D` after payment 3, and Ines still totals `1_200_000`.

**Invariants**

- A duplicate never creates a payment, a hold or a journal entry, so nothing new is received or held and the reconcile equation is untouched.
- The scripted path sends each id once, so every pinned number is unchanged.

**Effort** About 2 hours.

**Risk**

- Low.
- The one trap is ordering: the idempotency check must run before `assertActive` and the `sale.status !== "open"` check, or a redelivery after completion returns a 400 instead of a no-op.

## 7. Books view: journal, GL with trust as a liability, tie-out badge and accountant export (I-142, I-143, I-147, I-003)

**Why it wins**

- **Rubric:** impact `both` · coherence: a pure function of pick 2's journal, and the screen where pick 2's rules become visible · offline: yes, export files only · buildable: M · safety: high, read-only · honesty: high, it says "export file", not "synced", and states its revenue simplification.
- Accounting is a finance-team workflow at the centre of the judges' own product.
- Trust shown as restricted cash against a "due to artists" liability is the balance-sheet identity a gallery's accountant can check.

**Backend**

New `src/lib/books.ts`, which maps journal accounts to a chart of accounts:

| Code | Account                        | Journal source                    |
| ---- | ------------------------------ | --------------------------------- |
| 1010 | Operating cash                 | `operating:*`                     |
| 1020 | Restricted trust cash          | `trust:*`                         |
| 2010 | Due to artists                 | per artist                        |
| 3000 | Opening equity                 | opening entries                   |
| 3900 | Turned over to administrator   | operating to `external:creditors` |
| 4010 | Commission revenue             | the gallery's part                |
| 5010 | Refunds covered by the gallery | pick 3's covered amount           |

How each journal code posts:

- **Receipt:** debit 1010 for the gallery's part and 1020 for the artist's part, credit 4010 and 2010.
- **Payout to the artist:** debit 2010, credit 1020.
- **Refund from trust:** debit 2010, credit 1020.
- **Refund from operating:** debit 4010 (reversing the commission), credit 1010. A covered share debits 5010.
- **Insolvency:** debit 3900, credit 1010. Trust lines don't move.

It provides:

- `glEntries(s)`, which turns each journal entry into balanced lines
- `trialBalance(s)`
- `trustTieOut(s)`: 1020 must equal 2010 in total, and each artist's 2010 balance must equal their locked holds
- pure serializers to CSV and to a QuickBooks-style `JournalEntry` JSON, with references taken from journal entry ids so re-exports never duplicate

**API**

- None.
- The export is built in the browser from the Snapshot by the pure serializers, so the rule that every route returns the full Snapshot holds.

**UI**

`/gallery` gets a Books tab:

- the Journal list moved here from pick 2: each entry with its postings and a "sums to $0.00" tag
- a flow-matrix panel (I-003) drawn from `ACCOUNT_RULES`, with the trust-to-operating and trust-to-creditors cells shown as blocked
- the trial balance and a "Trust covered 100.00%" tie-out badge
- Download CSV and Download QuickBooks JSON buttons, labelled "export file", not "synced"

**Demo beat**

Optional, about 5 seconds, at the end on `/gallery`:

> The gallery's accountant gets the same books: trust is a liability, never revenue.

**Tests**

- Every GL entry balances.
- The trial balance sums to zero at every demo step.
- The tie-out holds at every step, and fails on a planted extra cent.
- The flow matrix shows exactly the cells `ACCOUNT_RULES` allows, checked against `post()` for every pair of account kinds.
- Golden tests: CSV and QuickBooks JSON for the post-insolvency snapshot are byte-stable, and their totals match `reconcile()`.

**Invariants**

- It reads only. It derives from the journal and never posts, so money, reconcile and the pinned numbers can't change.

**Effort** About 2.5 hours.

**Risk**

- Low for the demo.
- One accounting simplification: commission is booked as revenue when each payment lands, and reversed on cancel. Holding it as a buyer deposit until the sale completes (I-144) is more correct and is deferred.
- The Books tab says so.

## 8. Seeded whole-engine random test with coverage gates (I-189, I-191)

**Why it wins**

- **Rubric:** impact `rigor` (strong) · coherence: exercises picks 1 to 6 · offline: yes, seeded rng · buildable: M · safety: high, test-only · honesty: high, it backs the random-testing claim the script already narrates.
- It runs random interleaved histories across several sales, artists and installments, with the invariants checked after every step. That is how payments teams test state machines.
- The coverage gate proves the random runs actually reach the deadline, cancel, duplicate and insolvency paths.

**Backend**

Test-only. The deterministic `rng` is today a non-exported function inside `src/lib/escrow/invariants.test.ts:15`. This pick extracts it to a small shared test helper, `src/lib/escrow/testing/rng.ts`, that both files import. There is no new dependency.

A command list, each command picked by the rng:

- `createSale`
- `receivePayment`: even, uneven, ACH or card, and a duplicate `rampTransactionId`
- `cancelSale`
- `advanceClock` plus `releaseDueHolds`
- `attemptTrustMove`
- `declareInsolvency`

These run against the engine with a deterministic `Clock`.

**API** None.

**UI** None.

**Demo beat**

Repo rigor, no beat. The 2:00 to 2:20 narration ("three hundred random sales on every commit") can become "thousands of random histories".

**Tests**

New `src/lib/escrow/model.test.ts`. After every step it checks:

- `reconcile()` has no breaks, including the journal and completeness checks
- no trust account is negative
- every hold is `locked`, `paid` or `refunded`, and `paid` and `refunded` never change again
- the sum over artists of paid plus locked equals the artist shares received
- an illegal command throws `EscrowError` and leaves the snapshot deep-equal

The coverage gate fails the suite if any of these never fired:

- paid on completion
- paid on deadline
- paid on insolvency
- refunded on cancel
- gallery-covered refund
- duplicate ignored
- trust move refused
- overpayment refused

A failure prints its seed and command trace for replay.

**Invariants**

- Test-only, so production behaviour, the demo and the pinned numbers can't change.

**Effort** About 1.5 hours.

**Risk**

- Low.
- It may surface real bugs in picks 2 to 6 late in the day. That is the reason to run it, and the reason it is last: the rest of the work isn't blocked on it.
- If picks 4 or 6 were cut, their commands and coverage gates are dropped with them.

## Considered and rejected

- **I-097 (with and without Rescrow):** it computes an artist's commingled recovery from an assumed rate. The hook already makes this point with real reported figures, and an invented recovery for Lowline is easy to overstate.
- **I-094 (audit event model):** pick 1's `trust_move_refused` activity row already records the refused attempt with its actor, amount and reason. A separate `AuditEvent` list with before and after cents is a second log to keep in step for no new beat.
- **I-202 (hold aging ladder):** left out of pick 4 to keep it at 2 hours. The phone's lock-to-deadline bars show the same thing for the story artist. It is the natural first addition to pick 7's Books tab.
- **I-039 (artist-first allocation):** under it, payment 1 would fill trust first. That changes both the "half goes to trust" narration and the $8,000 / $49,836.27 split at `B`.
- **I-061 (good-funds gate):** payment 2 in the story is ACH (`METHODS` in `story.ts`). An ACH settling window would hold that share and break the same-day $12,000 payout at completion.
- **I-008, I-030 and I-031 (top-ups and buffers into trust):** each moves operating cash into trust before `B`, which changes the creditors' $49,836.27.
- **I-026 (timelocked refunds):** turns the instant `C` refund into a pending one. That changes the optional beat and its caption for a control the demo can't show in 3 minutes.
- **I-105 (chapter 11 mode):** changes the insolvency route the recording uses. The chapter 7 behaviour is the story.
- **I-017 (no-offset refusal):** Theo's agreement allows framing up to $400 to be "deducted from the Artist's share before payment". A refused offset on camera would look like Rescrow ignoring a valid clause. The right model is the clause-gated deduction at split time (I-131).
- **I-131 (clause-gated deductions):** a strong runner-up. It adds a third term to every split and must be threaded through rounding, cancel and statements, which is over budget after pick 2.
- **I-007 (three-way reconciliation):** with the feed simulated, the bank leg would be generated from the same events as the ledger, so the check would be partly circular until real Ramp balances exist. Pick 7's tie-out covers the books-against-sub-ledger leg honestly.
- **I-175, I-176 and I-177 (signed checkpoints and inclusion proofs):** routes use `systemClock` with `randomUUID` ids, so "byte-identical after reset" would be false without deterministic ids. A meaningful version needs two or three M ideas together.
- **I-015 (hash-chained activity log):** whoever controls the JSON file can recompute every hash. Without the checkpoint work it proves little, and the tamper-evidence note says as much.
- **I-188 (golden snapshot hash per beat):** blocked by the same non-deterministic ids and timestamps in route handlers.
- **I-153 (sales tax kept out of the split):** adds a reconcile term and a third bucket to every payment. The full version, with tax in cancel and insolvency, is L.
- **I-073 (payout intent and attempts):** L, and it touches the payout path the demo depends on.
- **I-089 (suspense bucket):** adds a reconcile term for unmatched deposits that the scripted demo never produces. It is the natural follow-on to pick 6.
- **I-024 (artist countersign):** adds an approval step to the agreement beat, or seeded approvals that nobody sees.
- **I-204 (insolvency Sankey):** a new visual on the climax screen, at medium risk, for a point the `TrustProof` strip already makes in one line.
- **I-101 (priority waterfall):** needs an invented claims register for Lowline. That is illustrative data on the most-watched screen.
- **I-212 (seeded simulator in `/lab`):** pick 8 delivers the same property in CI, without a UI to maintain.
- **I-159, I-171 and I-193 (resale royalty hold, per-currency conversion account, TLA+ spec):** each is L and over the per-pick budget.
- **I-149 (period close and lock):** needs pick 7 plus a sync status model first. It is a good next step after this round, not inside it.
