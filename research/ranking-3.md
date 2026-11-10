# What Rescrow builds next, round three

Rounds one and two ([`ranking.md`](ranking.md), [`ranking-2.md`](ranking-2.md)) were mostly rigor: the journal and its account rules, refund records, sub-ledger and seal checks, the demo clock, the Books view with deposits, close, the deadline ladder and chart mapping, and the seeded whole-engine random test. That rigor is in the repo, but a judge watching 2:30 of video sees little of it. This round picks six more from [`ideas.md`](ideas.md), in build order. Most of them put the existing proof on screen.

**Rubric.** Every pick was scored on seven tests. Each pick's **Why it wins** field scores all seven, in this order:

1. **What a judge sees.** Does it make the recorded 2:30 or the live final more striking or more convincing to a Ramp engineer: the insolvency climax, the money flow, the artist's side, a moment of proof? A rigor-only pick needs a strong reason.
2. **No new `/present` key or button.** A pick may change what the existing `/present` screens show at existing steps, or add to `/books`, `/gallery`, `/lab` and the artist portal.
3. **Full-stack coherence.** It names its backend, API, UI surface and tests, and reuses the journal, the books, the refund records, the demo clock and the artist timeline rather than building beside them.
4. **Offline and deterministic.** No network and no external services at runtime. The same inputs always give the same outputs, in the app and in CI, whatever the calendar date.
5. **Buildable.** One engineer can build it, with tests, in 1 to 2.5 hours.
6. **Safety.** Reconcile and the journal stay balanced, and `releaseTrust` / `postTrustRelease` stay the only exit from trust. The numbers pinned in `src/app/api/demo-flow.test.ts` don't move: $49,836.27 to creditors, $8,000 to Ines and $2,400 to Theo after insolvency, and $12,000 to Ines at completion.
7. **Honesty.** No claim the code can't back. Figures from real cases are labelled as reported, anything illustrative is labelled illustrative, and nothing on screen is legal advice or decides anyone's legal rights.

**One product, not a pile.** Rounds one and two proved the money. Round three shows it:

- **Pick 1** puts the counterfactual on the climax screen: what the same failure looks like without a separate trust account.
- **Pick 2** gives the failure its two other audiences. The administrator's statement goes on `/books`, and each artist's portal shows what reached that artist and what came back.
- **Pick 3** makes `/lab` the place a sceptical engineer checks the claims: the cents on a seeded work, and every planted corruption the checker catches, with its exact words.
- **Picks 4 to 6**, if time remains: every balance opens into the records that sum to it, one card maps real gallery failures to the rule and test that would have stopped each, and pick 3's catalogue is upgraded so a judge can break their own live state on a copy.

**Hours and cut line.** The plan is picks 1 to 3, about 5.25 hours. Every pick in it is a single read-only change with no architecture-test exemption.

| Picks   | Hours | Status                                                                    |
| ------- | ----- | ------------------------------------------------------------------------- |
| 1       | 1.5   | The plan. The only pick that changes `/present`, so it goes first (below) |
| 2       | 2.0   | The plan. Shown in the live final, not in the 2:30 recording              |
| 3       | 1.75  | The plan. Shown in the live final                                         |
| Plan    | 5.25  | 1.5 + 2.0 + 1.75                                                          |
| 4, 5, 6 | 4.75  | Only if time remains (1.75 + 1.0 + 2.0)                                   |

Every pick leaves the main branch green and the demo script working on its own, so the build can stop after any of them.

**Why this order.** The video is recorded tonight, and the live final is in nine days.

- Pick 1 is the only pick that changes what the recorded take shows, so it is built first. If it is green before recording, the insolvency take (a separate 20-second take) is re-recorded with it. If not, the existing take stays valid, because the narration doesn't depend on it, and the pick ships for the final.
- Pick 2 builds on pick 1's pure function and covers the artist's side of the climax, so it follows directly.
- Pick 3 is on `/lab`, which no recorded beat uses. That makes it the lowest-risk visible work, and both halves are static and certain.
- Pick 4 is the most interactive moment of proof, but it touches a component `/present` shares, so it waits until after the recording. Pick 5 is a static card. Pick 6 carries the one architecture-test exemption in this round, so it goes last.

**Shared shape changes.** These are listed once here:

- **No change to `Snapshot`, `src/types.ts`, `journal.ts`, `ACCOUNT_RULES`, the money-write manifest in `architecture.test.ts`, any architecture scan, or any route.** Every pick reads only. None adds a journal code, an account kind, an activity kind or an engine function that writes. `SEED_VERSION` stays where it is. Pick 6 is the only exception, and it says exactly what it changes in the scans.
- **New pure modules in `src/lib`:**
  - `src/lib/insolvency.ts` (picks 1 and 2)
  - `src/lib/rounding.ts` (pick 3)
  - `src/lib/escrow/plant-catalogue.json`, generated from the plant list in `reconcile.test.ts` (pick 3)
  - `src/lib/explain.ts` (pick 4)
  - `src/lib/cases.ts` (pick 5)
- **`src/components/TrustProof.tsx` is imported only by `src/app/present/page.tsx`.** Pick 1's change there reaches the recorded screen and nothing else.
- **`GalleryBalances` is used by `/present`, `/gallery` and `/demo`.** Pick 4 adds an optional prop that only `/gallery` passes, so the recorded screen and `/demo` render exactly as before.
- **Only pick 1 touches `docs/demo-script.md`,** with optional narration only. `demo-flow.test.ts` gains assertions and one new test in picks 1 and 2, and loses none.

## 1. Same failure, without Rescrow, on the insolvency ending (I-097, I-109)

**Why it wins**

- **Rubric:**
  - What a judge sees: `shown`, on the climax screen of the recording.
  - No new key: yes. It changes what step 7 (after `B`) shows.
  - Coherence: a pure function over the payouts `declareInsolvency` already records and the creditors' claim it already stores. It is cross-checked against the journal and read by `TrustProof` and by pick 2.
  - Offline: yes.
  - Buildable: M, low end.
  - Safety: high. It reads only, and the pinned numbers are asserted unchanged.
  - Honesty: high, by construction. It shows how much money is exposed, never a loss figure for Lowline (see below).
- Today the ending says "creditors took $49,836.27, every dollar in trust went to the artists". That is true, but it only describes what happened. A Ramp engineer's next question is "and without you?". The hook answers that with another gallery's reported numbers. This pick answers it with this gallery's own numbers.
- Round one rejected I-097 because it applied an assumed recovery rate to an invented gallery. This version applies no rate. It shows only what the records determine, and states the legal consequence in words.

**Backend**

New `src/lib/insolvency.ts`, pure functions only.

`insolvencyOutcome(s, galleryId)` returns `null` while the gallery is active. Once it is insolvent, it returns:

- `toCreditorsCents`: `gallery.claimedByCreditorsCents`, the figure the engine recorded.
- `toArtists`: one row per payout with `reason: "insolvency"`, with the artist, amount, payout id and `paidAt`. Payouts are made per sale, so an artist with two open sales at the failure has two rows. The screen groups them by artist.
- `worksReturned`: the gallery's artworks with status `returned`, which round two's insolvency change sets.
- `commingledCents`: `toCreditorsCents` plus the sum of `toArtists`. This is the single balance the administrator would have frozen if the artists' shares had sat in operating.
- `artistsShareOfCommingledCents`: the sum of `toArtists`.

What the counterfactual assumes, stated in the module's comment and in the footnote on screen:

- The same events in the same order, with the same payouts before the failure. Mara's completed sale, and any share already paid on its agreement deadline, were paid either way.
- Only the separate account is removed.

So the commingled balance is operating plus trust at the moment of failure. No rent, payroll or recovery rate is invented.

On the demo take this gives $60,236.27, of which $10,400.00 is the artists'. The tests compare it with the journal rather than pin a hand-typed constant.

The statute line (I-109) is a constant in the same module. It is labelled on screen as a summary, not a quotation, and carries its source URL (the nysenate.gov page `docs/demo-script.md` already cites):

- "NY Arts and Cultural Affairs Law §12.01 (summary): sale proceeds are trust funds for the artist, not subject to claims of the gallery's creditors."

The line says nothing about which law requires a separate account. `docs/demo-script.md` notes that §12.01 itself doesn't, and `research/domain-brief.md` traces the separation duty to EPTL 11-1.6. So the screen never presents the statute as requiring the account Rescrow keeps.

**What the screen may and may not say.** This is the honesty rule for the pick, and it comes from `research/domain-brief.md`:

- **May say:** without a separate account, the artists' $10,400.00 would be inside the $60,236.27 the administrator froze. Getting it back would take a tracing claim in court.
- **May not say:** that Ines would lose it, or get 8p in the pound. Nothing leaves operating before `B` in the take (`G` is refused), so under the lowest-intermediate-balance rule a court might let her trace every cent. And §12.01 would still give her a trust claim.
- **What the pick claims:** the brief's own point, that with Rescrow the trustee never faces a tracing fight.
- **Stephen Friedman's 8 to 9p:** a UK administration, in pounds, for unsecured creditors. It stays on the title card where it already is, labelled with its source. It is not repeated as Lowline's outcome.

**API**

- None.
- `POST /api/demo/insolvency` already returns the full `Snapshot` with the payouts and the claim this reads.

**UI**

- **`TrustProof.tsx`, inside the existing red insolvency banner, after the current sentence.** Two short lines, no new component and no chart:
  - "Without a separate trust account, all $60,236.27 would have been one balance in the administrator's hands, $10,400.00 of it the artists'. Getting that back would take a tracing claim in court."
  - The §12.01 summary line, in small text.
- **What stays the same.** The caption from `stepFor` and the phone are unchanged. The phone's 720px frame has no spare height, and its existing notice ("Your share was held in trust, so it was paid to you, not to creditors") already gives the artist's side. Pick 2 extends that side on the portal.
- **Layout.** Check by hand at 1440 x 900 and 125% zoom that the banner wraps to at most four lines and the activity list below it still shows.

**Demo beat**

Optional, about 6 seconds, added to the 1:45 to 2:05 insolvency take after "This time the artist gets paid":

> Without a separate account, all sixty thousand would be one balance in the administrator's hands, and Ines would need a court to get her eight thousand back.

`docs/demo-script.md` gains that line as optional, and the sources section notes it is computed from the same events. Re-record only the insolvency take, and only if the pick is green before recording.

The same edit offers one optional wording change for the hook, at 0:15 to 0:35. "If the gallery fails, it's gone" becomes "If the gallery fails, the artist has to fight the creditors for it." That matches what the ending now says. It is used only if that take is re-recorded anyway, and no number changes.

**Tests**

New `src/lib/insolvency.test.ts`:

- Returns `null` for an active gallery.
- On the story state after two payments and `declareInsolvency`:
  - `commingledCents` equals `toCreditorsCents` plus the insolvency payouts
  - `toCreditorsCents` is 4,983,627
  - Ines's insolvency payouts sum to 800,000 and Theo's to 240,000
  - every unsold consigned work is listed as returned
- **One row per payout.** A second Ines sale with a payment before `B` gives Ines two `toArtists` rows, and their sum is her trust balance before the failure.
- **The counterfactual agrees with the journal.** `commingledCents` comes from the gallery's recorded claim and the payout records. The second source is `balancesOf` over the journal entries that come before the `OPERATING_TO_CREDITORS` entry. The gallery's operating account plus its artists' trust accounts must equal `commingledCents`. Two different records must agree, so this check can fail.
- **A deadline payout, then insolvency.** `advanceClock` past Theo's seeded deadline, then `declareInsolvency`. Theo's $2,400 payout has reason `deadline`, so it is not in `toArtists`. `commingledCents` still equals the journal's operating plus trust before the creditors entry, because that money had already left trust.
  - The recording can't reach this state, because `B` is offered only at day 0.
  - A live store can, because the state route runs `releaseDueHolds` on every poll and Theo's seeded share falls due about four days after reset.
  - The figures come from the records in every state. The narrated ones assume a reset.
- The statute constant is labelled a summary and carries its URL.
- Calling it twice gives identical output.

`src/app/api/demo-flow.test.ts`, in "gallery goes under after payment two", adds assertions only:

- Operating plus trust are read from the snapshot the route returns just before `B`. After `B`, `insolvencyOutcome(s, "gal_lowline")!.commingledCents` must equal that captured sum. Nothing is hand-typed.
- The four pinned numbers stay asserted exactly as now.

`src/components/story.test.ts`'s step-7 assertions (`/This time the artist gets paid/`, `$8,000.00`, `index` 7) are unchanged, because the caption doesn't change.

**Invariants**

- It reads only. No money moves, and `reconcile()`, the journal and the pinned numbers can't change.
- `releaseTrust` and `postTrustRelease` are untouched.
- The page shows numbers computed in `src/lib`, per the contract rule. `TrustProof` doesn't add anything up itself.

**Effort** About 1.5 hours: the module, six unit tests, the demo-flow assertion, the banner lines, the script lines and a layout check.

**Risk**

- Low to medium. It is the only pick on the recorded screen.
- The risk is layout: the banner growing on camera. It is limited by keeping the change to two lines of text inside an existing element, and by the hand check above.
- `TrustProof` is used nowhere else, so no other page can regress.

## 2. Statement of affairs on the books, and each artist's side of it on the portal (I-102)

**Why it wins**

- **Rubric:**
  - What a judge sees: `shown`. The administrator's view on `/books`, and the artist's side of the climax on `/artist/[artistId]`, both in the live final.
  - No new key: yes.
  - Coherence: it reads:
    - pick 1's `insolvencyOutcome`
    - round two's buyer-deposit account 2020, and the 3900 "Turned over to administrator" line already in `CHART`
    - the payments with their bank ids, and the returned works
    - round two's artist timeline (`artistPayments` and its `how` field), and the existing per-payout statement pages
  - Offline: yes.
  - Buildable: M.
  - Safety: high. It reads only.
  - Honesty: high. It shows every dollar each open-sale buyer paid and where it went. It says plainly that Rescrow doesn't decide what an open-sale buyer is owed.
- After `B`, `/books` today shows a trial balance with 3900 in it, and nothing an administrator would recognise. The statement of affairs is the document an administrator actually produces. Rescrow's version has a column a commingling gallery can't produce: money and works that were never part of the estate, with the bank transaction behind each payout.
- The artist's side is the other half of the climax. The phone says "paid to you, not to creditors". The portal can show the whole record:
  - each share that reached the artist at the failure
  - the buyer payments that funded it, with their bank ids
  - the statement for that payout
  - the works that came back, and the works still under an open sale
- It shows the buyer's side as the records show it. On the demo take, the Orchard in Rain buyer paid two full installments, $16,000.00. $8,000.00 of that was the artist's share and went to Ines from trust at the failure. The other $8,000.00 was the gallery's part, which round two's deposit accounting holds in 2020, and it is inside the estate. What the buyer is owed for it is for the administrator to settle, and the card says so.

**Backend**

`src/lib/insolvency.ts` gains `statementOfAffairs(s, galleryId)`, which is `null` while the gallery is active. Pick 1's banner reads its headline numbers from the same module, so every screen comes from one function. Once the gallery is insolvent, the statement has four sections and a tie-out.

- **Outside the estate, paid from trust at the failure.** Pick 1's `toArtists` rows (payouts with reason `insolvency`). Each row has its payout id, and the share and payment ids that funded it, taken from `holdIds`, the holds' `paymentId`s and those payments' `rampTransactionId`.
  - Shares on open sales that were already paid on their deadline before the failure are not here. They appear in their sale's row below.
  - Payouts on sales that completed before the failure are outside the statement altogether.
- **Outside the estate, the works.** Pick 1's `worksReturned`, by artist.
- **The estate.**
  - Operating cash turned over to the administrator: `toCreditorsCents`.
  - Buyers' deposits: the gallery's part of each sale still `open` at failure, as held in 2020.
- **Open sales at failure.** One row per sale still `open`, which `declareInsolvency` leaves untouched. Each row shows:
  - the buyer and the work
  - the total the buyer paid (the sale's payments)
  - the artist's part, from the sale's holds, split in two by the reason recorded on the payout each hold went out in, found through the payout's `holdIds`:
    - **paid on its deadline, before the failure** (reason `deadline`, made by `releaseDueHolds` when the clock passed the agreement's deadline)
    - **paid from trust at the failure** (reason `insolvency`)
  - The split is by recorded reason, not by date. Deadline payouts are stamped at the share's `dueBy`, not at the moment the check ran, so a date cut against `insolventAt` would be the wrong test.
  - **the gallery's part, held as the buyer's deposit (2020)**
  - The row's identity is: paid = paid on deadline + paid at failure + deposit. There is no fourth case. A hold still locked at `B` is always paid at the failure, and a refunded hold belongs to a cancelled sale, never an open one.
  - the work's recorded state: status `sold` and the sale not completed. Rescrow doesn't record where the work is or decide who it belongs to, and the row says so. These works are in neither the returned list nor the estate's cash, so without this section the card would leave them out.
- **Tie-out, two ticks, each between two different records:**
  - Estate cash plus trust paid out at insolvency equals operating plus trust in `balancesOf` over the journal entries before the `OPERATING_TO_CREDITORS` entry. This is pick 1's cross-check, shown on screen. It holds after a deadline payout too, because that money left trust (`TRUST_TO_ARTIST`) before the creditors entry.
  - The sum of buyers' deposits equals the 2020 balance in `trialBalance(glLines(s, galleryId))`, round two's GL. A deadline payout posts `TRUST_TO_ARTIST`, which `glLines` books to 2010 and 1020 only, so it doesn't move 2020.

The "paid at failure" column, summed over the open sales, also equals the `toArtists` total. That follows from the engine. A sale that completes pays out all its holds at once and a cancelled sale refunds them, so every hold still locked at `B` sits on an open sale. A test pins this, not the screen, because it compares two views of the same payout records.

`artistAtFailure(s, artistId)` returns `null` unless one of the artist's galleries is insolvent. Otherwise it is that artist's slice of `statementOfAffairs`:

- the artist's insolvency payouts, each with its funding payments, their bank ids and the payout id, which links to the existing `/artist/[artistId]/statements/[payoutId]` page
- the artist's shares on open sales that were paid on their deadline before the failure
- the artist's returned works
- the artist's works under a sale still open at the failure

It is built by filtering the statement, not by recomputing. A test checks it against `artistPayments` from `src/lib/artist.ts`, a separate code path over the same records.

On the demo take, the open sales are:

| Sale                   | Buyer paid | Paid on deadline, before failure | Paid from trust at failure | Gallery's part, held as the buyer's deposit (2020) |
| ---------------------- | ---------- | -------------------------------- | -------------------------- | -------------------------------------------------- |
| Orchard in Rain (Ines) | $16,000.00 | $0.00                            | $8,000.00                  | $8,000.00                                          |
| Four Lamps (Theo)      | $4,000.00  | $0.00                            | $2,400.00                  | $1,600.00                                          |
| Total                  | $20,000.00 | $0.00                            | $10,400.00                 | $9,600.00                                          |

The deposits equal the $9,600.00 in 2020, and the at-failure column is pick 1's $10,400.00. The deadline column is zero on the take because `B` is pressed at day 0. In a live store where Theo's seeded deadline has passed before `B`, his $2,400.00 moves to the deadline column, the at-failure total drops to $8,000.00, and his buyer's deposit stays $1,600.00. The tests below pin that state.

**API**

None. `/books` and the artist portal build their views from the `Snapshot` in the browser, as they already do.

**UI**

- **`src/app/books/page.tsx`** gains a "Statement of affairs" card, shown only when the gallery is insolvent. It goes after the existing "Trial balance" and "Due to artists, by artist" cards, so the optional accountant beat still opens on what it narrates, whenever it is recorded.
  - Two columns: "Never the gallery's" (artists paid from trust at the failure, works returned) and "The estate" (cash to the administrator, buyers' deposits).
  - Below them, the open-sales table above, with its two trust columns. Every dollar an open-sale buyer paid appears once, including any share paid on its deadline before the failure, and the works under those sales are named.
  - A tie-out line with the two ticks above.
  - **Footnote:** "Buyers' deposits are the gallery's part of what the records show each buyer paid. Rescrow doesn't decide what an open-sale buyer is owed, whether that is the work or a refund of everything they paid, or what the administrator will pay. This is not legal advice."
- **`src/app/artist/[artistId]/page.tsx`**, which already uses `useSnapshot`, gains a card at the top titled "When {gallery} failed", shown only when `artistAtFailure` is not `null`:
  - "Your share of each buyer payment was held in trust, so it was paid to you, not to the gallery's creditors." Under it, each payout: amount, date, the buyer payments it came from with their bank ids, and a link to its statement.
  - Any share paid on its deadline before the failure, labelled as such.
  - "Returned to you": the returned works.
  - "Under a sale that hadn't completed": the work and its recorded status, with "Rescrow records this sale as open. It doesn't decide who the work belongs to."
  - If no share of the artist's was in trust at the failure, the card says so and lists only the works.
- The phone on `/present` is unchanged.

**Demo beat**

Optional, in the live final, about 12 seconds after `B`. On `/books`, scroll to the statement:

> This is the administrator's statement, from the same journal. The artists' money and the art were never in the estate. The buyer paid sixteen thousand: half went to Ines from trust, and the gallery's half sits in the estate, booked as the buyer's deposit.

Then open Ines's portal:

> And this is what Ines sees: eight thousand dollars, the two buyer payments it came from, and her other works coming home.

The narrated figures assume the store was reset before the take, as the demo script already requires.

**Tests**

In `src/lib/insolvency.test.ts`:

- `null` for an active gallery, from both functions.
- On the story state after two payments and `B`:
  - The open sales are the story sale and Four Lamps.
  - Paid is 1,600,000 and 400,000, paid on deadline is 0 and 0, paid at failure is 800,000 and 240,000, and deposits are 800,000 and 160,000.
  - Each row's paid equals its deadline part plus its at-failure part plus its deposit.
  - The at-failure column summed over open sales equals pick 1's `toArtists` total.
  - The deposits sum to the 2020 trial-balance line.
  - Estate cash plus trust paid out equals operating plus trust in `balancesOf` over the journal before the `OPERATING_TO_CREDITORS` entry.
  - Orchard in Rain and Four Lamps appear under open sales and not under returned works.
- **Every dollar a buyer paid is accounted for exactly once.** For each sale:
  - The identity: paid = refunded + paid to the artist + the gallery's part kept on a completed sale + the gallery's part held as an open-sale deposit.
  - "Refunded" means `fromTrustCents + fromOperatingCents` over the sale's refund records, which is the buyer's own money going back.
  - `coveredByGalleryCents` stays out of the identity. It is the gallery's own operating cash making the buyer whole after the artist was already paid, not money the buyer paid.
  - States checked, each followed by `B`:
    - The demo take.
    - Payment one, a 61-day `advanceClock`, then cancel the story sale. Orchard in Rain gives 400,000 refunded + 400,000 paid to Ines = 800,000 paid, and its refund also records 400,000 covered by the gallery, outside the identity.
    - Theo's deadline passes (5 days), then cancel Four Lamps. That gives 160,000 refunded + 240,000 paid to Theo = 400,000 paid.
    - The deadline-then-failure state below.
  - Tidewater, a completed sale, has no deposit. A sale cancelled before `B` has no deposit, because its deposit went back from 2020.
- **A deadline payout before the failure, engine level.** From `createSeed()`:
  - `applyTerms` with `FIXTURE_TERMS.agr_ines`, because Ines's seeded terms are `null` and `termsFor` throws without them.
  - The story sale and its first payment.
  - `advanceClock` past both Theo's 14-day and Ines's 60-day deadlines, then `declareInsolvency`.
  - The test asserts:
    - Four Lamps: paid 400,000, on deadline 240,000, at failure 0, deposit 160,000.
    - Orchard in Rain: paid 800,000, on deadline 400,000, at failure 0, deposit 400,000.
    - Each row's identity holds. The deposits equal the 2020 line, 560,000. The at-failure column still equals `toArtists`, here 0.
    - Neither deadline payout appears under "paid from trust at the failure".
- **The artist's slice.**
  - After the demo take's `B`, Ines's insolvency payouts sum to 800,000. They are funded by the two story payments, each with a `rampTransactionId`. Orchard in Rain is under an open sale and not returned. Theo's insolvency payouts sum to 240,000.
  - In every state above, each artist's at-failure total equals the sum of that artist's `artistPayments` rows with `how === "insolvency"` on open sales. Two code paths must agree.
  - In the deadline-then-failure state, Ines's 400,000 is listed as paid on her deadline and none at the failure.
  - An artist with no share in trust at the failure gets a card with works only.
- Each trust row's payment ids resolve to payments with `rampTransactionId`s. On the demo take, the seeded Lamps payment carries `rtx_seed_lamps_1`, so Theo's at-failure row has one too. After Theo's deadline payout, that payment appears in the deadline column instead.

In `src/app/api/demo-flow.test.ts`:

- "gallery goes under after payment two" adds one assertion: the buyers' deposits sum to 960,000.
- **A new test, "a deadline payout, then the gallery goes under, through the routes":**
  - It uses the same calls the existing tests use: `press(await call("/api/demo/reset"), 3)`, then `/api/demo/advance` with `{ days: 61 }`, then `POST /api/demo/insolvency` with `gal_lowline`.
  - `/present` doesn't offer `B` after the jump, but neither route checks for day 0, so a live store can reach this state.
  - It asserts the same four Lamps and Orchard figures as the engine test, and 2020 = 560,000, from `statementOfAffairs` over the snapshot the route returns. The books balance.
  - It sits beside the pinned tests and changes none of their numbers.

**Invariants**

- It reads only. The journal, `reconcile()` and the pinned numbers can't change.

**Effort** About 2 hours: 1.5 for the statement, its split columns and the deadline and identity tests, and 0.5 for `artistAtFailure`, the portal card and its tests.

**Risk**

- Low.
- The judgement calls are the labels. The gallery's part of an open sale is called "the buyer's deposit", which is how 2020 books it, never "the buyer's claim" or "what they will recover". Works under open sales are described only by their recorded status, never by who owns them. That keeps both cards inside what the code knows.
- The statement depends on demo state, not only on the take: a deadline payout before `B` changes which column a share is in. Splitting by the payout's recorded reason, and testing the deadline-then-failure state at engine and route level, keeps every state reported correctly.

## 3. Check it yourself on `/lab`: the cents on a seeded work, and every planted break (I-209, I-211)

**Why it wins**

- **Rubric:**
  - What a judge sees: `shown`, two moments of proof on `/lab` for the live final.
  - No new key: yes. `/lab` is not `/present`.
  - Coherence:
    - The rounding table uses `shareOf` from `src/lib/money.ts`, the installment rule from `nextInstallment`, a seeded work and its real agreement split, and a test ties it to the engine.
    - The catalogue is generated by the same planted-break test CI already runs against the real `reconcile()`, with round two's sub-ledger and seal checks.
  - Offline: yes. Both halves are deterministic. The catalogue is built from a fixed test state and a fixed clock.
  - Buildable: M.
  - Safety: high. It reads only. No file under the architecture scans gains a money write, and no scan changes.
  - Honesty: high. It shows where the naive method drifts and admits where it doesn't. The catalogue says it was run on the test state.
- **The cents.** The recorded 2:00 to 2:20 cut claims "three payments of a third always add up to exactly the artist's share, to the cent". On the demo sale ($24,000 in three at 50%) the naive method happens to give the same answer, so nothing on screen shows the claim matters. The seed already has a work where it does. Salt Study No. 4 (`wrk_salt`, $9,500.00, Mara's agreement at 50%) sold in three installments uses the engine's own schedule of $3,166.67, $3,166.67 and $3,166.66:
  - rounding each payment's share gives $1,583.34 + $1,583.34 + $1,583.33 = $4,750.01
  - the running total gives $1,583.34 + $1,583.33 + $1,583.33 = $4,750.00, which is exactly `shareOf` of the price
  - The naive version pays the artist one cent the agreement doesn't give them, and that cent comes out of the gallery's part. In six installments it drifts by two cents.
  - The seeded work and its split are real. The sale is not: no one buys Salt Study No. 4 in the demo, so the table is labelled "if this work sold in three installments".
- **The breaks.** "Books balance to the cent ✓" is only convincing if a judge can see it fail. The 24 corruptions that prove it exist today only inside `reconcile.test.ts`, which no judge sees. One of them is the break no total catches: one cent moved between two of Ines's shares. Round two's per-payment check names it.

**Backend**

New `src/lib/rounding.ts`, `roundingTable(priceCents, installments, bps)`:

- The installment amounts use the rule in `nextInstallment`: the remaining balance divided by the remaining count, rounded up.
- Per row: the amount, the running-total share (the formula `artistShareOfPayment` uses) and the naive share, `shareOf(amount, bps)`.
- Totals for both columns, the exact `shareOf(price, bps)`, and the first row where the two columns' running sums differ.
- Inputs are validated: integer cents, price at least the installment count, 1 to 24 installments, bps 0 to 10,000.

It doesn't change the engine. A test ties the two together.

**The planted-break catalogue.** `PLANTS` stays in `src/lib/escrow/reconcile.test.ts`, unchanged, so `architecture.test.ts`'s scans, which skip `*.test.ts`, see nothing new. A new test in that file builds `[{ name, breaks }]`: each plant applied to `structuredClone(healthy())`, with the file's existing fixed clock (`2026-11-10T15:00:00.000Z`), then `reconcile()` run on the result. It compares the list with the committed `src/lib/escrow/plant-catalogue.json` using Vitest's `toMatchFileSnapshot`.

- A plant that changes, or reconcile wording that changes, fails CI until the file is regenerated with `vitest run -u`.
- The output is the same on every run. The test clock gives the time as a constant and ids from a counter (`${prefix}_p${n}`), and each plant starts from a fresh `healthy()`, so the record ids inside the checker's text are stable.
- The JSON is data. The scans read only `.ts` and `.tsx`, so it adds nothing to them.
- `resolveJsonModule` is already on in `tsconfig.json`, so `/lab` imports the file directly.

**API**

None.

**UI**

`src/app/lab/page.tsx` gains two sections.

- **"Check the cents"**:
  - three inputs, prefilled with Salt Study No. 4: $9,500.00, 3 installments, 5,000 bps, labelled with the work and Mara's agreement
  - a second preset, labelled illustrative: $24,000.01 in 7 installments at 4,750 bps, which drifts by one cent at row 2
  - the table, with the first drifting row highlighted
  - one line under it: "Rescrow uses the running total. On the demo sale both give $12,000.00. Here they don't."
- **"Ways to cheat, and what the checker said"**: one row per catalogue entry, with the corruption's name, and each break in red exactly as `reconcile()` wrote it. A fixed label reads: "Each one was planted on a copy of the test state in CI, and the checker's words are shown unedited."

**Demo beat**

None in the recording. In the live final, about 15 seconds, on `/lab` after the code cut:

> Same gallery, another painting, three payments. Round each one and the artist gets a cent the contract doesn't give them. Rescrow doesn't. And here's every way we tried to cheat the books, including moving one cent between two of Ines's shares. Every total still matches, and the checker still names the payment.

**Tests**

New `src/lib/rounding.test.ts`:

- **Golden rows.**
  - Salt Study No. 4 ($9,500.00 / 3 / 5,000) gives a running total of 475,000 and a naive total of 475,001, first differing at row 2.
  - The illustrative $24,000.01 / 7 / 4,750 example gives 1,140,000 and 1,140,001.
  - The demo sale gives 1,200,000 both ways.
- **Same as the engine, with nothing patched.** From `createSeed()`, `createSale` on `wrk_salt` with 3 installments takes Mara's 50% from her agreement's terms. Three `receivePayment` calls with the default amounts create holds equal, row by row, to the table's running-total column.
- **Property, against the engine.** For seeded random (price, installments, bps), the same comparison runs on `wrk_orchard`:
  - `applyTerms` with `FIXTURE_TERMS.agr_ines` comes first, because Ines's seeded terms are `null` and `termsFor` throws without them.
  - Its price is patched on the clone, and `sale.artistShareBps` is patched on the snapshot `createSale` returns, before the first `receivePayment`.
  - Applying terms with a random bps would add an agreement-verification path the table doesn't need.
- **Property, pure.** For any valid input, the running total equals `shareOf(price, bps)` exactly, and the installments sum to the price.
- Invalid inputs throw with a message.

In `src/lib/escrow/reconcile.test.ts`:

- **The catalogue file matches the plants.** This is the `toMatchFileSnapshot` test above.
- **Every entry has a non-empty list of breaks**, and the cent-moved-between-shares entry names a payment. The existing `it.each` already asserts each plant's regex, so the file and the assertions come from one run.

A render test checks that `/lab` shows one row per catalogue entry.

**Invariants**

- It reads only. The engine, its rounding and `reconcile()` are unchanged, and the tests fail if they ever disagree with what `/lab` shows.
- The money-write manifest and every architecture scan are unchanged.

**Effort** About 1.75 hours: 1 for the rounding module, its engine tie-in (with the terms setup) and its section, and 0.75 for the catalogue test, the JSON and its section.

**Risk**

- Low.
- If the installment rule ever changes in `nextInstallment`, the "same as the engine" test fails, rather than the table quietly showing a different schedule.
- If the seed's price or split for `wrk_salt` changes, the golden test fails and the prefill is updated with it.
- The catalogue can't go stale silently: CI fails until it is regenerated. It shows the test state, not the judge's live state. Pick 6 upgrades it to live, and is deliberately kept out of the plan.

## 4. Click any balance to see the records that sum to it (I-207)

**Why it wins**

- **Rubric:**
  - What a judge sees: `both`, on `/gallery` and `/books`, a moment of proof for questions in the live final.
  - No new key: yes. `/present` doesn't get it (below).
  - Coherence: it explains the same figures `reconcile()` and `galleryTotals` compute, from payments, payouts, refund records and the journal.
  - Offline: yes.
  - Buildable: M.
  - Safety: high. It reads only.
  - Honesty: high. A test asserts every drawer sums to the figure it explains.
- A judge's natural question in the final is "where does $49,836.27 come from?". Today the answer is a scroll through the journal.
- With this pick, clicking operating on `/gallery` opens its records. They sum to the figure on screen, and a test says so:
  - the opening balance, $31,236.27
  - Tidewater's gallery part, $9,000.00
  - Four Lamps' $1,600.00
  - the two $4,000.00 halves of the story payments, each with its bank transaction id

**Backend**

New `src/lib/explain.ts`, `explain(s, galleryId, metric)`:

- `metric` is one of `operating`, `trust`, `paidToArtists`, `refunded`, `creditors` or `received`.
- It returns rows of `{ label, cents, at, ref }`, where `ref` is a payment, payout, refund or journal entry id. Rows are built from the journal entries that touch the metric's account, labelled from the records they reference.
- The `creditors` account has a single entry (`OPERATING_TO_CREDITORS`), so its drawer is defined differently. It is the operating drawer built from every journal entry before the `OPERATING_TO_CREDITORS` entry, in journal order.
  - The cut is by position, not by date. Under the routes' clock the creditors entry and the insolvency payouts are stamped a moment apart, and under a fixed test clock they share one timestamp, so a date cut would depend on the clock.
  - Including the transfer itself would zero the drawer.
  - The journal is append-only, so the position is stable. The rows are what the creditors actually took.
- `trust` is grouped by artist, then by share.

**API**

None.

**UI**

- **`GalleryBalances`** gains an optional `onExplain(metric)` prop. Only `/gallery` passes it, and it opens a side drawer. `/present` and `/demo` don't pass it, so the recorded screen renders exactly as now, and no figure there becomes a button.
- **`/books`.** The trial-balance rows for 1010, 1020 and 3900 open the same drawer.
- **Drawer.** Its footer shows "Sums to $X ✓", computed from the rows.

**Demo beat**

None in the recording. In the live final, about 10 seconds, on `/gallery` after payment two: click "operating" and read the opening balance, each gallery part and each bank id. After `B`, "creditors" opens the same rows, as of the moment of failure.

**Tests**

New `src/lib/explain.test.ts`:

- **The drawer sums to the figure.** At every state of the demo history (reset, each `→`, `G`, `D`, `T`, `C`, `B`), each metric's rows sum to the figure the screen shows for it: `reconcile()`'s field or `galleryTotals`.
- **The creditors drawer after `B`** sums to 4,983,627 and contains no `OPERATING_TO_CREDITORS` or insolvency-payout entry. This is run once with a fixed clock and once with the routes' clock, so the position cut is shown not to depend on timestamps.
- Every `ref` resolves to a record in the snapshot.
- The operating drawer after two payments lists both story payments' `rampTransactionId`s.

A render test checks that `GalleryBalances` without `onExplain`, as `/present` and `/demo` use it, has no clickable figure.

**Invariants**

- It reads only.

**Effort** About 1.75 hours.

**Risk**

- Low to medium. It touches a component `/present` uses. The optional prop and the render test above keep the recorded screen unchanged.
- It is a stretch pick, so it is built after the recording.

## 5. Real failures, the rule that stops each, and what Rescrow doesn't prove (I-213, I-185)

**Why it wins**

- **Rubric:**
  - What a judge sees: `shown`, one card on `/gallery` for the live final.
  - No new key: yes.
  - Coherence: each row names the engine function and the test that enforces it, and a test fails if a named test doesn't exist.
  - Offline: yes. The card is a fixture in the repo.
  - Buildable: S, about 1 hour.
  - Safety: high. It reads nothing at runtime.
  - Honesty: high. Allegations are marked as allegations, reported figures as reported, and out-of-scope failures as out of scope.
- The hook opens on one real failure, and the research behind the product covers several. A judge asking "why these rules?" gets one card that ties each rule to the case it comes from, with the test that enforces it.
- The other half of the card (I-185) states the limits, which a sceptical engineer respects. For example:
  - the bank feed is simulated, so Rescrow proves the books against themselves, not against a bank
  - the month-end seal catches edits, not someone who rewrites the whole file
  - nothing proves a sale that was never recorded

**Backend**

New `src/lib/cases.ts`, with two constant tables.

`CASES` has one row per real case from `research/notes/gallery-collapses.md`, `research/notes/bankruptcy-priority.md` and `research/domain-brief.md`. Each row has:

- the case name and year
- what was reported or alleged, worded as the source words it
- the source link
- the Rescrow rule that addresses it
- the function and test file, plus test title, that enforce it

The rows:

| Case                   | Wording                | What it maps to                                                                                                                                            |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stephen Friedman       | reported filings       | trust paid to the artists at insolvency                                                                                                                    |
| Cadence Comic Art      | alleged, settled       | commingling refused at posting time                                                                                                                        |
| The Hole               | alleged                | one artist's money can't pay another: the journal's per-artist trust accounts, and round two's check that a payout is made only of its own artist's shares |
| Philbrick and Salander | as charged or reported | a work already under contract can't be sold again: `createSale`'s "not available for sale". Fractional ownership is labelled not built                     |
| Berry-Hill             | reported               | creditors were repaid ahead of consignors: unsold consigned works go back to their artists at insolvency, and proceeds leave only through trust            |
| Knoedler               | reported               | out of scope: forgery, not money                                                                                                                           |

`LIMITS` lists what Rescrow proves and what it doesn't. Each line names its test or says "not tested: by design".

**API**

None.

**UI**

`/gallery` gains a card at the bottom, "Why these rules", with two parts:

- the case table with source links
- "What this proves / what it doesn't"

Each test reference is shown as `file › test title` in a monospace face.

**Demo beat**

None in the recording. In the live final, as a backup answer to "why should a gallery trust this?".

**Tests**

New `src/lib/cases.test.ts`:

- **Every named test exists.** For every row in both tables, the named test file exists and contains an `it(` or `test(` with that exact title, read with `node:fs`. A renamed test fails the build instead of leaving the card pointing at nothing.
- **Planted breaks are cited by name.** A row that cites a planted break doesn't cite the `it.each` title template ("catches: %s"). It cites the plant by name, and the test checks that the name is in pick 3's `plant-catalogue.json`, which is plain data and needs no test-file import. If pick 3 hasn't shipped, such a row cites the file and the template instead.
- Every case row has a source URL and a wording flag, one of `reported`, `alleged` or `out_of_scope`.

**Invariants**

- It reads nothing at runtime and moves no money.

**Effort** About 1 hour.

**Risk**

- Low.
- The risk is wording, so every row carries the same flag the domain brief uses, and the card never says what a court would rule.

## 6. Break your own live books, on a copy in your browser (I-211)

**Why it wins**

- **Rubric:**
  - What a judge sees: `both`. It is the strongest interactive moment for the live final: a judge picks a cheat and watches their own current state go red.
  - No new key: yes.
  - Coherence: it runs the real plants and the real `reconcile()` on the live `Snapshot`, and replaces pick 3's static catalogue section with a live one.
  - Offline: yes. Deterministic, because the clock is injected (below).
  - Buildable: M, about 2 hours.
  - Safety: medium-high. It never writes the store, but it needs one named exemption in the architecture scans, so it goes last.
  - Honesty: high. Each break shown is the checker's own text.
- Pick 3 shows the catalogue on the test state. This pick answers "fine, but on my state?". The idea list's version of I-211, a demo route that edits the store, is rejected for safety. It would be a money write outside the engine and outside `clockFor`, and it leaves the demo red if reset is forgotten. This version never leaves the browser.

**Backend**

`PLANTS` moves from `reconcile.test.ts` into new `src/lib/escrow/plants.ts`. `breakOnCopy` lives in the same file. Each plant becomes:

```ts
{ id, name, when(s): string | null, plant(s, clock: Clock), expect(s): RegExp }
```

- **`when`** returns `null` if the plant applies to this snapshot, or a short reason if it doesn't, for example "needs two of one artist's shares in trust". The refund plants call `cancelSale`, which refuses once the gallery is insolvent, so their `when` says so after `B`.
- **Targets and expected text come from the state.** Today's plants hardcode `healthy()`'s records: `po_tidewater` at $9,000.01, a regex naming "$4,000.01", Ines's two holds by position. Each plant instead finds its record by kind, and `expect(s)` builds its regex from that record's actual amount.
- **The clock is injected, never read.** `breakOnCopy(s, galleryId, plantId, clock)` passes `clock` to the plant.
  - `cancelSale` runs `releaseDueHolds(input, clock)` first. Without injection, a plant built on `Date.now()` would pay Theo's seeded share (due Nov 13) on the copy once the calendar passed that date, and the result would change with the date.
  - The page passes `clockFor(snapshot)`, the same demo clock the routes use for that state.
  - Every test passes a fixed clock.
- `breakOnCopy` returns `{ before, after }`. It applies the plant to a `structuredClone`, runs `reconcile()` on both, never mutates its input, and catches any throw from a plant and returns it as a result instead.
- **The one exemption, stated fully.** `writes()` in `architecture.test.ts` scans every non-test `.ts`/`.tsx` file, and the plants write money and hold fields by design. So `writes()` skips the one exact path `lib/escrow/plants.ts`, with a comment saying why: it writes only to the clone `breakOnCopy` makes. Three tests are fed by `writes()`, and all three stop seeing that file:
  - "matches the reviewed manifest exactly"
  - "no page, component or route writes money directly"
  - "hold status changes happen in transition() and nowhere else", which would otherwise see the plants' `status = "paid"` and `status = "locked"` writes
  - `files()` is unchanged, so the journal-import check (no `post` or `postTrustRelease`), the `createSeed()` scan and the `transition()`-caller scan still cover `plants.ts`.
  - The replacement for the three silenced tests is a new import guard: the only non-test importer of `plants.ts` is `src/app/lab/page.tsx`. No route, engine file or store file may import it, so the catalogue can never be wired to `data/db.json`.
  - Listing the plant lines in `MANIFEST` instead was considered and rejected. They are arrow functions in an array, so they would all be keyed "(top level)", which is brittle and dilutes a list meant to be short.

Pick 3's catalogue test then imports `PLANTS` from `plants.ts` and keeps regenerating the same JSON, so pick 5's name check is unaffected.

**API**

None, deliberately. There is no route, so nothing can reach `data/db.json`.

**UI**

`/lab` has no snapshot today. It holds local state and the agent stream only. So the page adds `useSnapshot`, which starts the same `/api/state` polling `/books` and `/gallery` already do. Pick 3's catalogue rows become buttons:

- Each button runs against the latest snapshot. A plant whose `when` gives a reason is disabled, with the reason shown.
- The result shows `before` (green, "Books balance to the cent") beside `after`, with each break in red exactly as `reconcile()` wrote it.
- A fixed label: "Applied to a copy in your browser. The gallery's books are unchanged." The live badge stays green under it to prove it.

**Demo beat**

None in the recording. In the live final, about 10 seconds, on `/lab`:

> Pick any way to cheat, on the books as they are right now. Move one cent between two of Ines's shares: every total still matches, and reconcile still names the payment.

**Tests**

- `reconcile.test.ts` imports `PLANTS` from `plants.ts`. Its `it.each` runs as before against `healthy()` with the fixed clock, so no coverage is lost.
- New `src/lib/escrow/plants.test.ts`, every call with a fixed clock:
  - **Each plant against demo states.** Every plant is tried on the states of the demo history: reset, each `→`, after `G`, `D`, `T`, `C` and `B`. Wherever `when` gives `null`, the copy shows `expect(s)` and the input is deep-equal to before.
  - **Every plant is reachable.** Each one applies in at least one of those states.
  - **Refund plants after `B`.** Their `when` gives a reason.
  - **Clock independence.** The refund plants run on the reset state with two fixed clocks, one before and one after Theo's seeded deadline. Each result matches the state the clock implies, so nothing depends on the calendar.
- `architecture.test.ts`:
  - **Import guard,** as above.
  - **The exemption stays narrow.** It covers exactly one path, and only in `writes()`. A new write anywhere else still fails all three tests, and a `post` import in `plants.ts` still fails the journal-import check.

**Invariants**

- Nothing is written. The store, the journal and the pinned numbers can't change.
- The manifest's entries don't change. The only change is the one named file exemption in `writes()`, backed by the import guard.

**Effort** About 2 hours, mostly making the 24 plants state-aware: computed targets and regexes, `when` reasons, and the injected clock. The rest is the move, the exemption and import guard, `useSnapshot` on `/lab`, `breakOnCopy` and the tests.

**Risk**

- Medium. This is the only pick in the round that loosens an architecture scan, which is why it is a stretch pick and not the plan.
- A plant that throws on an unexpected state would crash the section, so the demo-state test runs every plant in every state, and `breakOnCopy` catches and shows any throw.
- If it isn't finished, pick 3's static catalogue stays as it is. Nothing else depends on this pick.

## Considered and rejected

- **I-098 (Stephen Friedman waterfall with reported figures):** it puts another gallery's figures, in pounds, beside Lowline's computed ones on the climax screen. The hook already cites them in words, and pick 1 deliberately keeps them apart.
- **I-100 (lowest intermediate balance tracer):** in the take nothing leaves operating before `B`, so the tracer would show that Ines could trace every cent. Showing a loss would need invented rent and payroll debits. Pick 1 names the tracing fight instead of staging one.
- **I-101 (US priority waterfall):** it needs an invented claims register for Lowline on the most-watched screen. Round one's reason stands. Pick 2 lists only what the records show.
- **I-204 (insolvency Sankey):** a new chart on the climax screen, at medium risk, in the hours before recording. Pick 1 adds the one number the Sankey would show (what commingling would have exposed) as two lines of text.
- **I-205 (trace a dollar through one sale):** the artist portal already shows each buyer payment, its bank id and the share it funded (round two's I-125 and I-128). Pick 2 adds the failure to that trail, and pick 4 gives the gallery the same trail.
- **I-115 (ownership cap):** `createSale` already refuses a work that isn't `consigned` ("is not available for sale"), so selling a whole work twice is blocked. Fractional ownership isn't in the product.
- **I-116 (double-sell button):** it needs a new `/present` key, which this round rules out. A `/gallery` control would only show a refusal the engine already has. Pick 5 names it instead.
- **I-131 (clause-gated deductions):** Theo is the only artist with a deduction clause, and his seeded $2,400 hold is a pinned number. It would also change `artistShareOfPayment`, the function the recorded code cut shows. Next round, after the final.
- **I-007 (three-way reconciliation):** the feed is still simulated, so the bank leg would be generated from the same events as the ledger. Pick 5 states this limit on screen instead.
- **I-089 (suspense bucket):** no route ingests from the feed (`ingest()` in `src/lib/feed/ramp.ts` is test-only), so no screen can produce unapplied cash. It needs a new account kind and a reconcile term.
- **I-103 (preference-exposure badge):** classifying payouts under §547 windows is close to legal advice on screen, and it only has meaning in a commingled replay that would need invented payment dates.
- **I-104 (commingling clock):** every hold is locked in the same operation as its payment, so the number is 0 seconds by construction. A judge would rightly read it as a tautology.
- **I-120 (artwork reconciliation):** a sound second check, but it adds breaks to `reconcile()`, which runs on camera in `TrustProof`, in the hours before recording. Pick 2 already lists every work at failure, returned or under an open sale. Next round.
- **I-129 (concentration exposure panel):** it shows who a failure would hurt most, but with trust in place no artist is hurt. Pick 2's artist card shows the protection directly.
- **I-212 (seeded simulator in `/lab`):** the model test already proves the property in CI. Pick 3 shows judges the catalogue for far less code.
- **I-208 (time scrubber):** a new interaction on the climax screen, at medium risk.
- **I-178 (rewrite-history button):** it needs signed checkpoints and consistency proofs first (I-175, I-177), which round one rejected for non-deterministic ids.
- **I-138 (artist float calculator):** its inputs are illustrative industry averages, which is weak beside picks that use the gallery's own records.
- **I-210 (invariant counter):** `reconcile()` runs in the browser on every render, so a counter would count renders, not checks of the books.
- **I-206 (live T-accounts):** `/books` already lists each journal entry with its postings, and the phone layout has no room on `/present`.
- **I-184 (insolvency proof packet):** it rests on the inclusion and consistency proofs rejected above. Pick 2 gives the administrator the same list from the journal, with bank ids.
- **I-174 (insolvency in three currencies):** it changes the climax screen and needs FX work (I-130) first.
