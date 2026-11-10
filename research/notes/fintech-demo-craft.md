# Fintech demo craft: what lands with engineering judges

## What we learned

- No published list of Ramp hackathon winners turned up. The closest Ramp event found is Builders Cup 2026, a one-day NYC student hackathon with career-fair-style demo stations, a crowd vote, and a track called "Save Time. Save Money." That track name is a fair read on what Ramp wants to see. ([Ramp Builders Cup 2026](https://luma.com/nrletiv9))
- Judges spot mocked core features, and it costs points. The advice is to mock only peripheral pieces such as data feeds, which is exactly where our fake Ramp feed sits. ([Browser Use](https://browser-use.com/posts/how-to-win-hackathons))
- In a few minutes judges can't see technical depth directly, but they do respond to a polished UI. So depth has to be made visible on screen, not just described. ([Browser Use](https://browser-use.com/posts/how-to-win-hackathons))
- A common 3-minute shape: a 20-second hook with one striking number, a 20-second solution, then the live demo from about 0:40 to 2:30. The same guide says to show error handling, keep a recorded backup, and stop on time. ([Reskilll](https://blogs.reskilll.com/hackathon-demo-presentation-tips-pitch-3-minutes-win-2026/))
- Stripe's internal Ledger models each money process as a fund flow between accounts. At steady state the clearing accounts should be zero, and any nonzero balance points to money that is stuck. ([Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement))
- Stripe scores every flow on clearing, timeliness and completeness. Its dashboards let you click a point on a graph and trace it back to the underlying records. ([Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement))
- Stripe never edits its log. It fixes errors by reverting and reprocessing, behind a two-phase review. ([Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement))
- Modern Treasury treats a posted ledger transaction as immutable and corrects it by posting reversal entries, which keeps a paper trail. ([Modern Treasury, immutability](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger))
- Homegrown ledgers tend to fail through bad balance aggregation, which can mean "money created out of nothing", and through missing idempotency, which leads to double charges. ([Modern Treasury, homegrown ledgers](https://moderntreasury.com/journal/how-and-why-homegrown-ledgers-break))
- Every transaction has at least two entries, one for where the money came from and one for where it went. Total debits must equal total credits, and balances can be rebuilt as of any date from immutable entries. ([Modern Treasury, Accounting for Developers](https://www.moderntreasury.com/journal/accounting-for-developers-part-i))
- Floats drift: languages round 2.5 differently, and the order of operations alone can move a total by a cent. The recommendation is integer minor units. ([Modern Treasury, floats](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents))
- SimTigerBeetle runs the real database code in a browser through three escalating fault levels: calm, then crashes and flaky network, then disk corruption. Because the simulator is deterministic, any failing run can be replayed exactly. ([TigerBeetle](https://tigerbeetle.com/blog/2023-07-11-we-put-a-distributed-database-in-the-browser/))
- Chaos engineering starts from a "steady-state hypothesis" about measurable output, then injects failures that mirror real-world events. ([Principles of Chaos](https://principlesofchaos.org/))
- Jepsen generates random operations, injects faults, and checks the resulting history against a model. Its findings are named anomalies, not vague failures. ([Jepsen analyses](https://jepsen.io/analyses))
- d3-sankey only lays out a directed acyclic graph of nodes and links (source, target, value) and leaves the rendering to you. It is BSD-3 licensed. ([d3-sankey](https://github.com/d3/d3-sankey))

## How it applies to Rescrow

- Our steady-state hypothesis already exists: `reconcile()` returning `balanced: true` with no breaks. Every failure we inject on stage should be judged against that one line, the way chaos experiments are.
- The demo shows the happy path well, but two rules never appear on screen: the deadline payout (`dueBy`) and the trust guard refusing a move. Engineers will ask about both. A few seconds spent on each turns a claim into evidence.
- The fake Ramp feed is the right thing to mock, because it is peripheral. The split, the holds, the guard and reconcile are all real code, and the demo should make that obvious so nobody suspects the core is faked.
- Beat 6 is our "failure case". Today it ends on a text banner. A picture of where every dollar went (a Sankey, or a with/without comparison) would make it the frame judges remember.
- The script runs 2:30 against a 3:00 cap, so each on-screen idea below says which beat it attaches to and roughly how many seconds it adds. Anything longer than about 10 seconds belongs on `/lab` or in Q&A, not the video.
- `releaseTrust` and the engine currently change `hold.status` in place. That is fine for the demo, but sibling notes (`ledger-design.md`) already cover a journal with reversals. This note sticks to demo craft and visuals so the two don't overlap.

## Feature ideas

### Creditors try the trust account

- What: When `B` fires, the insolvency route also makes one creditor claim against the trust account through the real `releaseTrust` path, with a destination that isn't allowed. The screen prints the thrown `EscrowError` text word for word in a small monospace "refused" card while the reconcile strip stays green, and the attempt is logged as an activity row (`kind: "trust_refused"`, an additive type change) that moves no money.
- Why judges care: the trust rule stops being a slide claim and becomes a real exception thrown live, which is the PRD's own point 2.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is a deterministic code path that already has a test, and it adds about 4 seconds to beat 6.
- Grounding: from the codebase (`releaseTrust` guard in `src/lib/escrow/engine.ts`); [Reskilll](https://blogs.reskilll.com/hackathon-demo-presentation-tips-pitch-3-minutes-win-2026/) on showing error handling.

### With and without Rescrow, side by side

- What: A pure function `counterfactual(snapshot)` replays the same payments into one commingled account, the way galleries work today, and at insolvency pays the artist the unsecured creditors' pro-rata rate (about 8 pence on the pound, a constant cited to the Stephen Friedman source). Beat 6 splits into two columns, "Today: Ines gets $X" and "With Rescrow: Ines gets $8,000.00", and both numbers come from real snapshot data.
- Why judges care: it turns the opening hook into a number computed from the same events, so the story closes on arithmetic, not rhetoric.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low. It is a pure function over the snapshot. The one risk is the recovery rate looking invented, so the card cites its source on screen. It adds about 5 seconds.
- Grounding: from the codebase (`docs/demo-script.md` hook and sources); [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement) on modeling each process as a fund flow.

### Where every dollar went: insolvency Sankey

- What: A Sankey drawn from the snapshot and replacing the text banner on beat 6: Opening balance and Buyer payments feed Operating and Trust, Operating drains to Creditors and Still in operating, and Trust drains to Artist paid, Refunded to buyer and Still held (the refund gets its own sink because d3-sankey needs an acyclic graph). Band widths are integer cents, and a test asserts each node's inflow equals its outflow and the sinks sum to the reconcile total of opening + received.
- Why judges care: one picture shows the invariant: the trust band never touches the creditors node.
- Demo visibility: both
- Effort: M (add `d3-sankey@0.12.3` pinned, or hand-roll the SVG for three columns)
- Demo risk: med. Layout can jitter as numbers animate, so render it once at the end of beat 6 rather than tweening it. It adds about 0 to 4 seconds because it replaces the banner.
- Grounding: [d3-sankey](https://github.com/d3/d3-sankey); [Modern Treasury, Accounting for Developers](https://www.moderntreasury.com/journal/accounting-for-developers-part-i) on two-sided entries.

### Hold timeline with a deadline you can fast-forward

- What: Each hold is drawn as a bar from `lockedAt` to `dueBy`, with a marker where the sale completes. A `T` key advances the demo clock by N days through the existing `Clock` (a clock offset kept in the store), so `releaseDueHolds` fires on any hold past `dueBy` and its bar turns into a payout labeled "deadline reached, sale still open".
- Why judges care: it shows the second payout rule (never later than the agreement deadline), which the current script only describes.
- Demo visibility: both
- Effort: M
- Demo risk: med. A time jump can confuse viewers, so the clock offset is shown on screen ("Day +61"). Use it on `/lab` or as an optional cut of about 8 seconds.
- Grounding: from the codebase (`releaseDueHolds`, `dueBy`); [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement) on timeliness as a quality score.

### Redeliver the last Ramp transaction

- What: `IncomingPayment.rampTransactionId` exists in the types, but nothing dedupes on it yet, so this idea adds the check in `receivePayment`: a second payment with a known id returns the unchanged Snapshot and logs "duplicate txn_… ignored". A `D` key re-posts the last transaction on stage, balances don't move, and a test asserts the snapshot is byte-for-byte equal after the replay.
- Why judges care: Ramp engineers live with retries and duplicate deliveries, and this shows ingest is idempotent without a word of explanation.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is a deterministic lookup on the transaction id and adds about 3 seconds after payment 2.
- Grounding: [Modern Treasury, homegrown ledgers](https://moderntreasury.com/journal/how-and-why-homegrown-ledgers-break) on idempotency and double charges.

### Pull the plug mid-payment

- What: A lab-only switch throws inside `receivePayment` after trust is updated but before operating, simulating a crash between two writes; because `mutate` re-reads the file on each change and saves through a temp file and rename only on success, disk is unchanged and the screen shows "write aborted, nothing saved" with reconcile green. A test throws at every step of `receivePayment` and checks the store is either fully before or fully after.
- Why judges care: a half-applied transfer is the classic money-system bug, and this shows by test that it can't happen.
- Demo visibility: both
- Effort: M
- Demo risk: med. A fault switch must never be reachable in normal mode, so it is gated by an env flag and never shown in the recorded video, only on `/lab` or in Q&A.
- Grounding: [Principles of Chaos](https://principlesofchaos.org/) on injecting real-world events; [Modern Treasury, homegrown ledgers](https://moderntreasury.com/journal/how-and-why-homegrown-ledgers-break).

### Calm, messy, hostile: seeded stress levels on /lab

- What: Three presets in the style of SimTigerBeetle: calm (on-time installments), messy (late, duplicate and out-of-order feed deliveries plus cancels) and hostile (insolvency mid-stream and aborted writes). Each run is driven by a seed shown on screen (reusing the LCG in `invariants.test.ts`) and lists N operations with reconcile run after each, so a judge can call out a seed and watch it replay identically.
- Why judges care: it is a live, replayable stress test against a stated invariant, the same thing TigerBeetle and Jepsen are respected for.
- Demo visibility: both
- Effort: M
- Demo risk: low for `/lab` and Q&A. Keep it out of the 3-minute video.
- Grounding: [TigerBeetle](https://tigerbeetle.com/blog/2023-07-11-we-put-a-distributed-database-in-the-browser/); [Jepsen analyses](https://jepsen.io/analyses); from the codebase (`invariants.test.ts`).

### Live T-accounts for Operating and Trust

- What: Two T-accounts (debits left, credits right) sit under the gallery balances, and each payment animates in as a pair of rows labeled with its payment id: the commission to Operating and the share to Trust. A footer shows total debits equal total credits, and everything is derived from `ledgerFor()` rows.
- Why judges care: it speaks the accountant's language, and Ramp is a finance company whose customers are controllers.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It is read-only rendering and adds no seconds, since it plays during the payment beats.
- Grounding: [Modern Treasury, Accounting for Developers](https://www.moderntreasury.com/journal/accounting-for-developers-part-i); from the codebase (`src/components/ledger.ts`).

### Click any number to see where it comes from

- What: Every money figure on `/gallery` and the artist page (trust balance, paid to date, claimed by creditors) opens a drawer. The drawer lists the holds, payments or payouts that sum to it, with ids, and a subtotal that matches the figure to the cent. One helper, `explain(snapshot, metric)`, returns `{ rows, totalCents }`, and a test checks that `totalCents` equals the figure shown for every metric.
- Why judges care: it is the Stripe dashboard move, where you click a number and get the records behind it, so no balance is a black box.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is optional on camera and strong in Q&A.
- Grounding: [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement) on tracing from a graph to records.

### Stuck-money check next to the reconcile strip

- What: Add a second check to the strip, "0 cents stuck", where stuck means trust still locked on a completed or cancelled sale, or a hold past `dueBy` that hasn't paid out. Any hit appears as a named break with the hold id and amount, and tests plant each kind of stuck hold and expect the exact break text.
- Why judges care: balancing isn't enough. Stripe treats money that should have cleared and didn't as the real alarm.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is a pure check and adds about 1 second (it is just another green tick).
- Grounding: [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement) on clearing to zero.

### Awkward-cents rounding table

- What: A `/lab` panel takes a price, installment count and share in bps (say $24,000.01 in 7 payments at 47.5%) and shows per-payment shares from the running-total method next to naive per-payment float rounding. It highlights the cent where the naive column drifts and shows the running-total column summing exactly to the artist's total, with the same inputs property-tested.
- Why judges care: it makes "balances to the cent" a visible, checkable claim rather than an adjective.
- Demo visibility: both
- Effort: S
- Demo risk: low. It sits on `/lab` and fits Q&A.
- Grounding: [Modern Treasury, floats](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents); from the codebase (`shareOf`, running-total rounding).

### Invariant counter on the presenter

- What: The reconcile strip gains a small counter: "checked 14 times this demo, 0 breaks". Every API response already returns a Snapshot, so each response also stamps a `reconcileRuns` count and the last result. The counter ticks on every keypress, so the invariant reads as continuous, not a one-off check.
- Why judges care: it shows the steady-state hypothesis being checked after every step, not just at the end.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It adds no seconds. Make sure reset (`R`) zeroes it, so a second take doesn't show leftover counts.
- Grounding: [Principles of Chaos](https://principlesofchaos.org/); from the codebase (`TrustProof.tsx`).

### Golden snapshot hash per demo beat

- What: The end-to-end demo test records a short hash of the canonical Snapshot after each beat (agreement read, sale, payments 1 to 3, insolvency) and pins them in a fixture. The presenter shows the current hash in a corner. If the recorded video and a judge's local run show the same hashes, the run matches exactly.
- Why judges care: it proves the demo is deterministic and replayable, not a staged animation.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. Ids and timestamps must come from the injected `Clock`, which the engine already uses, or the hashes will drift.
- Grounding: [TigerBeetle](https://tigerbeetle.com/blog/2023-07-11-we-put-a-distributed-database-in-the-browser/) on reproducible runs; [Reskilll](https://blogs.reskilll.com/hackathon-demo-presentation-tips-pitch-3-minutes-win-2026/) on keeping a backup recording.
