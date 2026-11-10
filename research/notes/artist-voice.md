# What artists say about getting paid by galleries

## What we learned

- Artists suing The Hole (New York) say the gallery's own books show about $50,000 still owed: $28,975 to one artist and $21,000 to the other, unpaid for over a year. Their claim cites New York's Arts and Cultural Affairs Law and says the proceeds were spent on rent, other creditors and other artists instead of being kept separate. These are allegations; the gallery did not comment. [amNY](https://www.amny.com/law/artists-sue-the-hole-bowery-theft-pay/), [Hyperallergic](https://hyperallergic.com/artists-sue-nyc-gallery-the-hole-for-nonpayment/)
- The Hole's management reportedly said its business was struggling and so it had to delay payments. The artists argue that consignment payments can't depend on how the gallery is doing otherwise. One unverified Reddit user, quoted in the same article, said artists learned of sales from social media. [amNY](https://www.amny.com/law/artists-sue-the-hole-bowery-theft-pay/)
- One artist consigned 12 works to Simon Lee Gallery in 2022, and all of them sold. Months later no invoicing instructions had arrived. A negotiated payment schedule was then missed, and she needed a lawyer to confirm that the collectors had paid in full. She was paid a third of what she was owed shortly before the gallery entered administration. [addyeb, "Chasing payments"](https://addyeb.substack.com/p/chasing-payments)
- That artist's records were the signed agreement, sales statements, emails and an accounting dashboard showing six overdue invoices. She still could not see whether the buyer's money had arrived. [addyeb, "Chasing payments"](https://addyeb.substack.com/p/chasing-payments)
- An open letter accused CB1 Gallery (Los Angeles) of bounced checks and of selling work without telling the artists. One artist wrote that the gallery sold his work and never paid him. Another was paid in full only after repeated requests and said she had no idea how much the gallery owed. [Hyperallergic](https://hyperallergic.com/438733/open-letter-los-angeless-cb1-gallery-accused-of-not-paying-its-artists/)
- Artists describe being paid "upwards of a year" late, and one learned of a sale only when the collector mentioned it. Some dealers won't name buyers. The president of the Art Dealers Association of America calls telling artists about sales common practice. [Vasari21](https://vasari21.com/the-tie-that-binds-or-not/)
- Jeffrey Gibson sued Kavi Gupta Gallery claiming $638,919 in withheld sales proceeds under a 50-50 split. The gallery disputes this and says it advanced over $764,600 in production costs that were not limited to framing. The fight is over undocumented deductions. [Hypebeast](https://hypebeast.com/2023/8/artist-jeffrey-gibson-sues-kavi-gupta-gallery-new-york-district-court)
- Common guidance is payment 30 to 60 days after the gallery receives the buyer's money. Discounts above 10% should require a call to the artist, and artists should ask whether the gallery has been paid if 60 days pass after a sale. [The Creative Independent](https://thecreativeindependent.com/guides/how-to-work-with-galleries-and-collectors-as-an-emerging-artist/)
- Oregon requires payment within 30 days of the dealer receiving proceeds unless the artist agrees otherwise in writing. Contracts must state retail value, payment timing, minimum sale price and commission (ORS 359.220). A dealer who refuses, after written demand, to give the buyer's name and address on a sale over $100 can owe three times the work's retail value. [Oregon VLA](https://www.oregonvla.org/resources/fine-art-consignments)
- California Civil Code §1738.6(d) says proceeds are held in trust and "shall first be applied to pay any balance due to the consignor" unless the artist agrees otherwise in writing. In practice the artist is paid before the gallery takes its cut. [California Civ. Code §1738.6](https://california.public.law/codes/ca_civ_code_section_1738.6)
- New York §12.01 makes proceeds trust funds that are not subject to the gallery's creditors. A waiver of the trust must be written, signed and conspicuous, and it can never cover the first $2,500 of gross proceeds in any 12 months. Trust property includes the consigned works themselves. [N.Y. Arts & Cult. Aff. Law §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01)
- Some galleries reportedly mark up the artist's agreed retail price by 5 to 20% and keep the difference, while paying the artist on the original price. Artists argue that unauthorized discounts should come out of the gallery's share. [Painter's Keys](https://painterskeys.com/dealer-padding/)
- On artist forums, a venue that discounts work without asking is treated as a red flag, and artists warn that commission plus habitual markdowns quietly cut into their take. [ArtHelper community](https://www.arthelper.com/community/artbusiness/post/pricing-work-for-a-venue-that-discounts-without-asking-you)
- Standard advice to artists is to get a signed itemized receipt for every consigned work, log every contact, and file a UCC-1 so the art can be recovered rather than shared with creditors if the gallery fails. [artbusiness.com](https://artbusiness.com/when-an-art-gallery-will-not-pay-an-artist-for-sold-art.html)
- Talking about money and contracts with a gallery "feels like a breach of etiquette." Artists are advised to ask up front whether the gallery gives clear, regular updates on sales and pricing. [Hyperallergic](https://hyperallergic.com/1034068/its-time-rethink-the-50-50-split-with-art-galleries/)

## How it applies to Rescrow

- The top complaint isn't the commission rate. Artists can't see what happened: whether the work sold, whether the buyer paid, and where the money is. Rescrow already has every fact needed to answer that. The artist portal should show the buyer's payments as they land, not only payouts.
- Every excuse in these stories ("business is struggling", "talk to the accountant", "the payment plan slipped") needs the gallery to have discretion over the artist's money. Rescrow removes that discretion. The pitch should say so in those words.
- Deductions and discounts are where the real disputes happen (Gibson, dealer padding). The agreement read already extracts notes like discount caps and framing costs. Turning those into enforced, itemized rules is the natural next step, and it fits the agent's "every number has a quote" story.
- The law already backs Rescrow's model. California says the artist is paid first from proceeds, New York says the works and the funds are both out of creditors' reach, and Oregon sets a 30-day clock. Encoding these as rules gives Ramp engineers real fidelity to check.
- Any deduction has to reduce the artist share _before_ the lock. It must never be a move out of trust. `releaseTrust` stays limited to the artist or the buyer.

## Feature ideas

### Artist-first installments (CA §1738.6(d))

- What: Add `installmentRule: "pro_rata" | "artist_first"` to `AgreementTerms`. Under `artist_first`, each incoming payment sends 100% to trust until the hold total for the sale equals the artist share, and only the remainder goes to operating. On the demo sale ($24,000 at 50%, three $8,000 payments), trust holds $8,000 after payment 1 and the full $12,000 after payment 2, so the artist is already fully covered before the gallery sees a dollar. Under pro-rata, trust holds only $8,000 after payment 2.
- Why judges care: one rule changes the insolvency beat from "artist keeps $8k" to "artist is made whole", and it's grounded in real statute.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: med. The cancel path has to refund correctly when early installments went entirely to trust. A test should cover refund amounts under both rules, and reconcile must still hold.
- Grounding: [California Civ. Code §1738.6](https://california.public.law/codes/ca_civ_code_section_1738.6)

### "The buyer paid" receipts on the artist portal

- What: The artist page lists each `IncomingPayment` for their sales: date, method, amount, the Ramp transaction id and the share locked for them. Next to it, a progress bar shows the buyer paying in (1 of 3, 2 of 3) and the trust balance. The artist sees the buyer's money land at the same moment the gallery does.
- Why judges care: it answers the exact problem of an artist who needed a lawyer to find out whether collectors had paid.
- Demo visibility: shown-on-screen
- Effort: S (<1h)
- Demo risk: low. It's read-only from the existing Snapshot.
- Grounding: [addyeb, "Chasing payments"](https://addyeb.substack.com/p/chasing-payments), [Vasari21](https://vasari21.com/the-tie-that-binds-or-not/)

### Insolvency returns the art, too

- What: When the gallery goes insolvent, every artwork with `status: "consigned"` moves to `"returned"` and an activity is logged per artist. The insolvency summary shows "works returned" next to "trust paid out". Creditors' claims touch only operating cash, never trust funds or consigned works.
- Why judges care: the law treats the works as trust property too, and showing both closes the loop on "nothing of the artist's goes to creditors".
- Demo visibility: both
- Effort: S (<1h)
- Demo risk: low. `"returned"` already exists in `ArtworkStatus`.
- Grounding: [N.Y. §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01), [artbusiness.com](https://artbusiness.com/when-an-art-gallery-will-not-pay-an-artist-for-sold-art.html)

### Discount cap and price-padding guard

- What: Store `listPriceCents` on the sale and `discountCapBps` in the terms. If the gallery sells above list, the artist share is computed on the actual price, so any padding goes to the artist. If it discounts beyond the cap, the artist share is computed on list × (1 − cap), and the gallery's commission absorbs the extra discount. Invariant: the gallery share can fall to zero, but the artist share never exceeds what the buyer pays. That edge case gets its own reconcile test.
- Why judges care: it enforces the most common hidden-fee complaint in code, with a clean edge-case invariant.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low. It's off the main demo path unless a discounted sale is staged.
- Grounding: [Painter's Keys](https://painterskeys.com/dealer-padding/), [The Creative Independent](https://thecreativeindependent.com/guides/how-to-work-with-galleries-and-collectors-as-an-emerging-artist/), [ArtHelper](https://www.arthelper.com/community/artbusiness/post/pricing-work-for-a-venue-that-discounts-without-asking-you)

### Itemized, capped deductions taken before the lock

- What: Add `deductions: { label, capCents, citation }[]` to the terms (for example framing, capped at $400). When a sale is created, each claimed deduction must cite its clause and stay under its cap. It reduces the artist share before any hold is created, and the statement lists it as a line item. No code path takes a deduction out of trust after the lock.
- Why judges care: it turns a Gibson-style dispute over undocumented production costs into an auditable line item.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low. The statement gains one line; the trust guard is unchanged.
- Grounding: [Hypebeast](https://hypebeast.com/2023/8/artist-jeffrey-gibson-sues-kavi-gupta-gallery-new-york-district-court); PRD tier 2 (framing deduction)

### Days-to-paid scorecard

- What: A pure function over the ledger computes, per artist and per gallery, the days from the buyer's final payment to the artist payout, plus the share of holds paid before `dueBy`. A small panel compares Rescrow's actual figure (0 days in the demo) with the agreement deadline (60), the Oregon statute (30) and the reported reality ("upwards of a year").
- Why judges care: a single number that measures the problem the app solves.
- Demo visibility: shown-on-screen
- Effort: S (<1h)
- Demo risk: low. It's derived data with no new state.
- Grounding: [Oregon VLA](https://www.oregonvla.org/resources/fine-art-consignments), [Vasari21](https://vasari21.com/the-tie-that-binds-or-not/)

### Per-artist sub-ledger reconciliation

- What: Alongside the global `reconcile()`, add `reconcileArtist(artistId)`, which proves that for each sale the artist's share of received funds = locked + paid + refunded, and that the share of unreceived funds equals the buyer's outstanding balance. The artist statement shows this identity with a checkmark.
- Why judges care: every artist gets their own to-the-cent proof, not just the gallery.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low. It's a pure function, property-tested alongside the existing reconcile.
- Grounding: [Hyperallergic, CB1](https://hyperallergic.com/438733/open-letter-los-angeless-cb1-gallery-accused-of-not-paying-its-artists/); from the codebase

### No cross-artist leakage

- What: Trust holds are keyed by artist, and `releaseTrust` pays only `hold.artistId` (or refunds the sale's buyer). A property-based test generates random sales across several artists, attempts payouts that cross artists, and asserts every one throws. It also checks that each artist's trust balance equals the sum of their own locked holds.
- Why judges care: The Hole allegedly paid other artists with one artist's proceeds, and this test proves that can't happen here.
- Demo visibility: repo-rigor
- Effort: S (<1h)
- Demo risk: low. Test-only.
- Grounding: [amNY](https://www.amny.com/law/artists-sue-the-hole-bowery-theft-pay/)

### Sale notice the moment a work sells

- What: `createSale` writes a `sale_notice` activity addressed to the artist, with the price, artwork and installment plan. The artist portal shows an unread badge. The artwork moves from consigned to sold in the artist's view at the same moment it does for the gallery.
- Why judges care: artists in several stories learned of sales from collectors or other artists.
- Demo visibility: shown-on-screen
- Effort: S (<1h)
- Demo risk: low.
- Grounding: [Vasari21](https://vasari21.com/the-tie-that-binds-or-not/), [Hyperallergic, CB1](https://hyperallergic.com/438733/open-letter-los-angeless-cb1-gallery-accused-of-not-paying-its-artists/)

### Consignment inventory receipt

- What: A per-artist list of every consigned work with its agreed retail price, date received and current status (on consignment, sold, paid, returned), generated from existing data and printable. It doubles as the itemized receipt that artists are told to get signed.
- Why judges care: a trustworthy record of where every work is, not only every dollar.
- Demo visibility: shown-on-screen
- Effort: S (<1h)
- Demo risk: low.
- Grounding: [artbusiness.com](https://artbusiness.com/when-an-art-gallery-will-not-pay-an-artist-for-sold-art.html), [Oregon VLA](https://www.oregonvla.org/resources/fine-art-consignments)

### Statute lint on the agreement

- What: A deterministic checker runs over the extracted terms and agreement text. It flags required items that are missing (retail value, payment timing, minimum price, commission, per ORS 359.220), payout days longer than a chosen statutory window, and any trust waiver, which New York caps by leaving the first $2,500 in 12 months unwaivable. Results render as checks next to the existing verification checks.
- Why judges care: the agreement read goes from "extract numbers" to "check the contract against the law", with no model involved.
- Demo visibility: both
- Effort: M (1-3h)
- Demo risk: low. It's additive to the existing checks panel.
- Grounding: [Oregon VLA](https://www.oregonvla.org/resources/fine-art-consignments), [N.Y. §12.01](https://newyork.public.law/laws/n.y._arts_and_cultural_affairs_law_section_12.01)

### Buyer disclosure on request

- What: The artist can ask for the buyer's name on a sale from the portal. The request and the gallery's response are logged with timestamps, and an unanswered request shows its age. Agreements can set whether the buyer's identity is disclosed at once or only on request.
- Why judges care: it models a real disclosure right (Oregon) and a common sore point, without exposing data by default.
- Demo visibility: shown-on-screen
- Effort: M (1-3h)
- Demo risk: med. It's a new interaction that needs a staged response, so it's easy to cut from the recording.
- Grounding: [Oregon VLA](https://www.oregonvla.org/resources/fine-art-consignments), [Vasari21](https://vasari21.com/the-tie-that-binds-or-not/)
