# Rescrow: rules for every Claude session in this repo

Two people, two lanes, built in parallel, pushing straight to `main`.
**Lane A (backend) = Bradley. Lane B (frontend) = Neil.**
Before doing anything, ask which lane you are in if you haven't been told.

The rule that keeps `main` conflict-free: **the two lanes never edit the same files.**
If a file is not in your lane, do not edit it, format it or rename it, even to fix a typo.

## Who owns which files

| Path                                                                                                                         | Lane |
| ---------------------------------------------------------------------------------------------------------------------------- | ---- |
| `src/types.ts`                                                                                                               | A    |
| `src/lib/**` (agent, escrow, ramp, store, seed, money, api helpers)                                                          | A    |
| `src/app/api/**`                                                                                                             | A    |
| `scripts/**`                                                                                                                 | A    |
| `package.json`, `package-lock.json`                                                                                          | A    |
| Config: `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.*`, `postcss.config.mjs`, `.prettier*`, `.gitignore` | A    |
| `README.md`, `CLAUDE.md`, `docs/PRD.md`, `docs/spec-A-backend.md`, `docs/requests-from-A.md`                                 | A    |
| `src/app/**` except `src/app/api/**` (pages, `layout.tsx`, `globals.css`, `page.tsx`)                                        | B    |
| `src/components/**`                                                                                                          | B    |
| `docs/spec-B-frontend.md`, `docs/requests-from-B.md`, `docs/demo-script.md`                                                  | B    |

A new file belongs to the lane that owns the folder it goes in.

## Crossing lanes without editing each other's files

- **B needs a new field, type, route or package:** add a line to `docs/requests-from-B.md` (B owns that file) and text Bradley. A ships it. B never edits `src/types.ts` or `package.json`.
- **A needs a UI change:** add it to `docs/requests-from-A.md` and text Neil.
- **B uses A's logic by importing it.** B may import anything from `src/lib/**` and `src/types.ts`. Importing is not editing. Numbers shown on screen (totals, reconciliation, statements) come from pure functions in `src/lib`, never re-computed in a page.
- **Changes to the contract are additive only.** A adds fields and routes but never renames or removes one B already uses. That way a push from A can't break B's build.

## Git, every time

1. `git pull --rebase origin main` before starting and before every push.
2. Small commits that touch only your lane's files. Run `git status` before committing; if a file from the other lane shows as modified, revert it (`git checkout -- <file>`), don't commit it.
3. Run the checks before pushing: `npm run lint && npm run typecheck && npm test && npm run format:check`. Run Prettier on your own files only (`npx prettier --write <your files>`), never `npm run format` across the repo.
4. Push. If a push is rejected, pull with rebase again. Since the lanes don't overlap, the rebase is clean.
5. Never force-push `main`.

## Product rules the code must keep

- All money is integer cents. No floats anywhere near money.
- **Money held for an artist can never move to the gallery's operating balance or to creditors.** The ledger enforces this by throwing an error, not just by convention (see `docs/spec-A-backend.md`).
- Every API route returns the full `Snapshot` (B's `useSnapshot` depends on it). Errors come back as `{ error }` with a 400 status.
- The demo must run with no network and no Ollama. The agent falls back to saved answers, and the screen labels which source produced the terms.

## Docs

- `docs/PRD.md`: what we're building, the acceptance test (Neil's `docs/demo-script.md` + the insolvency beat), and the decisions log.
- `docs/spec-A-backend.md`: lane A's spec and plan, hour by hour.
- `docs/spec-B-frontend.md`: lane B's spec and plan, hour by hour.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
