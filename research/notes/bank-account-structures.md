# Bank account structures for client money

FBO and custodial accounts, segregated trust accounts, bankruptcy remoteness, sweep and placement networks, interest on held funds, FDIC pass-through insurance, and the UK client money rules (CASS).

## What we learned

- FDIC pass-through coverage needs three things: the principal actually owns the funds, the bank's account title shows the agency relationship (for example "XYZ Company as Custodian for ..."), and records identify each principal and their share. If any of these is missing, the whole balance is insured to the account holder, added to its other deposits, up to $250,000. [FDIC, Pass-through deposit insurance coverage](https://www.fdic.gov/resources/deposit-insurance/diguidebankers/pass-through/index.html)
- Pass-through is not its own ownership category. A principal's share is added to that principal's other deposits at the same bank in the same category. The records may be kept by the third party that deposited the funds; the bank does not have to keep them. [FDIC, Pass-through deposit insurance coverage](https://www.fdic.gov/resources/deposit-insurance/diguidebankers/pass-through/index.html)
- When there are several layers of agents (an agent holding for an agent holding for the owner), each layer has to be disclosed for coverage to reach the real owner. [12 CFR 330.5](https://www.ecfr.gov/current/title-12/chapter-III/subchapter-B/part-330/section-330.5)
- After Synapse failed, the FDIC proposed (September 2024) that banks holding custodial accounts keep one record per beneficial owner, with the owner's balance and ownership category in a fixed file layout. Those records would be reconciled at least at close of business each day, and the bank would keep access even if the third-party record keeper goes bankrupt. The proposal exempts trust and IOLTA accounts. We did not confirm whether it became final. [Federal Register, Recordkeeping for Custodial Accounts, proposed rule](https://www.govinfo.gov/content/pkg/FR-2024-10-02/html/2024-22565.htm)
- Synapse's partner banks held about $180M in demand and FBO accounts while end users were owed $265M, an $85M gap. The trustee said the cause was "not known at this time", and there was no money left to pay for a forensic trace. [Banking Dive](https://bankingdive.com/news/synapse-85-million-shortfall-partner-banks-mcwilliams/718796)
- An FBO account lets a company hold money for its users without taking ownership of it. The company's own ledger of each user's balance is the part that has to be right, and the setup depends on the sponsor bank continuing to support the program. [Modern Treasury, Are FBOs risky?](https://moderntreasury.com/questions/are-fbos-risky); [Treasury Prime, dedicated vs umbrella FBO accounts](https://www.treasuryprime.com/blog/fbo-accounts)
- Ramp's own Operating Account works like this. It is a pooled stored-value wallet at JPMorgan Chase, owned by Ramp Payments Corp, with a separate Ramp ledger for each customer. It carries up to $250,000 of pass-through FDIC coverage (no IntraFi), and JPMorgan Chase pays interest monthly into customer accounts. [Ramp Support, Operating Account overview](https://support.ramp.com/hc/en-us/articles/50843412544531-Ramp-Operating-Account-Overview)
- Placement networks such as IntraFi raise insurance by placing no more than the FDIC limit at each partner bank, usually as reciprocal swaps. The depositor can exclude banks where it already holds money, so coverage is not doubled up at one bank. [Increase, How depository placement networks provide extended FDIC coverage](https://increase.com/articles/how-depository-placement-networks-provide-extended-fdic-coverage)
- In US bankruptcy, property the debtor holds only as legal titleholder enters the estate "only to the extent of the debtor's legal title" (11 U.S.C. 541(d)). That is why trust money stays out of the creditors' pool. [11 U.S.C. 541, Cornell LII](https://www.law.cornell.edu/uscode/text/11/541); [Begier v. IRS, 496 U.S. 53](https://www.law.cornell.edu/supremecourt/text/496/53)
- Once trust money is mixed into an operating account, courts often use the lowest intermediate balance rule. The beneficiary can recover only the lowest balance the account reached after the mix, later deposits do not refill it, and a balance that dropped to zero means nothing can be traced. [Turley v. Mahan & Rowsey (10th Cir. 1987)](https://law.counselstack.com/opinion/turley-v-mahan-rowsey-inc-ca10-1987); [Texas Comptroller v. Weathers (5th Cir. 2001)](https://law.counselstack.com/opinion/texas-comptroller-v-weathers-ca5-2001); [In re Larson (Bankr. W.D. Wis. 1997)](https://www.wiwb.uscourts.gov/sites/wiwb/files/opinions/1997_Larson-Woods.pdf)
- Who earns interest on held funds is a real rule, not a detail. US lawyers pool client funds that are nominal or held only briefly in IOLTA accounts, and the interest goes to legal aid, not to the client. Larger or longer-held funds go in a separate account that pays the client. The Supreme Court upheld this because the client could not have earned net interest anyway. [Wikipedia, IOLTA](https://en.wikipedia.org/wiki/IOLTA); [South Carolina Appellate Court Rule 412](https://www.courtrules.net/south_carolina/south-carolina-appellate-court-rules/rule-412)
- UK CASS 7.15.29R: if the daily internal client money reconciliation shows a shortfall, the firm must fund it from its own money by close of business that day. An excess must be moved out to a non-client account. A gap found against the bank statement is covered with the firm's money until it is resolved (CASS 7.15.32R). [TISA CASS Best Practice Guide v1.7](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)
- The same guide says that while a discrepancy is being investigated, the firm assumes the figure higher in the client's favour is correct. It says the funding requirement should be understood "to the nearest 1p", and a temporary shortfall is "never permitted, even intra-day". [TISA CASS Best Practice Guide v1.7](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)
- "Prudent segregation" lets a firm pay its own money into the client account as a buffer against a known risk. If the firm fails, that money stays client money and covers shortfalls. [TISA CASS Best Practice Guide v1.7](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)
- When a UK firm fails (a "primary pooling event"), all client money is pooled and paid out pro rata to each client's entitlement as of that date. Money received after the event is kept out of that pool. Firms must keep a resolution pack (accounts, reconciliations, contacts) that an administrator can retrieve within 48 hours. [FD Capital, Client money distribution on insolvency](https://www.fdcapital.co.uk/client-money-distribution-cass-insolvency/); [FCA Handbook CASS 7A](https://handbook.fca.org.uk/handbook/cass7a); [FCA Handbook CASS 10A](https://handbook.fca.org.uk/handbook/CASS/10A)
- Under CASS, the bank must give a written acknowledgement that the money in a client account is held on trust and is not the firm's asset in an insolvency. Firms review these letters periodically (CASS 7.18.12R), and auditors flag accounts that were opened or changed without an updated letter. [FD Capital, CASS audits in 2026](https://www.fdcapital.co.uk/cass-audits-2026-frc-standards/); [TISA CASS Best Practice Guide v1.7](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)

## How it applies to Rescrow

- Rescrow's trust hold is an FBO-style account: the gallery holds title as trustee, and Rescrow's ledger of holds per artist is what makes it a trust in practice. What saves the artist in bankruptcy is the title plus the per-artist records (541(d), FDIC pass-through), not the label alone.
- On Ramp the structure would be two tiers: Ramp pools customer funds at JPMorgan Chase, and the gallery's trust account sits inside that as an artist trust. Each tier has to be disclosed for FDIC coverage to reach the artist. The code can model and test this.
- Synapse is the failure Ramp engineers will think of: what if Rescrow's own records are wrong or Rescrow goes away? The FDIC proposal's answer is one record per beneficiary, reconciled to the bank daily, and readable without the middleman. Rescrow already reconciles to the cent, so this is a short step.
- `reconcile()` proves the totals add up. CASS adds a second, stricter check: trust requirement (open holds) against trust resource (the trust account's real balance), every day and at every step in between, with any shortfall made up from operating.
- Interest on trust money is currently ignored. A per-agreement rule for who earns it (artist, pooled, or none) would close a gap that real trust accounts have to answer.
- The insolvency beat assumes trust covers every hold exactly. Pro rata pooling and the lowest intermediate balance rule describe what happens when it does not, and what would have happened without segregation.

## Feature ideas

### Trust account titling and pass-through check

- What: Give each `Account` a `title` (e.g. "Gallery X as trustee for consigned artists"), a `custodyChain` listing each layer (Ramp Payments Corp, then gallery as trustee, then artists), and a `beneficiaryRecordsKeptBy` field. A pure `passThroughEligible(account)` returns pass or fail with the missing requirement. A panel shows per-artist insured cents: up to $250,000 per artist when eligible, and the whole trust account capped at $250,000 under the gallery's name when not.
- Why judges care: It shows we know how Ramp's own pooled account is insured, and that "trust" only protects the artist if the bank title and records say so.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low, read-only computation with a single toggle
- Grounding: [FDIC pass-through](https://www.fdic.gov/resources/deposit-insurance/diguidebankers/pass-through/index.html); [12 CFR 330.5](https://www.ecfr.gov/current/title-12/chapter-III/subchapter-B/part-330/section-330.5); [Ramp Operating Account](https://support.ramp.com/hc/en-us/articles/50843412544531-Ramp-Operating-Account-Overview)

### Daily beneficiary file, reconciled to the bank

- What: `GET /api/trust/beneficiaries.csv` produces one row per artist (artist id, name, ownership category "trust", balance in cents, oldest dueBy), in the spirit of the FDIC proposal's fixed one-row-per-owner format. A day-close function checks that the rows sum exactly to the trust account's bank-feed balance and stores the result with a timestamp. A mismatch blocks the day from closing.
- Why judges care: It answers "what if your ledger is wrong, like Synapse's?" with a file the bank could hold and a check that runs daily.
- Demo visibility: both
- Effort: S (<1h) for the export, M with the day-close gate
- Demo risk: low, a deterministic export
- Grounding: [Federal Register custodial account proposal](https://www.govinfo.gov/content/pkg/FR-2024-10-02/html/2024-22565.htm); [Banking Dive on the Synapse gap](https://bankingdive.com/news/synapse-85-million-shortfall-partner-banks-mcwilliams/718796)

### Platform-failure drill ("What if Rescrow goes under?")

- What: A demo key wipes Rescrow's store, then rebuilds each artist's entitlement from two inputs only: the last beneficiary file and the bank feed transactions since then. A test asserts that the rebuilt entitlements equal the live ones to the cent for every seeded scenario (mid-installment, cancelled sale, after insolvency).
- Why judges care: The middleman is the risk in FBO setups, and this shows the artist does not depend on Rescrow staying alive.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: med, destroying and rebuilding state on camera must restore cleanly (keep a snapshot to restore)
- Grounding: [Federal Register custodial account proposal](https://www.govinfo.gov/content/pkg/FR-2024-10-02/html/2024-22565.htm) (access to records if the third party goes bankrupt); [Modern Treasury](https://moderntreasury.com/questions/are-fbos-risky)

### Trust requirement vs trust resource, with same-day top-up

- What: Add a check `trustRequirement` (sum of open holds) against `trustResource` (trust account balance from the bank feed), run at day close and after every operation. A shortfall creates a `TopUp` transfer from operating into trust, which never breaks the trust guard because money moves into trust, not out. An excess is flagged for a person to look at, not moved, because the only exit from trust stays `releaseTrust`. `reconcile()` is unchanged because a top-up is an internal move.
- Why judges care: It is the actual daily control UK regulators require, run to the cent, on top of our ledger identity.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low, it only shows when a shortfall is injected
- Grounding: [TISA CASS guide, 7.15.29R and 7.15.32R](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)

### "Higher figure wins" for short-paid wires

- What: When a buyer's wire arrives short of the installment (for example $8,000 billed and $7,975 received after an intermediary bank fee), the artist's share is computed on the contracted amount and the difference is topped up from operating. A `Discrepancy` record stays open until someone resolves it. Tests cover a short wire, an over-paid wire, and a wire split across two transactions.
- Why judges care: It is the real-world case that bank fees break naive splits, and it decides who absorbs the fee by rule, not by accident.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low, it can run as a separate seeded scenario
- Grounding: [TISA CASS guide, discrepancies and "nearest 1p"](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)

### Intra-step no-shortfall invariant

- What: A property test drives random sequences of payments, cancellations, deadline payouts and insolvency, and checks after every individual ledger write (not just after each operation) that trust resource is at least trust requirement. The split must credit trust before operating, so there is never a moment where operating has the artist's money.
- Why judges care: It enforces CASS's "never, even intra-day" standard as a test, which is the kind of rigor a payments team trusts.
- Demo visibility: repo-rigor
- Effort: S (<1h) to M, depending on how writes are sequenced today
- Demo risk: low, test only
- Grounding: [TISA CASS guide](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf); from the codebase (`invariants.test.ts`)

### Interest on trust: who earns it, by clause

- What: Add a fixed seeded rate and a daily accrual on the trust balance, credited as `InterestEarned`. The agreement's saved terms set `interestTo: "artist" | "pooled" | "none"`. With "artist", interest is split across holds by balance-days using largest-remainder rounding, so the cents add up exactly. With "pooled", small or short holds below a net-return threshold go to a named pool, as IOLTA does. `reconcile()` gains `+ interest` on the money-in side.
- Why judges care: Ramp pays interest on balances, so the question "whose interest is it?" is real, and answering it to the cent shows care for the ledger.
- Demo visibility: both
- Effort: M (1-3h), L if wired into the artist statement as well
- Demo risk: med, small interest amounts on a 2-minute timeline are hard to see unless time is fast-forwarded
- Grounding: [Ramp Operating Account (interest paid to customers)](https://support.ramp.com/hc/en-us/articles/50843412544531-Ramp-Operating-Account-Overview); [IOLTA](https://en.wikipedia.org/wiki/IOLTA); [SC Rule 412 net-return test](https://www.courtrules.net/south_carolina/south-carolina-appellate-court-rules/rule-412)

### Lowest intermediate balance tracer (the commingled replay)

- What: Replay the same sale's events into one mixed account (no Rescrow) alongside the gallery's rent and payroll debits. Compute what the artist could trace under the lowest intermediate balance rule: the claim is capped at the lowest balance after each deposit, and later deposits do not refill it. Chart the mixed balance line with the low point marked, next to Rescrow's trust line, which never dips.
- Why judges care: It turns "segregation matters" into the court's own arithmetic, and the chart makes the point in seconds.
- Demo visibility: shown-on-screen
- Effort: M (1-3h)
- Demo risk: low, pure function plus a static chart
- Grounding: [Turley v. Mahan & Rowsey](https://law.counselstack.com/opinion/turley-v-mahan-rowsey-inc-ca10-1987); [Texas Comptroller v. Weathers](https://law.counselstack.com/opinion/texas-comptroller-v-weathers-ca5-2001); [In re Larson](https://www.wiwb.uscourts.gov/sites/wiwb/files/opinions/1997_Larson-Woods.pdf)

### Pooling event with pro rata payout and a post-failure cutoff

- What: On insolvency, freeze each artist's entitlement as of `insolventAt`. If the trust balance is short (for example after a returned ACH that was already split), pay each artist `pool * entitlement / total` using largest-remainder cents so the payouts sum exactly to the pool. Buyer payments that arrive after `insolventAt` go to a separate post-event bucket and are never mixed into the pool. Tests cover full coverage, a shortfall, and a payment that arrives after failure.
- Why judges care: It shows the system acts fairly and exactly even when the books are not perfect, which is when it matters most.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low if kept as an alternate scenario. The main demo still shows full coverage.
- Grounding: [FD Capital, client money distribution](https://www.fdcapital.co.uk/client-money-distribution-cass-insolvency/); [FCA CASS 7A](https://handbook.fca.org.uk/handbook/cass7a)

### Prudent segregation buffer

- What: The gallery can deposit its own money into trust as a `Buffer` against chargebacks or returned payments. Once deposited it is trust money: the guard refuses to send it back to operating, and on insolvency it goes first to cover any artist shortfall. A pure function sizes a suggested buffer from open installments that are still within their return window.
- Why judges care: It shows trust is one-way by design, even for the gallery's own money, and models a real regulated practice.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low, an additive flow
- Grounding: [TISA CASS guide, prudent segregation](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)

### Bank acknowledgement and no set-off by the bank

- What: Seed the gallery with a bank credit line it owes on. On insolvency the bank, as a creditor, can take the operating balance, but an attempt to set off the debt against the trust account throws, citing the account's stored `acknowledgement` record (bank recognises trust, date, last reviewed). An account with a missing or stale acknowledgement shows a warning on the dashboard.
- Why judges care: The bank holding the account is often the first creditor to act, and this closes that path in code.
- Demo visibility: both
- Effort: S (<1h) to M
- Demo risk: low, one extra refused move in the insolvency beat
- Grounding: [FD Capital, CASS audits](https://www.fdcapital.co.uk/cass-audits-2026-frc-standards/); [TISA CASS guide, 7.18.12R](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf). The exact set-off wording should be checked against the template letters in CASS 7 Annex 2.

### Insured-coverage placement across program banks

- What: A pure `placeTrust(balance, perArtist, banks, exclusions)` spreads the trust balance across a fixed list of program banks so that no artist's pass-through share at any one bank goes over $250,000, skipping excluded banks. It returns the allocation plus any uninsured remainder. A gauge shows the percent insured, using a seeded $1.2M sale.
- Why judges care: It mirrors how Ramp-style accounts extend coverage, and it is a small allocation problem with clear invariants to test (sums match, caps hold, exclusions respected).
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: med, the main $24,000 demo sale is fully insured anyway, so it needs its own seed to show anything
- Grounding: [Increase, placement networks](https://increase.com/articles/how-depository-placement-networks-provide-extended-fdic-coverage); [FDIC pass-through](https://www.fdic.gov/resources/deposit-insurance/diguidebankers/pass-through/index.html)
