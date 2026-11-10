# Rescrow demo video script

Target length: 2:30. Hard cap 3:00.

## Before you record

1. `npm run dev`, open `http://localhost:3333/present` in Chrome.
2. Press `R` to reset. The screen should say "Step 1 of 6, A new consignment".
3. Browser zoom 125%, window 1440 x 900 or larger, hide bookmarks bar, turn on Do Not Disturb.
4. Record at 1080p with clicks shown (QuickTime or Screen Studio). Turn off the Next.js dev badge by recording from `npm run build && npm start` instead of `npm run dev`.
5. Drive everything with the keyboard: `→` next step, `C` buyer cancels, `R` reset.
6. Record the voice separately if the room is loud, then lay it over. Add captions; judges often watch muted.

## Script

Every line below is said over the screen named next to it. Read it out loud once before recording and change any word that doesn't sound like you.

### 0:00 to 0:15, the hook (title card or the present page at step 1)

> In February, Stephen Friedman Gallery in London went into administration owing Kehinde Wiley a hundred and sixty three thousand pounds. Creditors expect about eight pence on the pound. That money was supposed to be his.

### 0:15 to 0:35, the problem (present page, step 1, agreement on screen)

> When a gallery sells a consigned painting, about half the price belongs to the artist. New York law already says that money is held in trust for the artist. But nothing makes the gallery keep it separate, so it lands in the same account as rent and payroll, and the artist waits months to be told what they're owed. If the gallery fails, the money is gone.

### 0:35 to 0:55, the agent (press `→`)

> Rescrow is escrow for galleries, built on Ramp. When an artist consigns work, our agent reads the consignment agreement. It pulls the split and the payout window, and it has to quote the exact clause for every number, highlighted here. If it can't quote it, we don't use it.

### 0:55 to 1:45, the money (press `→` four times, pausing on each)

`→` Collector buys it:

> A collector buys Orchard in Rain for twenty four thousand dollars, in three payments.

`→` First wire:

> The first wire lands in the gallery's Ramp account. In the same second, Ines's half moves to a separate Ramp checking account that holds artist trust money. The gallery's half goes to operating. On the right is what Ines sees on her phone.

`→` Second payment:

> Buyers pay late, pay in installments, sometimes back out. The lock covers that gap, however long it is.

`→` Final wire:

> Last payment. The sale is complete, so Rescrow pays Ines out of the trust the same day, with a statement. Her agreement gave the gallery sixty days. She got paid the day the buyer finished paying.

### 1:45 to 2:00, the edge case (press `R`, then `→` three times, then `C`)

Optional. Cut this if you're over time.

> And if the buyer cancels halfway, the artist's share goes back to the buyer straight from trust. The gallery never had it, so it can't have spent it.

### 2:00 to 2:20, how it works (cut to the code)

Show `src/lib/escrow/engine.ts`, the `artistShareOfPayment` function, then `src/lib/escrow/invariants.test.ts` running.

> The core is a small ledger engine. The artist's cut of each installment is rounded on the running total, so three payments of a third always add up to exactly the artist's share, to the cent. We check that against three hundred random sales on every commit, along with a rule that every dollar received ends up in exactly one place.

### 2:20 to 2:35, why Ramp, and what's next (back to the gallery page)

> Ramp already holds the gallery's money and already has agents that read contracts. Rescrow adds the missing piece: money that's conditionally held against an agreement. Today the bank feed is simulated. Next is polling Ramp's banking transactions API and paying artists through Ramp transfers.

## Facts used above, with sources

- Stephen Friedman Gallery entered administration on 2 February 2026. Filings list Kehinde Wiley as owed £163,849. Unsecured creditors are estimated to recover 8 to 9 pence per pound. The Art Newspaper, 30 April 2026.
- NY Arts and Cultural Affairs Law section 12.01: consigned work is trust property and sale proceeds are trust funds for the artist, not subject to claims of the gallery's creditors. It does not require a separate account or set a payment deadline. nysenate.gov/legislation/laws/ACA/12.01
- Ramp lets a business open more than one Ramp Checking Account. The Developer API exposes banking accounts and banking transactions, read only, with no deposit webhook. docs.ramp.com

Do not say galleries are closing at a record pace. The 2026 Art Basel and UBS report found more openings than closures.
