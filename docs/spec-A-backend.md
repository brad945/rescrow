# Spec A: backend (Bradley)

Lane A owns `src/types.ts`, `src/lib/**`, `src/app/api/**`, `scripts/**`, package files, configs and README (table in `CLAUDE.md`). The acceptance test is `docs/PRD.md` §2: Neil's `docs/demo-script.md` plus beat 6 (insolvency).

**What already works (Neil's base):** the escrow engine with running-total rounding, the JSON store, the seed (hand-tuned: operating balance 4,183,627, exact timestamps), the demo routes, and 400+ tests, including invariants, routes, `story.test` and `ledger.test`.

## Rules for every lane A change

- **Additive only.** Add fields, functions and routes. Never rename or remove anything B uses: `paidSoFar`, `galleryTotals`, `artistTotals`, `methodLabel`, `shareOf`, `formatCents`, the route bodies, the Snapshot shape.
- **Don't add members** to `SaleStatus`, `HoldStatus` or `ArtworkStatus`, because `ui.tsx` maps them exhaustively. `ActivityKind` can grow once `ActivityFeed.tsx` falls back to a default label (commit 2).
- **Before every push, run the full suite:** `npm run lint && npm run typecheck && npm test && npm run format:check`. B's tests (`story.test`, `ledger.test`, `useSnapshot.test`) exercise the engine and seed, so a lib change can break them without touching B's files.
- **Edit the seed by hand.** Add new fields to it; don't regenerate it.
- **Every new capability has a fallback** that keeps `/present` working if it fails.

## Commit order

Each step: `git pull --rebase`, full checks, push.

1. **Docs:** PRD, specs, `CLAUDE.md`.
2. **`ActivityFeed.tsx` fallback.** This is a one-time B-file edit, approved by Bradley: `Partial<Record<ActivityKind, string>>` and `LABEL[a.kind] ?? "Event"`.
3. **Additive types + seed fields** (§1).
4. **Deadline rule, trust guard, insolvency, reconciliation** (§2, §3).
5. **Agent** (§4).
6. **Ramp feed** (§5).
7. **Tier 2.**

## §1. Types (additive)

```ts
// Gallery
status?: "active" | "insolvent";      // missing = active
insolventAt?: Timestamp | null;
// EscrowHold
dueBy?: Timestamp;                     // receivedAt + terms.payoutDays
// IncomingPayment
rampTransactionId?: string;            // idempotency key for feed ingest
// AgreementTerms
confidence?: "high" | "needs_review";
unverifiedCitations?: string[];        // quotes the agent gave that aren't in the text
model?: string;                        // which local model produced live terms
// ActivityKind: add (after commit 2)
| "gallery_insolvent" | "creditor_claim" | "agent_flag" | "deadline_payout"
// ReadAgreementRequest
mode?: "saved" | "live";               // default "saved"
// new
export interface InsolvencyRequest { galleryId: Id }
export interface Reconciliation {
  balanced: boolean;
  receivedCents: Cents; operatingCents: Cents; trustCents: Cents;
  paidToArtistsCents: Cents; refundedToBuyersCents: Cents; claimedByCreditorsCents: Cents;
  breaks: string[];
}
```

The new fields are optional so the existing seed, B's test fixtures and old `data/db.json` files stay valid.

## §2. Payout rule, trust guard, reconciliation (`src/lib/escrow/`)

**D4: hold until the sale completes, paid that day, never later than the agreement allows.**

- `receivePayment` sets `hold.dueBy = receivedAt + payoutDays` from the agreement's terms.
- New `releaseDueHolds(s, clock)` pays out every locked hold whose `dueBy` is at or before `clock.now()`, even if the sale is still open. It writes a `Payout` and a `deadline_payout` activity. `GET /api/state` calls it before returning, so a hold can never sit past its deadline. In the demo, deadlines are 14–60 days out, so `/present` is unaffected.
- Full payment still triggers the same-day `payOutSale`, exactly as now.

**Trust guard:** one function, `releaseTrust(s, holds, to: "artist" | "buyer", reason)`, is the **only** code that changes a hold's status from `locked`. It throws `EscrowError("Trust funds can't go to …")` for any other destination. `payOutSale`, `cancelSale`, `releaseDueHolds` and `declareInsolvency` all go through it.

**`reconcile(s, galleryId)`** (pure, in `src/lib/escrow/reconcile.ts`). Checks that received (all payments) − paid to artists − refunded to buyers − claimed by creditors equals operating gain plus trust, and that trust equals the sum of locked holds. Lists any break in plain words. Needs a `creditorClaimsCents` total, recorded in an activity (`amountCents`) or tracked on the gallery.

**Tests:**

- Reconcile is balanced after every operation, including random sales, cancellations and insolvency (extend `invariants.test.ts`).
- `releaseTrust` to the gallery or creditors throws. **This is the test we show judges** (`npm test -- -t "trust"`).
- A hold past `dueBy` on an open sale is paid by `releaseDueHolds` (fixed clock).

## §3. Insolvency (beat 6)

`declareInsolvency(s, { galleryId }, clock)`:

1. sets the gallery's status to `insolvent` (and `insolventAt`)
2. moves the whole operating balance to creditors, logged as `creditor_claim` with the amount; operating goes to 0
3. calls `releaseTrust(…, "artist")` on every locked hold, which writes a payout per artist
4. logs `gallery_insolvent`

From then on, `createSale` and `receivePayment` throw ("Lowline Gallery is insolvent"). Calling it again is a no-op.

**Route:** `POST /api/demo/insolvency` with `{ galleryId }` returns the full Snapshot. `POST /api/demo/reset` restores everything.

**Fallback:** if B hasn't wired beat 6 by 6 PM, the demo skips it and nothing else changes.

## §4. Agent (`src/lib/agent/`)

- **`mode: "saved"` (default):** the current fixture behavior. `/present` sends a bare `{ agreementId }`, so it's unchanged.
- **`mode: "live"`:**
  - **Model:** `OLLAMA_MODEL` if set, otherwise the first model `GET /api/tags` lists, preferring gpt-oss, then qwen, then llama.
  - **Call:** `POST /api/chat` with `stream: false`, temperature 0, and a JSON schema as `format`. Check this parameter against the current Ollama docs.
  - **Timeout:** 25s via `AbortController`.
  - **Fallback:** on any failure (not running, timeout, bad JSON, failed validation, no share found), use the saved answer, log an `agent_flag` activity giving the reason, and set `source: "fixture"`. With no saved answer, return a 400 error.
- **Citation snapping (pure, `verify.ts`):**
  - normalize whitespace and quote characters, then find each quote in `agreement.text`
  - replace it with the **exact slice** of the text, because `AgreementText` matches with `indexOf`
  - a quote that isn't found goes into `unverifiedCitations` and sets `confidence: "needs_review"`
  - cross-check: a share quote that contains a percentage must match `artistShareBps`
- **Tests:** snapping (exact match, a whitespace or curly-quote variant, a made-up quote, a wrong percentage); every live failure path falls back (stub `fetch`); saved mode for the seeded agreements gives `confidence: "high"`.
- `scripts/agent-smoke.ts` reads all 3 agreements live and prints the results next to the saved answers.

## §5. Ramp feed (`src/lib/ramp/`)

```ts
interface BankFeed {
  listTransactions(
    galleryId: Id,
    since: Timestamp | null,
  ): Promise<RampTransaction[]>;
}
// Ramp-shaped, our own type: id, amount (cents), memo, counterparty, rail, posted_at
```

- `FakeRampFeed` keeps a queue in the store. `queueIncoming(sale, amount, method)` adds a transaction with memo `RESCROW <saleId>`.
- `syncFeed(s, feed)` pulls new transactions, matches them by memo, and ingests each through `receivePayment` with `rampTransactionId`. A transaction id that's already been ingested is skipped (idempotent). Unmatched transactions are logged and left alone.
- `POST /api/demo/payment` becomes queue + sync. The body and response stay exactly as now. **Fallback:** if the feed path throws, call `receivePayment` directly, as today.
- **Tests:** idempotency (the same transaction synced twice locks once), an unmatched memo, and the route response unchanged.

## §6. Tier 2

- Framing deduction on _Harbor Grid_ (`framingCostCents: 50_000`, capped at 40,000), taken from the first payment's artist share.
- Disconnect alert data (`rampConnected` false → the artist portal shows a banner).

## §7. Hour by hour

| Time    | Commit                                       | Done when                                                              |
| ------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Tonight | 1–3                                          | Pushed, full suite green                                               |
| 9–12    | 4                                            | Insolvency route works with curl, `releaseTrust` test green; text Neil |
| 12–2:30 | 5                                            | Live call works with the installed model, fallback tested              |
| 2:30–4  | 6                                            | Feed sync idempotent, demo payment unchanged                           |
| 4–5     | 7                                            |                                                                        |
| 5–6     | Run the full script with Neil, fix only bugs | Script passes twice in a row after a reset                             |
