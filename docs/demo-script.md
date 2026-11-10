# Rescrow demo video script

Target length: 2:30. Hard cap 3:00.

## Before you record

1. Make sure Ollama is running (`ollama serve`) and `gpt-oss:20b` is pulled. Then `npm run build && npm start` and open `http://localhost:3333/present` in Chrome. Leave it on the title card for 30 seconds; it loads the model in the background so the read on camera takes about 11 seconds instead of 20. The model needs about 13 GB of memory. Quit CapCut, extra browsers and any other dev servers first: with the Mac swapping, reads stalled for over a minute and fell back to the saved answer (the screen says so, and the demo keeps working, but you lose the live moment). Do one full dry run before recording. If the read ever takes more than about 15 seconds, cut the wait in editing.
2. Press `R` to reset. You should see the title card with the Stephen Friedman quote.
3. Browser zoom 125%, window 1440 x 900 or larger, hide bookmarks bar, turn on Do Not Disturb.
4. Record at 1080p with clicks shown (QuickTime or Screen Studio).
5. Drive everything with the keyboard: `→` next step, `G` gallery tries to spend trust, `T` jump the demo clock 61 days, `D` the bank feed redelivers the last wire, `B` gallery goes under, `C` buyer cancels, `R` reset.
6. Record the voice separately if the room is loud, then lay it over. Add captions; judges often watch muted.

## Script

Every line below is said over the screen named next to it. Read it out loud once before recording and change any word that doesn't sound like you.

### 0:00 to 0:15, the hook (title card on screen)

> In February, Stephen Friedman Gallery in London went into administration owing Kehinde Wiley a hundred and sixty three thousand pounds. Creditors expect about eight pence on the pound. That money was supposed to be his.

### 0:15 to 0:35, the problem (press `→`, the agreement appears)

> When a gallery sells a consigned painting, about half the price belongs to the artist. In New York that money is legally held in trust for the artist. But nothing makes the gallery keep it separate, so it lands in the same account as rent and payroll, and the artist waits months. If the gallery fails, it's gone.

### 0:35 to 1:00, the agent (press `→`, let it run)

> Rescrow is escrow for galleries, built on Ramp. First, our agent reads the consignment agreement. That's gpt-oss running locally on this laptop, so the contract never leaves the gallery. You're watching it write its answer.

When the checks appear:

> But we don't trust the model. Every number has to come with the exact clause it came from, and Rescrow checks that the clause is really in the contract and really states that number. These highlights are the verified quotes. If a number can't be traced, a person has to confirm it before any money moves.

Cut the wait in editing if the read takes longer than about 10 seconds.

### 1:00 to 1:45, the money (press `→` four times, pausing on each)

`→` Collector buys it:

> A collector buys Orchard in Rain for twenty four thousand dollars, in three payments.

`→` First wire:

> The first wire lands in the gallery's Ramp account. In the same second, Ines's half moves to a separate Ramp checking account that holds artist trust money. The gallery's half goes to operating. On the right is what Ines sees on her phone.

`→` Second payment:

> Buyers pay late, pay in installments, sometimes back out. The lock covers that gap, however long it is.

Optional, about 10 seconds. Press `G` here, before the final wire:

> Watch the gallery try to pay its rent out of the eight thousand held for Ines. Refused, with the reason, on her phone. Not a cent moved.

Optional, about 5 seconds. Press `D` after any payment:

> Ramp's banking API has no deposit webhook, so Rescrow polls, and overlapping polls return a wire it has already seen. It recognises the transaction id and books nothing.

`→` Final wire:

> Last payment. The sale is complete, so Rescrow pays Ines out of the trust the same day, with a statement. Her agreement gave the gallery sixty days. She got paid the day the buyer finished paying.

### Optional separate take: the deadline (press `R`, `→` until payment 1 lands, then `T`)

Record this as its own clip if there is time; it doesn't mix with the insolvency take (the `B` button hides once the clock has moved).

> Buyers don't always finish paying. Sixty-one days later this one still owes two payments. Ines's agreement says each share is due within sixty days of the payment that funded it, so Rescrow pays her four thousand dollars out of trust on the deadline anyway. Theo's fourteen-day share on another sale goes out on its own deadline too.

`R` puts the demo clock back to today.

### 1:45 to 2:05, the gallery goes under (second take: `R`, `→` until payment 2 lands, then `B`)

Record this as a second take and cut it in. It pays off the hook.

> Now the worst case. Lowline Gallery goes under. Creditors take every dollar in operating, the same way Stephen Friedman's did. But the eight thousand dollars held for Ines was never the gallery's. Rescrow pays it out of trust straight to her. Same failure. This time the artist gets paid. And the books still balance to the cent.

Optional, about 6 seconds, if it fits:

> Without a separate account, all sixty thousand would be one balance in the administrator's hands, and Ines would need a court to get her eight thousand back.

(Computed from the same events: operating plus trust at the moment of failure. It doesn't claim what a court would award.)

Optional, if there's time: `R`, run to payment 1, press `C` for the buyer cancelling. The artist's share goes back to the buyer straight from trust.

### Optional, 5 seconds: the accountant's view (open `/books`)

> The gallery's accountant gets the same books. Trust is restricted cash against what's owed to artists, never revenue, and the trial balance and trust tie-out come straight from the journal. The grid shows where money may go: trust can only reach the artist or the buyer.

### 2:00 to 2:20, how it works (cut to the code)

Show `src/lib/agent/verify.ts` for a few seconds, then `artistShareOfPayment` in `src/lib/escrow/engine.ts`, then the tests running.

> Two pieces do the real work. The verifier keeps the model honest, and the ledger engine keeps the money exact. The artist's cut of each installment is rounded on the running total, so three payments of a third always add up to exactly the artist's share, to the cent. We check that against three hundred random sales on every commit, along with a rule that every dollar received ends up in exactly one place.

### 2:20 to 2:35, why Ramp, and what's next (back to the gallery page)

> Ramp already holds the gallery's money and already has agents that read contracts. Rescrow adds the missing piece: money that's conditionally held against an agreement. Today the bank feed is simulated. Next is polling Ramp's banking transactions API and paying artists through Ramp transfers.

## Facts used above, with sources

- Stephen Friedman Gallery entered administration on 2 February 2026. Filings list Kehinde Wiley as owed £163,849. Unsecured creditors are estimated to recover 8 to 9 pence per pound. The Art Newspaper, 30 April 2026.
- NY Arts and Cultural Affairs Law section 12.01: consigned work is trust property and sale proceeds are trust funds for the artist, not subject to claims of the gallery's creditors. It does not require a separate account or set a payment deadline. nysenate.gov/legislation/laws/ACA/12.01
- Ramp lets a business open more than one Ramp Checking Account. The Developer API exposes banking accounts and banking transactions, read only, with no deposit webhook. docs.ramp.com

Do not say galleries are closing at a record pace. The 2026 Art Basel and UBS report found more openings than closures.

## If judges ask "is the AI real?"

Open `/lab`, pick "No deadline", press Read with agent. It's a letter that splits proceeds "equally" but never sets a payout date. The agent reads it live, gets the 50% right, and the verifier flags the missing deadline for a person instead of guessing. Then paste any agreement they hand you.
