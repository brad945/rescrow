# Rescrow

Escrow for art galleries, built on Ramp. When a consigned work sells, an agent reads the consignment agreement and works out the artist's share. Each time a buyer payment lands in the gallery's Ramp account, the artist's share moves to a separate artist trust account the gallery can't spend from. When the buyer finishes paying, the artist is paid that day, with a statement.

New York already treats an artist's sale proceeds as trust funds (Arts and Cultural Affairs Law section 12.01), but nothing makes a gallery keep them apart from rent and payroll. When Stephen Friedman Gallery entered administration in February 2026 it owed Kehinde Wiley £163,849, with creditors expected to recover 8 to 9 pence per pound.

BBS x Ramp Hackathon, build round. Team: Bradley Tsou, Neil Saji, Takenosuke Nagata.

## Run it

```bash
npm install
npm run dev          # http://localhost:3333
```

| Page       | What it is                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/present` | The demo. Gallery account on the left, the artist's phone on the right. `→` next step, `C` buyer cancels, `R` reset. Script in `docs/demo-script.md`. |
| `/gallery` | Gallery view: operating and trust balances, account ledger, sales, agreements with the agent's cited clauses.                                         |
| `/artist`  | Each artist's view: held in trust, paid, statements.                                                                                                  |
| `/demo`    | Simulator for buyers and incoming transfers.                                                                                                          |

Demo data lives in `data/db.json` (gitignored), created from `src/lib/seed.ts` on first load. Reset puts it back.

## How it maps onto Ramp

- The gallery keeps its normal **Ramp Checking Account** for operating cash and opens a second Ramp Checking Account titled as artist trust. Ramp supports multiple checking accounts per business.
- Ramp's Developer API exposes banking accounts and banking transactions but has no webhook for incoming deposits, so the production design polls `GET /developer/v1/banking/syncable-transactions` and matches deposits to open sales. In this build that feed is simulated (`/demo`).
- Payouts to artists would go out through Ramp transfers from the trust account.
- The agreement reader fits next to Ramp's contract-aware AP and procurement agents. Today it returns cached answers for the three seeded agreements; the local `gpt-oss` model call is in progress.

## Design decisions

- **Money is integer cents.** No floats anywhere.
- **Cent-exact splits.** The artist's share of each installment is the share of the running total minus the share before it, so installments always add up to exactly the artist's share of the price (`artistShareOfPayment` in `src/lib/escrow/engine.ts`). Checked against 300 random sales in `src/lib/escrow/invariants.test.ts`, along with conservation: every cent received is in operating, trust, paid out, or refunded.
- **The split is fixed when a sale closes**, so re-reading an agreement can't change a sale already in progress.
- **The agent must quote.** Every extracted number carries citations that must appear word for word in the agreement; those are what the UI highlights.
- **One writer at a time.** Every state change goes through a single queue (`mutate` in `src/lib/store.ts`) and is written atomically.

## Limits

- The bank feed and payouts are simulated; there is no live Ramp sandbox connection yet.
- One gallery, three artists, JSON file storage. Fine for a demo, not for production.
- If a buyer cancels after the gallery has spent its commission, the refund takes the gallery's operating balance negative. That's what would really happen; we show it instead of hiding it.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run format:check && npm run build
```

## How the code is split

| Area                         | Owner lane | Paths                                               |
| ---------------------------- | ---------- | --------------------------------------------------- |
| Shared types, deps           | Backend    | `src/types.ts`, `package.json`, `package-lock.json` |
| Agent (reads agreements)     | Backend    | `src/lib/agent/`                                    |
| Escrow rules and ledger      | Backend    | `src/lib/escrow/`, `src/lib/money.ts`               |
| Ramp bank feed               | Backend    | `src/lib/ramp/`                                     |
| Store and seed               | Backend    | `src/lib/store.ts`, `src/lib/seed.ts`               |
| API routes                   | Backend    | `src/app/api/`                                      |
| Gallery dashboard            | Frontend   | `src/app/gallery/`                                  |
| Artist portal and statements | Frontend   | `src/app/artist/`                                   |
| Demo control panel           | Frontend   | `src/app/demo/`                                     |
| Shared UI pieces             | Frontend   | `src/components/`                                   |

If the frontend needs a new field or package, ask the backend lane instead of editing its files.

## API

All routes return the full `Snapshot` (see `src/types.ts`).

| Route                    | Body                                     |
| ------------------------ | ---------------------------------------- |
| `GET /api/state`         |                                          |
| `POST /api/demo/sale`    | `{ artworkId, buyerName, installments }` |
| `POST /api/demo/payment` | `{ saleId, amountCents?, method? }`      |
| `POST /api/demo/cancel`  | `{ saleId }`                             |
| `POST /api/demo/reset`   |                                          |
| `POST /api/agent/read`   | `{ agreementId }`                        |

Errors come back as `{ error }` with status 400.
