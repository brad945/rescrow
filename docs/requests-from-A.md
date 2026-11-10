# Requests from lane A to lane B

Lane A appends here; lane B checks items off. Newest at the bottom.

- [x] `ActivityFeed.tsx`: `LABEL` falls back to "Event" for activity kinds it doesn't know. Lane A made this one-line change with Bradley's OK, so new kinds can't break the build.
- [x] **Beat 6 in `/present`** (done by lane A with Bradley's OK: key `B`, `TrustProof.tsx`, creditor row in `ledger.ts`): call `POST /api/demo/insolvency` with `{ "galleryId": "gal_lowline" }` (returns the full Snapshot) after payment 2. The resulting state:
  - `gallery.status === "insolvent"` and `gallery.operatingBalanceCents === 0`
  - a `creditor_claim` activity whose `amountCents` is what creditors took
  - every locked hold becomes `paid` with a `Payout` to its artist
  - later sales and payments return 400 "… is insolvent"
  - `POST /api/demo/reset` restores everything
- [x] (on the `/present` phone) **Artist portal:** show `hold.dueBy` ("paid by <date> at the latest") on held money. The field is optional.
- [x] (on `/present`) **Reconciliation badge:** `reconcile(snapshot, galleryId)` from `@/lib/escrow/reconcile`.

## Notes for Neil, Nov 10 overnight (pull before editing anything)

- `Snapshot` has new required fields: `journal` and `refunds`; optional `seedVersion` and `clockOffsetMs`. `Payout` has `reason`, `Sale` has `payoutDays` and `cancelledAt`, `IncomingPayment` always has `rampTransactionId`.
- The seed is now dated relative to now, and `SEED_VERSION` reseeds any old `data/db.json` the first time it loads. Theo's seeded hold now has a 14-day deadline, four days after a reset.
- **Press `R` right before recording.** It resets the demo clock and re-dates Theo's deadline.
- `/present` has new keys: `G` gallery tries to spend trust, `T` jump 61 days, `D` bank redelivery. The optional beats are now compact one-line buttons. All are optional; the 2:30 script works without them. `B` hides after `T`, so the insolvency numbers can't be contradicted.
- New page `/books` (in the nav). New routes: `/api/demo/attempt`, `/api/demo/advance`, `/api/demo/redeliver`.
- Gate: `bash scripts/gate.sh` (CI runs it). `src/app/api/demo-flow.test.ts` drives the recorded demo through the routes; if it fails, the demo is broken.

### Added later the same night

- New pages and sections, none on the recorded `/present` take except one banner line:
  - `/books`: commission earned (accrual or cash), payout deadlines, month-end close, export to the gallery's own chart, and, after `B`, the statement of affairs.
  - `/gallery`: click either balance for the records that sum to it; "Why these rules" card at the bottom.
  - `/artist/[id]`: every buyer payment with its bank id and when each share was paid; the artist's own three-way check; after `B`, a "When the gallery failed" card.
  - `/lab`: "Try to break the books" (runs on a copy in the browser, never the store) and "Check the cents".
- The insolvency banner on `/present` gained two lines: the same failure without a separate account, and the §12.01 quote. The script has it as an optional line.
- Every payment and every cancellation now pays any share already past its deadline first. A deadline payout is stamped at its deadline.
- Optional snapshot field `closedPeriods`; `SEED_VERSION` is 4.
