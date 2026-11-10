# Rescrow

Escrow for art galleries, built on Ramp. When a consigned work sells, an agent reads the consignment agreement, works out the artist's share, and locks that share the moment the buyer's money lands in the gallery's Ramp account. The gallery can never spend it. The artist is paid the same day the sale completes, with a statement.

BBS x Ramp Hackathon, build round. Team: Bradley Tsou, Neil Saji, Takenosuke Nagata.

## Run it

```bash
npm install
npm run dev          # http://localhost:3333
```

Demo data lives in `data/db.json` (gitignored) and is created from `src/lib/seed.ts` on first load. `POST /api/demo/reset` (or the Reset button) puts it back.

The agent uses local Ollama (`gpt-oss:20b`) when it is running and falls back to saved answers in `src/lib/seed.ts` when it is not, so the app runs on any laptop.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run format:check
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
