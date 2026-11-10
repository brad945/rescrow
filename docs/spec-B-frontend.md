# Spec B: frontend (Neil)

_Drafted by lane A on Nov 9. Lane B owns this file from here on, so edit it freely._

Lane B owns `src/app/**` except `src/app/api/**`, plus `src/components/**` and `docs/demo-script.md` (table in `CLAUDE.md`). The acceptance test is `docs/PRD.md` §2: your `docs/demo-script.md` plus beat 6.

**Already built:** `/present` (scripted story), `/gallery`, `/artist`, statements, `/demo`, the redesign, agreement highlighting, and tests.

## Asks from lane A (details in `docs/requests-from-A.md`)

1. **Beat 6, the gallery goes under:** a step or key in `/present` that calls `POST /api/demo/insolvency` with `{ galleryId: "gal_lowline" }`, after payment 2. Show:
   - operating balance → creditors
   - trust paid out to Ines
   - the gallery marked insolvent (`gallery.status === "insolvent"`)
2. **"Due by" on held money:** `hold.dueBy` (optional field) is the latest date the artist must be paid under their agreement. "Held for you, paid by Jan 8 at the latest" is a strong line on the artist's phone.
3. **Reconciliation badge:** `reconcile(snapshot, galleryId)` from `@/lib/escrow/reconcile` returns `{ balanced, breaks, … }`. Show "Balances to the cent ✓".
4. **Agent source:** when `terms.confidence === "needs_review"`, show `terms.unverifiedCitations` as quotes the agent gave that aren't in the agreement. `terms.model` names the local model behind a live read.
5. **Money math in `src/lib`:** new numbers come from `src/lib` functions. `src/components/ledger.ts` can stay as it is.

## Rules

- Never edit `src/lib/**`, `src/app/api/**`, `src/types.ts` or package files. Need a field, route or package? Add a line to `docs/requests-from-B.md` and text Bradley.
- Run `git pull --rebase` before every push, then run the full checks.
