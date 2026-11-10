# Rescrow: rules for every Claude session in this repo

Two people, Bradley and Neil, building on the same repo and reviewing each other's work.
The first drafts were split by file (backend vs frontend) so they could be built in parallel without conflicts. That split is retired: either person may edit any file.

## Git, every time

1. `git pull --rebase origin main` before starting and before every push.
2. Larger features go on a branch (for example `big-build`) and are merged to `main` one feature at a time, only when green.
3. Run the gate before pushing: `bash scripts/gate.sh` (lint, typecheck, tests, format check; add `--build` for a production build). CI runs the same script on every push.
4. Run Prettier on the files you touched (`npx prettier --write <files>`), not across the repo.
5. `src/app/api/demo-flow.test.ts` drives the recorded demo through the real routes. If it fails, the demo is broken: fix it or update `docs/demo-script.md` in the same commit.
6. Never force-push `main`.

## Contract rules

- **Pages never re-implement money logic.** They import from `src/lib/**` and `src/types.ts`. Numbers shown on screen (totals, reconciliation, statements) come from pure functions in `src/lib`, never re-computed in a page.
- Changes to shared types are additive where possible, so one person's push can't break the other's build.

## Product rules the code must keep

- All money is integer cents. No floats anywhere near money.
- **Money held for an artist can never move to the gallery's operating balance or to creditors.** It is enforced twice: `releaseTrust()` refuses any destination but the artist or the buyer, and the journal's `ACCOUNT_RULES` refuse any trust debit except `TRUST_TO_ARTIST` / `TRUST_TO_BUYER` through `postTrustRelease()`. Architecture tests pin both; don't add another path out of trust.
- **Every money move goes through the engine and posts a journal entry.** A new money write must be added to the manifest in `src/lib/escrow/architecture.test.ts`, and `reconcile()` must stay balanced (the model test checks it after every random step).
- Every API route returns the full `Snapshot` (`useSnapshot` depends on it). Errors come back as `{ error }` with a 400 status. One deliberate exception: `POST /api/demo/attempt` returns 200, because the refusal is the expected outcome (it is in the activity feed). Don't "fix" it.
- Every route builds its clock with `clockFor(current)` inside `mutate()`, so the demo clock (`T`) keeps events in order. An architecture test enforces it.
- The seed is dated relative to now (`createSeed(now)`); tests call `createSeed()` and get the fixed `SEED_NOW`. Bump `SEED_VERSION` when the seed changes, so old `data/db.json` files are reseeded.
- The demo must run with no network and no Ollama. The agent falls back to saved answers, and the screen labels which source produced the terms.

## Docs

- `README.md`: what it is, how the money is proven, the API.
- `docs/PRD.md`: what we're building, the acceptance test (`docs/demo-script.md`), and the decisions log.
- `docs/demo-script.md`: the recorded script, with optional beats for each key.
- `research/`: topic notes, the domain brief, the idea catalog and the ranked build plans.
- `docs/spec-A-backend.md`, `docs/spec-B-frontend.md`: the first-draft specs (historical).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
