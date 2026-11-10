# Domain brief: artist money, gallery failure, and where Rescrow fits

A two-page background for anyone pitching or building Rescrow. Sources are linked inline. The topic notes in [`notes/`](notes/) have the detail. None of this is legal or tax advice.

## 1. Why the artist's share is trust money

- **New York makes it trust money by statute.** NY Arts and Cultural Affairs Law §12.01 says that when an artist delivers work to a dealer to sell on commission, the work is trust property and the sale proceeds are trust funds for the artist. This holds whatever the contract or trade custom says. The money never becomes the gallery's, and the gallery's creditors can't reach it ([§12.01](https://www.nysenate.gov/legislation/laws/ACA/12.01)).
- **New York also requires separation, through trust law.** §12.01(2) points to EPTL 11-1.6, which requires a fiduciary to keep trust property apart from its own and hold it in its name as fiduciary. Breaking that rule is a misdemeanor ([EPTL 11-1.6](https://newyork.public.law/laws/n.y._estates,_powers_and_trusts_law_section_11-1.6)). New York tightened the statute in 2012, after the Salander-O'Reilly and Berry-Hill failures ([Center for Art Law](https://itsartlaw.org/2012/11/09/cave-consignor-ny-art-consignment-law-muscles-up/)).
- **The NY waiver is narrow.** An artist can waive only the trust-funds clause, in a signed, conspicuous writing. Even then, the first $2,500 of proceeds in any 12 months stays protected. If the gallery buys the work itself, it stays trust property until the artist is paid in full.
- **§12.01 sets no payment deadline.** Rescrow's payout days come from the contract, not from statute.
- **Other states go further on timing and order.** California pays the artist's balance first from proceeds and voids any waiver ([Cal. Civ. Code 1738.6](https://california.public.law/codes/ca_civ_code_section_1738.6)). Illinois, Washington and Oregon require payment within 30 days, and Washington and Oregon apply installments to the artist first. Knowingly withholding proceeds is a felony in Oregon ([815 ILCS 320/2](https://codes.findlaw.com/il/chapter-815-business-transactions/il-st-sect-815-320-2/), [ORS 359.225](https://oregon.public.law/statutes/ors_359.225), [ORS 359.240](https://oregon.public.law/statutes/ors_359.240)). One survey counts 31 states with artist-consignment statutes ([Center for Art Law](https://itsartlaw.org/2019/12/05/the-art-of-bankruptcy-consigned-artworks-and-bankrupt-galleries/)).
- **In bankruptcy, segregated trust money stays out of the estate.** Property the debtor holds only as trustee is excluded from the estate ([11 U.S.C. §541(d)](https://www.law.cornell.edu/uscode/text/11/541)). Paying trust money out before a filing isn't a clawback-able preference, because the money was never the debtor's ([_Begier v. IRS_](https://chanrobles.com/usa/us_supremecourt/496/53/case.php)).
- **Once money is commingled, the claim shrinks.** Courts apply the lowest intermediate balance rule: the artist can recover only the lowest balance the mixed account reached after the deposit ([_In re Foster_, 10th Cir.](https://caselaw.findlaw.com/court/us-10th-circuit/1004530.html)).
- **England has no art-trust statute.** A trust can still arise over a genuinely separate account ([_Re Kayford_](https://wikipedia.com/wiki/Re_Kayford)). Without one, artists rank as unsecured creditors and can face clawback of earlier payments ([Withers](https://www.withersworldwide.com/en-gb/insight/read/gallery-closures-–-protecting-artists)).

**The honest gap.** The law in New York already says "keep it separate". Nothing enforces that at the moment money lands, and nobody checks until the gallery has failed. We found no court ruling on this protection in a gallery bankruptcy, so Rescrow's claim is that the trustee never faces a tracing fight, not that a court has blessed the model.

## 2. How galleries fail artists

| Case                                         | What happened                                                                                                                                                                                               | Status                              | Source                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stephen Friedman Gallery, London, 2026       | Administration with about £7.8m of debt, more than £800k of it owed to artists (Diop £341,905, Roberts £289,232, Wiley £163,849). Coutts is secured for £3.1m. Unsecured creditors expect 8 to 9p per pound | Filings                             | [The Art Newspaper](https://www.theartnewspaper.com/2026/04/30/stephen-friedman-gallery-owes-£800000-to-artists-filings-reveal)                                               |
| The Hole, New York, 2026                     | Two artists say the gallery's own books show about $50k unpaid, spent on "rent, operating expenses, [and] other creditors"                                                                                  | Allegations                         | [amNY](https://www.amny.com/law/artists-sue-the-hole-bowery-theft-pay/)                                                                                                       |
| Salander-O'Reilly, 2007                      | Sold works it didn't own, sold half-shares twice, and didn't pay consignors. About $120m in larceny                                                                                                         | Guilty plea                         | [Wikipedia](https://en.wikipedia.org/wiki/Lawrence_Salander)                                                                                                                  |
| Berry-Hill, 2005                             | Pledged "all its art", including consigned works, to a lender                                                                                                                                               | Chapter 11                          | [The Art Newspaper](https://www.theartnewspaper.com/archive/debt-and-legal-troubles-force-berry-hill-galleries-to-file-for-bankruptcy)                                        |
| Inigo Philbrick, 2019                        | Sold "more than 100 percent ownership" of works, and pledged works as collateral                                                                                                                            | 7 years in prison, $86m restitution | [DOJ SDNY](https://www.justice.gov/usao-sdny/pr/former-art-dealer-sentenced-7-years-86-million-fraud-scheme)                                                                  |
| Cadence Comic Art, 2025                      | 17 artists alleged more than $473k never remitted, secret sales and commingling                                                                                                                             | Settled                             | [The Beat](https://www.comicsbeat.com/cadence-comic-art-lawsuit-has-been-settled)                                                                                             |
| Gibson v. Kavi Gupta; Odita v. Jack Shainman | Disputes over deductions, offsets of advances, and a stipend "deficit"                                                                                                                                      | Allegations on both sides           | [Hyperallergic](https://hyperallergic.com/artist-jeffrey-gibson-sues-chicago-gallery), [Grossman LLP](https://www.grossmanllp.com/shainman-odita-artist-gallery-relationship) |

Three patterns run through these cases:

- **Commingling** (Friedman, The Hole, Cadence) is what Rescrow removes.
- **Double-selling and pledging** (Philbrick, Salander, Berry-Hill) are a title problem, which Rescrow can extend to.
- **Disputes over deductions and offsets** (Gibson, Odita) become rules once the clause and its cap are cited.

Artists' most common complaint is that they can't see anything: whether the work sold, whether the buyer paid, where the money is ([addyeb](https://addyeb.substack.com/p/chasing-payments), [Vasari21](https://vasari21.com/the-tie-that-binds-or-not/)).

Two caveats belong in any pitch:

- Rescrow does nothing about forgery. Knoedler's failure was about fakes ([The Conversation](https://theconversation.com/the-rise-and-fall-of-the-knoedler-new-yorks-most-notorious-art-gallery-53775)).
- Galleries are not closing at a record pace. New York recorded 36 openings against 20 closures in 2025 ([Art Basel](https://www.artbasel.com/stories/art-market-report-2026-galleries-pop-up-collaboration-new-york-city)).

## 3. How real ledgers and escrow systems work

- **Production ledgers are append-only and double-entry.**
  - Entries can't be edited once posted. Corrections are reversals ([Modern Treasury](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger), [TigerBeetle](https://docs.tigerbeetle.com/coding/recipes/correcting-transfers/)).
  - Balances are derived from the entries.
  - Stripe's Ledger watches clearing accounts that should return to zero ([Stripe](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)).
  - Idempotency keys stop duplicate deliveries from creating money ([Brandur](https://brandur.org/idempotency-keys)).
- **Escrow holds funds against a condition, but standard escrow protects the buyer.** Escrow.com, which Artsy recommends for off-platform deals, takes the full price up front and releases it to the seller once the buyer accepts. The artist's share then still lands in the gallery's operating cash ([Escrow.com x Artsy](https://www.escrow.com/fr/partners/landing/artsy)). Two-phase transfers hold funds as pending, then post, void or time out ([TigerBeetle](https://docs.tigerbeetle.com/coding/two-phase-transfers/)). A Rescrow hold works the same way, except that its timeout (`dueBy`) pays the artist instead of returning the money to the source.
- **Platforms keep "allocated" funds apart from their own balance.** Stripe's funds segregation stops platform payouts, unrelated refunds and fees from touching allocated money ([Stripe](https://docs.stripe.com/connect/funds-segregation)).
- **Trust-account regulators require three-way reconciliation.** Lawyers and title agents must reconcile the bank balance, the journal and the per-client ledgers, and a client balance can never go negative ([CalBar handbook](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf)). UK client-money rules require any shortfall to be topped up the same day, "to the nearest 1p" ([TISA CASS guide](https://www.tisa.uk.com/wp-content/uploads/2023/02/TISA-CASS-Best-Practice-Guide-v1.7-April-2024.pdf)).
- **Pooled accounts depend on the records.** FDIC pass-through cover needs the account title and per-owner records to be right ([FDIC](https://www.fdic.gov/resources/deposit-insurance/diguidebankers/pass-through/index.html)). When Synapse failed, end users were owed $265M against about $180M held ([Banking Dive](https://bankingdive.com/news/synapse-85-million-shortfall-partner-banks-mcwilliams/718796)).
- **Not every rail is final.** Wires and RTP are final on credit. ACH debits can be returned for up to 60 days, and cards charged back for about 120 ([Plaid](https://plaid.com/resources/ach/ach-return/), [Stripe](https://docs.stripe.com/disputes/how-disputes-work)).

## 4. What Ramp offers

- **Banking API:** read-only beta (`treasury:read`) with accounts, daily balance history and transactions, and no deposit webhook. A business can hold several Checking Accounts (`WALLET_ACCOUNT`), so trust can live in its own account ([Banking guide](https://docs.ramp.com/llms-guides/banking.txt)).
- **Webhooks:** signed with HMAC-SHA256. Ramp warns of duplicate and out-of-order delivery ([Webhooks guide](https://docs.ramp.com/llms-guides/webhooks.txt)).
- **Accounting sync:** journal entries to the ERP, using `SYNC_READY` objects and `POST /accounting/syncs` with an `idempotency_key` ([ERP guide](https://docs.ramp.com/llms-guides/erp-integrations.txt)).
- **Payments platform:** each transfer's intent is kept separate from its attempts ([Ramp Builders](https://builders.ramp.com/post/payments-platform)).
- **Bill Pay FX:** the rate is fixed at initiation, and Fast FX is not offered to New York businesses ([Ramp support](https://support.ramp.com/hc/en-us/articles/10593954538259-International-transfers-on-Ramp-Bill-Pay)).
- **Operating Account:** pooled at JPMorgan Chase, with pass-through FDIC cover ([Ramp support](https://support.ramp.com/hc/en-us/articles/50843412544531-Ramp-Operating-Account-Overview)).

## 5. Ten facts a Ramp engineer should hear in our pitch

1. Stephen Friedman's administration lists Kehinde Wiley as owed £163,849, and unsecured creditors expect 8 to 9p per pound.
2. In New York, consignment proceeds are trust funds by statute, and EPTL 11-1.6 already requires them to be kept separate. What's missing is enforcement at the moment money lands.
3. The statute sets no payout deadline, so Rescrow's per-payment `dueBy` comes from the contract, cited word for word.
4. Commingling is what destroys the claim. Courts cap recovery at the mixed account's lowest balance, so segregating at landing time is the protection.
5. Trust money paid out before a failure can't be clawed back as a preference (_Begier_). Payments out of a mixed operating account may be exposed.
6. Ramp's banking API is read-only, has no deposit webhook, and allows several Checking Accounts. So we poll, dedupe on transaction id, and keep trust in its own account.
7. The only way out of trust is `releaseTrust(to: artist or buyer)`. A move to operating or to creditors throws, and a test proves it.
8. `reconcile()` proves opening + received = operating + trust + paid + refunded + claimed, to the cent, with integer cents and running-total rounding.
9. Incumbent tools (ArtCloud, Artlogic) record what is owed but never hold the money. ArtCloud says plainly that it "does not transfer payments to artists" ([ArtCloud](https://help.artcloud.com/knowledge/consignment-reports-and-artist-payments)). Arcual splits only sales that run through its own platform ([Arcual](https://www.arcual.com/blog/how-do-payments-work-in-the-art-world)).
10. A ledger proof shows what the books say, not that the bank holds the cash. The bank balance from Ramp is the independent leg, which is why three-way reconciliation is the natural next step.
