# Art fraud and title: double-selling, liens, and registries

## What we learned

- Inigo Philbrick pleaded guilty to wire fraud. Prosecutors said he sold "more than 100 percent ownership" of artworks to buyers who did not know about each other. He was sentenced to 84 months and ordered to pay $86m in restitution. [DOJ SDNY](https://www.justice.gov/usao-sdny/pr/former-art-dealer-sentenced-7-years-86-million-fraud-scheme)
- Philbrick also sold works, or pledged them as loan collateral, without the owners knowing. He used fraudulent documents to inflate valuations, and he fled after defaulting on a $14m loan in 2019. [Wikipedia: Inigo Philbrick](https://en.wikipedia.org/wiki/Inigo_Philbrick)
- One Basquiat (_Humidity_) was claimed at once by share buyers and by a lender holding it as collateral. A magistrate judge found that Satfinance's contract "unambiguously" gave it full title. Reported purchase prices differ between sources. [Grossman LLP](https://grossmanllp.com/Grossman-Victory-Inigo-Philbrick), [Puck](https://puck.news/newsletter_content/phillips-day-sale-dynamics-a-basquiat-legal-battle/)
- A Rudolf Stingel painting from the same scheme had three companies each claiming to own the whole work. [Grossman LLP](https://grossmanllp.com/Rudolf-Stingel-Painting-at-Center-of-Inigo-Philbr)
- Salander-O'Reilly Galleries filed for Chapter 11 in 2007. Lawsuits accused it of selling works, double-pledging them and not paying consignors their proceeds. [Greenberg Traurig, The Secured Lender](https://www.gtlaw.com/-/media/files/insights/published-articles/023810_the-secured-lender--dec-2015-kevin-ray-complimentary-pdf.pdf)
- The gallery's lender held a blanket lien on substantially all of its assets, and the bankruptcy court read that lien as covering a consigned Botticelli. Kraken, the consignor, had filed no UCC-1. It lost in bankruptcy court and won on appeal, because the district court read the loan agreement differently. The painting came back more than seven years after the bankruptcy began. [National Law Review](https://natlawreview.com/article/botticelli-s-madonna-and-child-risks-art-consignment)
- UCC 9-102(a)(20) puts a consignment inside Article 9 only if several conditions all hold. The consignee must be a merchant selling under its own name, not an auctioneer, and not generally known by its creditors to sell others' goods. Each delivery must be worth at least $1,000, and the goods must not be consumer goods. [Cornell LII, UCC 9-102](https://www.law.cornell.edu/ucc/9/9-102)
- Inside Article 9, an unperfected consignor can lose the work to the gallery's estate and end up a general unsecured creditor. The protective steps are to file a UCC-1 and to notify the gallery's existing secured lenders before delivery (9-324), which means running a lien search first. [Herrick Feinstein](https://www.herrick.com/publications/the-art-of-perfection-avoiding-pitfalls-in-gallery-bankruptcies/)
- In _Overton v. Art Finance Partners_, a dealer pledged and sold a collector's consigned works to his lender. The court held the lender did not take priority, because the dealer was publicly known as an agent selling others' goods. [Lexplug case brief](https://www.lexplug.com/casebrief/overton_v_art_finance_partners_llc_6787bc1a8466ba5e437e2156)
- Under UCC 2-403(2), handing goods to a merchant who deals in that kind of goods gives the merchant power to pass the owner's rights to a buyer in the ordinary course. A gallery can therefore sell a work it does not own and still give the buyer good title. [Cornell LII, UCC 2-403](https://www.law.cornell.edu/ucc/2/2-403)
- In _Porter v. Wertz_, entrustment did not protect a dealer who bought an entrusted Utrillo through someone who was not an art dealer (a deli worker), so the original owner kept title. A lower court added that a merchant buyer must follow reasonable commercial standards, not just act honestly. [Lexplug case brief](https://www.lexplug.com/casebrief/porter_v_wertz_65a321e67e449db77fb67434)
- NY Arts and Cultural Affairs Law §12.01 makes a consigned work and its proceeds trust property that never becomes the gallery's, and creditors cannot lien it. The work stays trust property even if the gallery buys it, until the artist is paid in full. The section sets no payout deadline. [NY ACAL §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01)
- The artist can waive §12.01's trust-funds clause in a signed writing. The waiver can never cover the first $2,500 of gross sales in any 12 months, and it cannot weaken the artist's rights against the gallery's creditors. [NY ACAL §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01)
- The Art Loss Register holds over 700,000 items. It records thefts, title disputes, freezing orders and "financial liens", and works pledged as collateral can be registered. Its certificate is evidence of due diligence, not a guarantee, and it is often refused when provenance documents are missing. [Art Loss Register FAQ](https://www.artloss.com/faq/)
- Christie's recorded the 2018 Ebsworth sale ($323m) in Artory's registry: title, description, price and date for each lot. Buyers got a card that let them view the work's history anonymously. [Business Wire](https://businesswire.com/news/home/20181011005616/en/Artory-Collaborates-Christie%e2%80%99s-Industry-Registration-Major-Art), [Ledger Insights](https://www.ledgerinsights.com/christies-registers-323-million-art-sale-on-blockchain/)

## How it applies to Rescrow

- Our trust guard protects the money but not the artwork itself. Philbrick and Salander both did their damage on the object side: they sold or pledged the same work twice. One allocation ledger per artwork, enforced the same way `releaseTrust` is, closes that gap.
- `createSale` already refuses an artwork whose status is not `consigned`, so one work cannot be sold twice today. The next step is to make that a stated, tested invariant, and to extend it to fractional shares and liens.
- `declareInsolvency` pays out trust cash but leaves unsold consigned works on the gallery's books. Under §12.01 those works are trust property too. Returning them to their artists is the object-side half of beat 6.
- The payout deadline (`payoutDays`) is a contract term, not a statutory one, because §12.01 sets no deadline. The agreement reader should keep citing the clause, and the UI should not claim the deadline comes from statute.
- Lien and registry checks stay offline: a local fixture file of liens and stolen works, searched deterministically. The result reads as "due diligence on record, not a guarantee", which is how the ALR describes its own certificate.
- `reconcile()` proves dollars to the cent. A matching artwork count (works received = on hand + sold + returned) would prove the objects as well.

## Feature ideas

### Ownership allocation ledger (the Philbrick invariant)

- What: Add an `OwnershipShare { artworkId, holder, bps }` list per artwork. A single `allocate()` function is the only way to sell a share, and it throws if the shares would sum to more than 10000 bps. A full sale is simply a 10000 bps allocation, so double-selling becomes the same error. Show the allocation as a bar per artwork that fills up and turns red on the rejected sale.
- Why judges care: It turns the best-known art fraud of the decade into one property that a test can check.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it is a pure function with a single refused path that is easy to trigger on cue.
- Grounding: [DOJ SDNY](https://www.justice.gov/usao-sdny/pr/former-art-dealer-sentenced-7-years-86-million-fraud-scheme), [Wikipedia](https://en.wikipedia.org/wiki/Inigo_Philbrick)

### Insolvency returns the art, not just the money

- What: Extend `declareInsolvency` so that every artwork still `consigned` at that gallery becomes `returned` to its artist, with a `consignment_returned` activity line. If "Gallery-purchase stays in trust until paid" is built too, works the gallery bought but has not finished paying for also go back. The seed already has unsold consigned works, so the screen then lists the returned works next to the trust payouts.
- Why judges care: It completes beat 6: creditors get neither the trust cash nor the consigned paintings, as §12.01 says.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low, because it is additive to an existing idempotent function and `demo-flow.test.ts` covers it.
- Grounding: [NY ACAL §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01), [itsartlaw](https://itsartlaw.org/2019/12/05/the-art-of-bankruptcy-consigned-artworks-and-bankrupt-galleries/), from the codebase

### No pledging consigned works

- What: Add a `Lien { artworkId?, galleryId, lender, scope: "specific" | "blanket", filedAt }` record. A `pledge()` function refuses any lien on a consigned work, and a blanket lien is stored with consigned works excluded. The error message cites trust property under §12.01, matching the way the trust guard names its refused path.
- Why judges care: It is the Salander and Botticelli failure written as a typed rule with a test.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it needs no UI flow beyond a single "try to pledge" button that shows the error.
- Grounding: [National Law Review](https://natlawreview.com/article/botticelli-s-madonna-and-child-risks-art-consignment), [Overton brief](https://www.lexplug.com/casebrief/overton_v_art_finance_partners_llc_6787bc1a8466ba5e437e2156)

### Lien search at consignment intake

- What: When a new consignment is created, search a local `liens.json` fixture for secured lenders on the gallery, mirroring the pre-delivery search that 9-324 requires. Produce an intake report listing which lenders were found and which notices must go out before the work is delivered. The artwork stays in `pending_intake` until the notices are marked sent.
- Why judges care: It is real-world fidelity, the step consignors' lawyers say people skip.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it reads a deterministic fixture.
- Grounding: [Herrick Feinstein](https://www.herrick.com/publications/the-art-of-perfection-avoiding-pitfalls-in-gallery-bankruptcies/), [Cornell LII 9-102](https://www.law.cornell.edu/ucc/9/9-102)

### Hash-chained provenance log per artwork

- What: Keep an append-only `ProvenanceEvent { seq, artworkId, kind, at, prevHash, hash }` chain, hashed with SHA-256 from Node's built-in crypto, covering consigned, sold, share allocated, returned and lien filed. `verifyChain()` recomputes the hashes and points to the first event that was tampered with. A test edits one stored event and asserts the break is found.
- Why judges care: It gives an offline, deterministic version of what Artory did for Christie's, with no chain or network involved.
- Demo visibility: both
- Effort: M
- Demo risk: low, because it is pure and deterministic given a fixed clock.
- Grounding: [Business Wire](https://businesswire.com/news/home/20181011005616/en/Artory-Collaborates-Christie%e2%80%99s-Industry-Registration-Major-Art), [Ledger Insights](https://www.ledgerinsights.com/christies-registers-323-million-art-sale-on-blockchain/)

### Artwork reconciliation alongside cash reconciliation

- What: Add `reconcileArtworks()`: works received on consignment = on hand + sold + returned, per artist and per gallery. Also check that every sold work has exactly one open-or-paid sale and that allocations total exactly 10000 bps. Show it as a second green check next to the cash reconciliation.
- Why judges care: The books balance for objects as well as dollars, and that is what the frauds actually broke.
- Demo visibility: both
- Effort: S
- Demo risk: low, because it is a pure function over the existing Snapshot.
- Grounding: from the codebase, [Greenberg Traurig](https://www.gtlaw.com/-/media/files/insights/published-articles/023810_the-secured-lender--dec-2015-kevin-ray-complimentary-pdf.pdf)

### Offline due diligence check before a sale

- What: Before `createSale`, check the work against a local registry fixture of stolen works, title disputes, freezing orders and liens, matching on artist, title and year. Show the result as a card that says "no match in register (not a guarantee)", in the ALR's own wording. A match blocks the sale until someone resolves it, and the card says which entry matched.
- Why judges care: It shows we know the industry's real control and its limits.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low, because the fixture data is fixed. Seed one flagged work for a planted "blocked" moment.
- Grounding: [Art Loss Register FAQ](https://www.artloss.com/faq/)

### Property-based double-sell and over-allocation tests

- What: Run randomized sequences of createSale, allocate, cancel, pledge and insolvency against the engine with a seeded generator written in plain TypeScript (no new dependency). After every step, assert: shares ≤ 10000 bps; at most one live sale per work; no lien on a consigned work; cash and artwork reconciliation both hold. Print the seed of any failure so it can be replayed.
- Why judges care: It is the kind of rigor a payments engineer looks for in a ledger repo.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because it lives in tests and never touches the demo.
- Grounding: from the codebase (`invariants.test.ts`, vitest)

### Trust-funds waiver floor ($2,500 per 12 months)

- What: Rescrow never honors a waiver: every artist share still goes to trust. If an agreement contains a trust-funds waiver, the reader flags the clause. A rolling 12-month window check then marks the waiver void for the protected first $2,500 of gross sales, and the gallery sees a warning that the clause is partly unenforceable. Test the window edges in integer cents.
- Why judges care: It is a precise statutory rule turned into a tested window calculation, and it never weakens the trust guard.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because it is off the main demo path and covered by unit tests.
- Grounding: [NY ACAL §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01)

### Gallery-purchase stays in trust until paid

- What: Add a `buyer: "gallery"` sale type, for when the gallery buys a consigned work for its own stock. Until the artist is paid in full, the artwork carries `trustUntilPaid: true`, and both `pledge()` and resale refuse it. If the gallery resells it first, the resale proceeds go to trust up to the unpaid balance.
- Why judges care: It closes a loophole that §12.01 closes explicitly.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low, because it is test-only unless it is added to the demo.
- Grounding: [NY ACAL §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01)

### Title certificate for the buyer

- What: When a sale is paid in full, generate a printable certificate: work, artist, consignment agreement id, the provenance chain's head hash, the lien search result and the payout ids that cleared the artist. The buyer can see that the artist was paid, which removes the defect behind the Philbrick and Salander claims.
- Why judges care: It gives a strong visual close: the buyer leaves with clean title and proof the artist was paid.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: med, because it adds one more screen to a tight 3-minute script.
- Grounding: [Business Wire](https://businesswire.com/news/home/20181011005616/en/Artory-Collaborates-Christie%e2%80%99s-Industry-Registration-Major-Art), [Grossman LLP](https://grossmanllp.com/Grossman-Victory-Inigo-Philbrick)

### Article 9 consignment classifier (rule-based)

- What: A pure function takes the facts on the agreement: value per delivery, whether the goods were consumer goods, whether the consignee is an auctioneer, whether it is generally known to sell others' goods, and whether the consignor is the artist. It returns which regime applies (NY §12.01 artist trust, Article 9 consignment, or outside Article 9) and what the consignor should file. It is shown as a short checklist with citations. It has no model and no legal advice, only rules from the statute text.
- Why judges care: It shows real domain depth, encoded as a decision table with exhaustive tests.
- Demo visibility: both
- Effort: M
- Demo risk: med, because the legal nuance is easy to overstate on camera. Label it "informational".
- Grounding: [Cornell LII 9-102](https://www.law.cornell.edu/ucc/9/9-102), [Herrick Feinstein](https://www.herrick.com/publications/the-art-of-perfection-avoiding-pitfalls-in-gallery-bankruptcies/)
