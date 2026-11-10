# Consignment and royalty accounting in other industries

Car dealers, luxury resale, record labels, book publishers and talent agents all hold money or goods that belong to someone else. Each industry has had to answer the questions Rescrow faces: how you prove the money is still there, what you may hold back and for how long, and what happens to it when the business fails.

## What we learned

- **Floor plan audits check every financed unit.** A floor plan lender audits a dealer by confirming that each financed vehicle is either still on the lot or was sold and paid off on time. A sold unit with no payoff is first marked "sold and unpaid". If the dealer can't explain it, the unit becomes "sold out of trust" (SOT). [AutoFinance](https://www.autofinance.com/insights/floorplan-audit)
- **An SOT is a distress signal.** Lenders are told the floor plan balance should match the inventory on hand. A confirmed SOT is described as "almost always indicative of massive financial difficulties". The recommended response is to station someone at the dealership and release each title only when that vehicle is paid for. [National Law Review](https://natlawreview.com/article/gone-60-seconds-when-dealerships-go-bad-whats-their-lender-do)
- **Dealers repay fast, and aged stock is paid down on a schedule.** A dealer usually has to repay a unit's draw within a few days of the sale. Units held past a threshold, often around 90 or 120 days depending on the program, owe "curtailment" principal payments. [Corpay](https://www.corpay.com/resources/blog/floor-plan-financing)
- **Curtailments are tracked by days remaining.** Dealers are advised to track how many days each unit has before its next curtailment and to work that list as a weekly queue. When a unit sells, the payoff should be reconciled so sold units don't stay on the floor plan balance. [DealersCloud](https://www.dealerscloud.com/resources/floor-plan-curtailments)
- **Audits do find missing inventory.** In 2026 Toyota Motor Credit sued a Connecticut dealer group after an audit found about $1.4 million of financed vehicles missing from the lot. [Carscoops](https://www.carscoops.com/2026/04/toyota-credit-dealer-lawsuit/)
- **California has a statutory trust rule for talent agencies.** Under Cal. Labor Code §1700.25, money an agency receives for an artist goes immediately into a trust account. It must be paid out, minus commission, within 30 days. The agency must keep a separate record of each artist's funds. Disputed funds stay frozen in trust until the dispute is resolved. A willful late payment can cost 10% annual interest plus attorney's fees. [§1700.25](https://california.public.law/codes/labor_code_section_1700.25)
- **The same statute allows an offset.** An agency may hold funds past 30 days to offset a past-due debt the artist owes the agency. That is a path from client money to the business, the kind of path Rescrow deliberately leaves out. [§1700.25](https://california.public.law/codes/labor_code_section_1700.25)
- **Sports agents can't mix funds.** The MLBPA's agent rules require detailed records of all money received for and paid out of a player's account. They forbid commingling the player's funds with the agent's own money or with money held for others. [MLBPA agent regulations (PDF)](https://www.agent.mlbplayers.com/_files/ugd/4d23dc_9476aa4eda764e419a68197c94c5c0f1.pdf)
- **The NFLPA enforces its own rules.** It revoked a contract advisor's certification for 36 months for misappropriating a former client's funds. [NFLPA](https://www.nflpa.com/news/nflpa-committee-on-agent-regulation-and-discipline-revokes-contract-advisor-josh-hare-s-certification-for-36-months)
- **Publishers hold back a "reserve against returns".** Bookstores can return unsold copies, so publishers keep part of each royalty period's earnings. Actual returns are charged against the reserve, and what is left is released in later periods. Ebooks have no physical returns, so practitioners argue they should carry no reserve. [Steve Laube Agency](https://stevelaube.com/r-is-for-reserve-against-returns), [Kernochan Center, Columbia Law](https://kernochan.law.columbia.edu/content/about-royalty-statements)
- **The Authors Guild has recommendations for statements and reserves.** These are its recommendations, not law:
  - a statement should list units sold and returned, list and net price, rate, the reserve withheld and itemized deductions;
  - reserves should be capped at about 20% and expire after about a year;
  - payment should be quarterly;
  - authors should be able to audit six years back;
  - the publisher should pay for the audit if it finds an error of 5% or more.

  [Authors Guild](https://www.authorsguild.org/industry-advocacy/publishers-payment-and-accounting-practices-need-to-k)

- **Statements often drift from the contract.** Common problems are standard forms that still use the old rate or reserve after a renegotiation, unjustified deductions, and undisclosed discounted or free units. [Kernochan Center](https://kernochan.law.columbia.edu/content/about-royalty-statements)
- **Record labels recoup advances from royalties.** A label recovers advances and recoupable costs from the artist's royalty share before the artist is paid anything. Cross-collateralization lets a hit album pay down an earlier album's unrecouped balance. In one worked example, a $60,000 debt at $2 per album takes 30,000 sales to clear. [Soundcharts](https://soundcharts.com/en/blog/what-is-recoupment)
- **When a retailer fails, consignors can lose to its creditors.** Under UCC §9-319, a consignor who hasn't filed a UCC-1 can lose to the consignee's creditors, because the consignee is treated as having the consignor's rights while it holds the goods. In the Sports Authority Chapter 11 (about $84.8M of consigned goods), the debtor treated unperfected consignors as general unsecured creditors. The court ruled for the consignors under the exception for a retailer that creditors "generally know" sells others' goods. Practitioners warn not to count on that exception. [Lowenstein Sandler](https://www.lowenstein.com/news-insights/publications/articles/do-not-take-consignments-lightly-k-rosen)
- **A separate Sports Authority ruling covered sale proceeds.** The court held that "goods" in §9-319(a) includes the proceeds of those goods, so Article 9 priority rules govern the money too. [Patterson Belknap](https://www.pbwt.com/bankruptcy-update-blog/an-unresolved-issue-at-the-intersection-of-consignment-and-bankruptcy-law-decided)
- **Luxury resale runs on long consignment windows.** The RealReal's returns page describes a consignment window of about 365 days. A consignor who pulls an item early pays a per-item fee, which is higher for fine art. Published payout schedules from outside guides disagree with each other, so we don't rely on any of them. [The RealReal returns](https://therealreal.com/returns)

## How it applies to Rescrow

- **Rescrow already enforces the floor plan's "sold means paid" rule.** In a floor plan, a sold car must be paid off within days. In Rescrow, a received payment must produce a matching hold in the same operation. The floor plan audit (find sold units with no payoff) translates directly into an audit Rescrow can run on itself every time, not monthly.
- **§1700.25 is close to a spec of our payout rule.** It has an immediate trust deposit, a per-artist record and a payout deadline, which maps to `dueBy`. It adds two ideas Rescrow doesn't have yet: a dispute freeze and interest on late payment. It also contains an offset exception. Rescrow should refuse offsets on purpose, and say so.
- **Recoupment and cross-collateralization are what Rescrow refuses to do.** Every one of these industries lets the intermediary net what the creator owes against what the creator earned. Rescrow's trust guard turns that into a thrown error, and that can be shown on screen and tested.
- **A reserve against returns is a held amount with a release date.** It fits the existing `EscrowHold` model as a second release condition that still lives inside trust. It can't push a payout past the agreement's deadline unless the agreement says so.
- **The UCC consignment rules explain beat 6.** Creditors win when the consignor's interest is invisible. Rescrow makes it visible twice: trust money sits in a separate account, and unsold consigned works are recorded as the artist's property. Insolvency can return both to the artists.

## Feature ideas

### Sold-out-of-trust audit

- What: A pure `auditTrust(snapshot)` function, modeled on a floor plan audit, that walks every `IncomingPayment` on an open or paid sale. For each payment it checks four things:
  - a hold exists for that payment;
  - the hold is for exactly `shareOf(amount, sale.artistShareBps)`;
  - the hold's status is consistent with the sale's status;
  - any paid hold appears in exactly one `Payout.holdIds`.

  It returns a list of exceptions, using floor plan wording such as "sold and unpaid" and "amount mismatch". An "Audit" panel on `/present` shows "0 exceptions across N payments". A test seeds a deleted hold and a short-changed hold and asserts that both are flagged.

- Why judges care: An independent check that the payment-to-hold mapping is complete adds a second proof alongside the `reconcile()` total.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is read-only and can't change any balance.
- Grounding: [AutoFinance](https://www.autofinance.com/insights/floorplan-audit), [National Law Review](https://natlawreview.com/article/gone-60-seconds-when-dealerships-go-bad-whats-their-lender-do), from the codebase (`Payout.holdIds`, `shareOf`)

### Trust offset refusal ("no recoupment")

- What: Add an explicit `offsetAgainstTrust(artistId, amount, reason)` path that always throws `EscrowError("trust funds cannot offset artist debts")`. It is wired to a demo key that has the gallery try to recover a $400 framing bill from Ines's held share.
  - The rejection is written to the activity log as a new kind, `trust_offset_refused`.
  - Tests cover offsetting the same artist's hold, cross-collateralizing one artwork's hold against another artwork's cost, and a hold belonging to a different artist. All three must throw and leave the snapshot unchanged.
  - The legitimate place for a deduction such as framing is the split itself, before the money lands in trust. This matches the tier 2 framing idea in the PRD.
- Why judges care: The demo shows on screen that what talent agency law and record deals allow is impossible in Rescrow by construction.
- Demo visibility: both
- Effort: S
- Demo risk: low. The call fails by design, and the reset key restores state.
- Grounding: [§1700.25](https://california.public.law/codes/labor_code_section_1700.25) (offset exception), [Soundcharts](https://soundcharts.com/en/blog/what-is-recoupment) (cross-collateralization), from the codebase (`releaseTrust`)

### Unsold works go home on insolvency

- What: Extend `declareInsolvency` so every artwork with status `consigned` at an insolvent gallery is set to `returned`. Each one gets an activity line such as "Work returned to the artist, not gallery property". The insolvency screen then shows two columns: what creditors took (operating cash only) and what went back to artists (trust money and unsold works by title). Tests assert that no consigned artwork stays attached to an insolvent gallery and that `reconcile` is unchanged, since no money moves.
- Why judges care: It addresses the actual failure behind the Sports Authority fight, where consigned goods themselves were claimed by creditors. It does this with a small, safe change.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It changes only artwork status, and the UI already knows the `returned` status.
- Grounding: [Lowenstein Sandler](https://www.lowenstein.com/news-insights/publications/articles/do-not-take-consignments-lightly-k-rosen), from the codebase (`ArtworkStatus`)

### Dispute freeze

- What: Add a hold status `disputed`, which still counts as trust. `releaseTrust` refuses a disputed hold in both directions: to the artist and to the buyer. A deadline sweep skips disputed holds and logs why. A `resolveDispute(holdId, to)` call is then the only exit, and it goes through `releaseTrust`. Trust holds every state except `paid` and `refunded`, so the identity is unchanged. A test proves a disputed hold survives `releaseDueHolds` past `dueBy` and still reconciles.
- Why judges care: It copies a real statutory rule: disputed funds stay in trust and are unusable until resolved.
- Demo visibility: both
- Effort: M
- Demo risk: med. It touches the deadline sweep, which the main demo path depends on.
- Grounding: [§1700.25](https://california.public.law/codes/labor_code_section_1700.25)

### Hold aging ladder

- What: A view modeled on the curtailment queue that lists every locked hold with its days remaining until `dueBy`, sorted by urgency and bucketed as overdue, due within 7 days, due within 30 days, and later. It is computed purely from the injected `Clock`, so tests can freeze time and assert the buckets. On the gallery dashboard it reads like a lender's aging report: what the gallery must pay out and when.
- Why judges care: It makes the deadline rule visible as an operational tool, the way dealers track floor plan obligations, instead of a hidden field.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It is a derived view with no writes.
- Grounding: [DealersCloud](https://www.dealerscloud.com/resources/floor-plan-curtailments), [Corpay](https://www.corpay.com/resources/blog/floor-plan-financing), from the codebase (`dueBy`, `Clock`)

### Missed-deadline interest

- What: If `releaseDueHolds` runs after a hold's `dueBy`, for example because the server was down over a weekend, the payout adds simple interest. The interest is computed in integer cents from whole days late at a rate taken from the agreement's saved answer. The demo default is 10% a year, copying §1700.25.
  - The interest is paid from operating to the artist as its own line in the payout, so operating goes down and paid goes up by the same amount. The identity still balances.
  - Tests use a frozen clock 3 days past `dueBy` and check the exact cents and the reconciliation.
- Why judges care: It handles the "what if your scheduler is late" question with a real legal remedy and cent-exact arithmetic.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. The happy-path demo never runs late, so this code doesn't run on camera.
- Grounding: [§1700.25](https://california.public.law/codes/labor_code_section_1700.25), from the codebase (`releaseDueHolds`, `Clock`)

### Return-window reserve

- What: The agreement's saved answer can include `returnWindowDays` and `reserveBps`, both with citation checks. When a sale completes, everything except the reserve is paid out the same day. The reserve stays as a `reserved` hold, still in trust, until the window closes, then pays out. If the buyer returns the work, the reserve refunds through `releaseTrust(to: buyer)`.
  - The reserve release date is `min(windowEnd, dueBy)`, so a reserve can never push payment past the agreement's deadline.
  - When an agreement has no return clause, there is no reserve, just as ebooks carry no reserve against returns.
- Why judges care: It brings over a real and widely criticized publishing practice, bounded so it can't become an indefinite withholding.
- Demo visibility: both
- Effort: M
- Demo risk: med. Turning it on for Ines would contradict the "paid the same day" line, so it should demo on a second artist.
- Grounding: [Steve Laube Agency](https://stevelaube.com/r-is-for-reserve-against-returns), [Authors Guild](https://www.authorsguild.org/industry-advocacy/publishers-payment-and-accounting-practices-need-to-k), [Kernochan Center](https://kernochan.law.columbia.edu/content/about-royalty-statements)

### Royalty-grade artist statement

- What: A statement modeled on the Authors Guild's list of what a statement should show. Per sale it shows:
  - price and agreed split, with the clause quote;
  - each payment received;
  - the artist share locked;
  - anything withheld, with the reason and release date;
  - paid out, refunded, and the closing balance.

  Statements are generated for a period. A test asserts that each period's closing balance equals the next period's opening balance and that the sum of periods equals `artistTotals`.

- Why judges care: Statement errors usually come from the statement drifting from the contract. Here every line traces to a hold and a cited term.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a read-only render of existing data.
- Grounding: [Authors Guild](https://www.authorsguild.org/industry-advocacy/publishers-payment-and-accounting-practices-need-to-k), [Kernochan Center](https://kernochan.law.columbia.edu/content/about-royalty-statements), from the codebase (`artistTotals`)

### Per-artist sub-ledger proof

- What: Following the "separate record for each artist" rule in §1700.25 and the MLBPA no-commingling rule, add `trustByArtist(snapshot)` and a property test. Over randomized sequences of sale, payment, cancel and insolvency, the per-artist balances must always be non-negative and must sum exactly to the gallery's trust total. No hold may ever change `artistId`. The UI shows trust as a stacked bar split by artist.
- Why judges care: It proves that money held for one artist is never used for another, the commingling failure sports and talent regulators look for.
- Demo visibility: both
- Effort: M
- Demo risk: low. The test runs offline, and the bar is a derived view.
- Grounding: [§1700.25](https://california.public.law/codes/labor_code_section_1700.25), [MLBPA agent regulations (PDF)](https://www.agent.mlbplayers.com/_files/ugd/4d23dc_9476aa4eda764e419a68197c94c5c0f1.pdf)

### Inventory audit (wall vs books)

- What: Modeled on the floor plan physical count. Each consigned artwork must be in exactly one of three states:
  - on hand (`consigned` with no open sale);
  - sold, with payments and holds that match the sale;
  - returned.

  An `inventoryAudit` function lists works in an impossible state, such as `sold` with no sale record, or `consigned` with a paid sale. A test injects each bad state and asserts it is reported.

- Why judges care: It extends the books-match-reality check from cash to the art itself, which is where dealer frauds like the missing Toyota units are found.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is read-only.
- Grounding: [Carscoops](https://www.carscoops.com/2026/04/toyota-credit-dealer-lawsuit/), [National Law Review](https://natlawreview.com/article/gone-60-seconds-when-dealerships-go-bad-whats-their-lender-do)

### Public consignment register

- What: A read-only `/register/[galleryId]` page listing every work the gallery holds on consignment, the consigning artist, and the current trust balance per artist. It gives creditors and lenders a standing notice of what is not the gallery's property. It is generated from the Snapshot and prints cleanly.
- Why judges care: Under the UCC, consignors win when creditors "generally know" the goods aren't the retailer's. This makes that knowledge a URL.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It is a static view of existing data.
- Grounding: [Lowenstein Sandler](https://www.lowenstein.com/news-insights/publications/articles/do-not-take-consignments-lightly-k-rosen), [Patterson Belknap](https://www.pbwt.com/bankruptcy-update-blog/an-unresolved-issue-at-the-intersection-of-consignment-and-bankruptcy-law-decided)

### Distress early warning

- What: A lender-style watchlist computed from the Snapshot. It flags three conditions:
  - operating cash below the commission the gallery would have to refund if open sales cancelled;
  - any audit exception;
  - a sharp drop in operating balance.

  Before beat 6, the gallery header turns amber ("Lender watch: operating cash covers 0.4x refund exposure"). Thresholds are constants and covered by tests.

- Why judges care: Floor plan lenders treat audit trouble as the first sign of distress. This shows Rescrow sees insolvency coming and trust is safe anyway.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med. The ratio has to read clearly in about 3 seconds of screen time, or it adds noise.
- Grounding: [AutoFinance](https://www.autofinance.com/insights/floorplan-audit), [National Law Review](https://natlawreview.com/article/gone-60-seconds-when-dealerships-go-bad-whats-their-lender-do)
