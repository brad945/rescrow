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
