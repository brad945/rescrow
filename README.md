# Rescrow

Escrow for art galleries, built on Ramp. When a consigned work sells, an agent reads the consignment agreement and works out the artist's share. Each time a buyer payment lands in the gallery's Ramp account, the artist's share moves to a separate artist trust account the gallery can't spend from. When the buyer finishes paying, the artist is paid that day, with a statement. If the buyer is still paying when the agreement's deadline comes, that share is paid on the deadline anyway.

New York already treats an artist's sale proceeds as trust funds (Arts and Cultural Affairs Law section 12.01), but nothing makes a gallery keep them apart from rent and payroll. When Stephen Friedman Gallery entered administration in February 2026 it owed Kehinde Wiley £163,849, with creditors expected to recover 8 to 9 pence per pound.

BBS x Ramp Hackathon, build round. Team: Bradley Tsou, Neil Saji.

## Run it

```bash
npm install
npm run dev          # http://localhost:3333
```

| Page       | What it is                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/present` | The demo. Gallery account on the left, the artist's phone on the right. Keys: `→` next step, `G` gallery tries to spend trust, `T` jump the demo clock 61 days, `D` the bank feed redelivers the last wire, `C` buyer cancels, `B` gallery goes under, `R` reset. Script in `docs/demo-script.md`. |
| `/gallery` | Gallery view: operating and trust balances (click either to see the records that sum to it), account ledger, sales, agreements with the agent's cited clauses, and the real failures behind each rule.                                                                                             |
| `/books`   | The accountant's view: trial balance, trust tie-out, commission on accrual or cash basis, payout deadlines, month-end close, where money may go, the journal, and CSV / QuickBooks-style exports mapped onto the gallery's own chart.                                                              |
| `/artist`  | Each artist's view: held in trust, every buyer payment with its bank id and when each share was paid, their own three-way account check, statements.                                                                                                                                               |
| `/demo`    | Simulator for buyers and incoming transfers.                                                                                                                                                                                                                                                       |
| `/lab`     | Try the agreement reader on any agreement, check the cents on a seeded work, and try to break the books on a copy in your browser.                                                                                                                                                                 |

Demo data lives in `data/db.json` (gitignored), created from `src/lib/seed.ts` on first load. Reset puts it back, with the seeded history dated relative to now.

## How it maps onto Ramp

- The gallery keeps its normal **Ramp Checking Account** for operating cash and opens a second Ramp Checking Account titled as artist trust. Ramp supports multiple checking accounts per business.
- Ramp's Developer API exposes banking accounts and banking transactions but has no webhook for incoming deposits, so the production design polls `GET /developer/v1/banking/syncable-transactions` and matches deposits to open sales. Polls overlap, so ingest is idempotent on Ramp's transaction id (`receivePayment`, `src/lib/feed/ramp.ts`): a redelivered transaction books nothing, and the same id with different details is refused. In this build the feed is simulated (`/demo`, and a fake feed in tests that repeats and reorders pages).
- Payouts to artists would go out through Ramp transfers from the trust account.
- The agreement reader fits next to Ramp's contract-aware AP and procurement agents.

## The money, and how we prove it

Every rule below is enforced in code and checked by tests. None of it is a convention.

- **Two records of every move.** The engine keeps balances, holds, payouts and refunds. Beside them, every money move is also posted to a double-entry journal (`src/lib/escrow/journal.ts`): one entry per move, postings summing to zero, over accounts scoped to the gallery (operating, trust per artist, artist, buyer per sale, creditors, opening equity). `reconcile()` folds the journal and checks it against the records to the cent, account by account.
- **The trust rule lives on the account.** `ACCOUNT_RULES` is data. Trust and operating never go below zero. Trust can only be debited by `TRUST_TO_ARTIST` or `TRUST_TO_BUYER`, only to its own artist or a buyer of that gallery. Operating can only go to buyers (refunds) or creditors. `post()` never debits trust at all; `postTrustRelease()` is the one door, and only `releaseTrust()` calls it. Press `G` on `/present` to watch the gallery try to pay rent from trust and get refused, with nothing moving.
- **The architecture is tested, not just reviewed.** `src/lib/escrow/architecture.test.ts` scans the source: a manifest of every line that writes money (a new one fails the build until it is added); hold status changes only inside `transition()` over `HOLD_TRANSITIONS` (locked goes to paid or refunded, both final); the journal's posting functions imported only by the engine; every API route running on the demo clock.
- **Reconciliation that can fail.** `reconcile()` checks opening + received = operating + trust + paid to artists + refunded to buyers + taken by creditors, plus per-payment holds, payouts against holds, refund records against holds, bank-id completeness and the journal. `src/lib/escrow/reconcile.test.ts` plants nineteen different corruptions in healthy books and checks that each one is named.
- **The buyer is always made whole.** A cancelled sale writes a `Refund` record. The artist's locked share comes back from trust; the gallery's part comes from operating; a share the artist was already paid on its deadline stays with the artist, and the gallery covers it from operating. If operating can't cover it, the cancel is refused.
- **Deadlines fire.** Each held share is due on its agreement's deadline (`dueBy`) and is paid at completion or at the deadline, whichever comes first. The demo clock (`T` on `/present`) moves a snapshot's clock forward so you can watch it happen. Every route builds its clock with `clockFor(snapshot)`, so events stay in order.
- **Insolvency.** Creditors take operating. Trust is paid to the artists, and unsold consigned works go back to them.
- **Random testing with coverage gates.** `src/lib/escrow/model.test.ts` runs 250 seeded histories of 60 steps: sales across artists, awkward partial payments, duplicate and conflicting bank deliveries, overpayments, cancellations, clock jumps, refused trust moves and insolvency. It checks reconciliation and a dozen invariants after every step, and fails unless the runs actually reach every outcome (a typical batch has hundreds of deadline payouts, refused trust moves and ignored duplicates). Planting the old per-payment rounding bug makes it fail on seed 1, step 5.
- **The recorded demo is a test.** `src/app/api/demo-flow.test.ts` drives `/present`'s steps through the real route handlers and pins every number the narration says.
- **Each record reconciles on its own, not just the totals.** Every payment's hold must equal its running-total share, every payout must be made of its own artist's paid holds, and nothing may stay locked on a finished sale. A cent moved between two holds keeps every total intact; this catches it. Each artist sees their own account checked from three sources (payments, holds, journal) on the portal and every statement.
- **Month-end close.** `/books` closes months in order, only after they end, and only while reconciliation passes and nothing in trust is overdue; otherwise it refuses and says why. A closed month is sealed by its entry count and totals, so any later edit is a named break.
- **The failure, three ways.** After `B`, the ending shows what creditors took and what each artist got, plus the same failure without a separate account: operating plus trust as one balance in the administrator's hands, the artists' part of it needing a tracing claim. `/books` adds the administrator's statement of affairs (never the gallery's, the estate, and every open sale's money split by where it went), and each artist's portal shows their side, with the bank payments behind each payout.
- **Try to break it.** `/lab` applies eleven ways to cheat (a cent moved between two shares, a payout inflated, a bank transaction booked twice, an entry slipped into a closed month...) to a copy of the live books, and shows `reconcile()`'s own words for each. A test runs every one in every demo state.
- **Books for the accountant.** `src/lib/books.ts` turns the journal into a general ledger where trust is restricted cash against a liability (due to artists), never revenue, and the gallery's part of a payment is the buyer's deposit until the sale completes. It gives a trial balance, a trust tie-out (the engine's records against the ledger), commission on an accrual or cash basis, a payout-deadline ladder, a flow matrix decided by the account rules themselves, and exports built from integer cents. `src/lib/chart.ts` maps the exports onto the gallery's own chart and refuses any mapping that would put trust money in operating cash or income.

## The agent

The agreement reader runs a local model through Ollama (`gpt-oss:20b` here), so no contract text leaves the machine. `POST /api/agent/read` takes `mode`: `"saved"` (default) returns the stored answer, `"live"` asks the model. With `?stream=1` it streams the model's reasoning and answer as it writes. The recorded demo uses saved answers and runs with no network.

The model can only answer in a fixed JSON shape, and every number travels with the clause it came from. Then a verifier (`src/lib/agent/verify.ts`) checks the model rather than trusting it:

1. Each quote must appear word for word in the agreement (whitespace aside).
2. The split quote must state the artist's percent, or the gallery's side of it ("commission of thirty-five percent" means 65% to the artist). Numbers written as digits, words, or fractions ("half", "divided equally") all count.
3. The payout quote must state the number of days.

If any check fails, the terms are marked for a person to confirm, and the escrow engine refuses to open a sale on them. Notes the model can't quote are dropped.

Try it on any agreement at `/lab`. Two samples are built in: one that only states the gallery's commission, and a letter with no payout deadline, which gets flagged.

| Setting                    | Default                                 |                                                    |
| -------------------------- | --------------------------------------- | -------------------------------------------------- |
| `RESCROW_AGENT`            | live reads allowed                      | `fixture` turns live reads off; saved answers only |
| `OLLAMA_MODEL`             | first of gpt-oss, qwen, llama installed | pin a model                                        |
| `OLLAMA_URL`               | `http://localhost:11434`                |                                                    |
| `RESCROW_AGENT_TIMEOUT_MS` | 60000                                   | after this a live read falls back                  |

If a live read fails (Ollama down, too slow, bad output), it falls back to the saved answer, logs an `agent_flag` activity with the reason, and the screen labels the source.

## Design decisions

- **Money is integer cents.** No floats anywhere, including exports, which are built as exact decimal strings.
- **Cent-exact splits.** The artist's share of each installment is the share of the running total minus the share before it, so installments always add up to exactly the artist's share of the price (`artistShareOfPayment` in `src/lib/escrow/engine.ts`).
- **The split and the payout window are fixed when a sale closes**, so re-reading an agreement can't change a sale already in progress.
- **The agent must quote.** The highlights in the UI are the verified quotes, not the model's own claims.
- **One writer at a time.** Every state change goes through a single queue (`mutate` in `src/lib/store.ts`) and is written atomically.

## Research

`research/` holds the background this was built on: 24 topic notes (artist consignment law by state, gallery collapses, legal trust accounting, production ledgers, payment rails, Ramp's platform, bankruptcy priority, tax and royalties, and more), a domain brief, a catalog of 214 feature ideas, and the ranked build plans we worked from.

## Limits

- The bank feed and payouts are simulated; there is no live Ramp sandbox connection yet. The ingest and paging code is real, but nothing polls Ramp.
- The journal mirrors the balances and is checked against them on every reconcile; balances are not yet derived from it.
- If a buyer cancels and the gallery's operating cash can't cover its part of the refund, the cancel is refused. There is no recorded shortfall or payment plan for the buyer yet.
- The verifier checks that numbers are stated in the quoted clause, not that the clause means what the model says. A clause like "half of the amount above $10,000" would pass the 50% check; that's what the human review path is for.
- One gallery, three artists, JSON file storage. Fine for a demo, not for production.

## Checks

```bash
bash scripts/gate.sh --build   # lint, typecheck, tests, format check, production build
```

CI runs the same script on every push.

## How the code is laid out

| Area                          | Paths                                                     |
| ----------------------------- | --------------------------------------------------------- |
| Escrow rules                  | `src/lib/escrow/engine.ts`                                |
| Journal and account rules     | `src/lib/escrow/journal.ts`                               |
| Reconciliation                | `src/lib/escrow/reconcile.ts`                             |
| Books (GL, exports)           | `src/lib/books.ts`                                        |
| Bank feed ingest              | `src/lib/feed/ramp.ts`                                    |
| Agent (reads agreements)      | `src/lib/agent/`                                          |
| Store and seed                | `src/lib/store.ts`, `src/lib/seed.ts`                     |
| API routes                    | `src/app/api/`                                            |
| Presenter, gallery, artist UI | `src/app/present/`, `src/app/gallery/`, `src/app/artist/` |
| Books, simulator, lab         | `src/app/books/`, `src/app/demo/`, `src/app/lab/`         |
| Shared UI and story steps     | `src/components/`                                         |

## API

All routes return the full `Snapshot` (see `src/types.ts`).

| Route                       | Body                                                     |
| --------------------------- | -------------------------------------------------------- |
| `GET /api/state`            | (pays any share past its deadline first)                 |
| `POST /api/demo/sale`       | `{ artworkId, buyerName, installments }`                 |
| `POST /api/demo/payment`    | `{ saleId, amountCents?, method?, rampTransactionId? }`  |
| `POST /api/demo/cancel`     | `{ saleId }`                                             |
| `POST /api/demo/insolvency` | `{ galleryId }`                                          |
| `POST /api/demo/attempt`    | `{ saleId, kind: "rent" or "creditor" }`, always refused |
| `POST /api/demo/advance`    | `{ days }`, 1 to 120                                     |
| `POST /api/demo/redeliver`  | `{ galleryId }`, replays the latest bank transaction     |
| `POST /api/demo/reset`      |                                                          |
| `POST /api/agent/read`      | `{ agreementId, mode? }`                                 |
| `POST /api/books/close`     | `{ galleryId, month }`, the next month to close          |

Errors come back as `{ error }` with status 400. One deliberate exception: `/api/demo/attempt` returns 200, because the refusal is the expected outcome and is recorded in the activity feed.
