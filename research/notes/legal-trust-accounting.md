# Legal trust accounting: IOLTA, three-way reconciliation, title escrow controls

Lawyers and title agents have held other people's money in pooled trust accounts for decades, and regulators have written detailed rules about how they must do it. Most of those rules apply directly to a gallery holding an artist's share. This note collects the rules and turns them into features Rescrow could mirror.

## What we learned

- **Separate account, complete records, five years.** Under DC's version of Rule 1.15, other people's money must sit apart from the lawyer's own. The account title must say "Trust" or "Escrow", and complete records are kept for five years after the matter ends. ([DC Bar Rule 1.15](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property))
- **Records must answer ownership questions on their own.** DC Comment [2], citing _In re Clower_, says the records must show who owns the funds without help from the lawyer or the client. ([DC Bar Rule 1.15](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property))
- **Notice, prompt delivery and an accounting on request.** The lawyer must promptly notify the owner when funds arrive, deliver them promptly and give a full accounting when asked. ([DC Bar Rule 1.15(c)](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property), [NY 22 NYCRR 1200.1.15(c)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15))
- **Disputed money stays in trust; the undisputed part goes out.** When two parties claim the same funds, the disputed portion stays separate until the dispute is resolved, and the rest is distributed promptly. The ABA model rule says the same in 1.15(e). ([DC Bar Rule 1.15(d)](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property), [NY 1.15(b)(4)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15), [ABA Model Rule 1.15](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_15_safekeeping_property.html))
- **Only the account fees may be mixed in.** The one exception to commingling is a small amount of the firm's own money to cover bank charges. California requires a separate "bank charges ledger" for those charges. ([DC Bar Rule 1.15(f)](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property), [CalBar Client Trust Accounting Handbook 2023](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf))
- **New York sets the strictest bookkeeping terms.**
  - Every deposit and withdrawal is recorded with date, source, payee and purpose, "at or near the time" it happens.
  - Records are kept for seven years.
  - Withdrawals go to a named payee and never to "cash".
  - Only an admitted lawyer may sign.
  - Trust accounts may not have overdraft protection.

  ([NY 22 NYCRR 1200.1.15(d), (e)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15))

- **Electronic transfers must name an authorizer.** Under the ABA's 2010 Model Rules for Client Trust Account Records, each electronic transfer record names who authorized it, the date, the recipient and the bank's confirmation. Balances are matched to bank statements monthly. ([Hinshaw alert on the ABA Model Rules for Client Trust Account Records](https://www.hinshawlaw.com/en/insights/lawyers-for-the-profession-alert/newly-adopted-aba-model-rule-115-offers-guidance-to-client-trust-account-maintenance-brings-lawyers-into-updated-technological-practices))
- **Three-way reconciliation is the core control.** Three figures must agree every month: the account journal (every transaction in the pooled account), the sum of the per-client ledgers, and the bank statement adjusted for outstanding items. California's handbook supplies model forms for each of the three. ([CalBar Handbook, Section VIII](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf), [CalBar Reconciliation Form](https://www.calbar.ca.gov/sites/default/files/portals/0/documents/ctapp/Reconciliation-Form.pdf))
- **A client's balance can never go below zero.** California's handbook says "You can't spend what you don't have", and that there is "no such thing as a negative balance". Paying one client's bill from a pooled account that holds too little for that client uses other clients' money, and the bar treats that as evidence of misappropriation. ([CalBar Handbook, Key Concepts 2 and 3](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf))
- **Deposited is not the same as collected.**
  - Funds can't be paid out until they have cleared and been credited, which can take up to 15 working days depending on the instrument. ([CalBar Handbook, Key Concept 4](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf))
  - Title escrow "good funds" laws say the same thing. Underwriters recommend federal wires because they are immediately collected and can't be reversed. ([Stewart Title bulletin on good funds](https://assets.stewart.com/content/stewart/virtualunderwriter/en/bulletins/2012-12/BL129688633300000011.html))
- **Title escrow (ALTA Best Practice #2) adds more controls:**
  - receipts and disbursements reconciled daily;
  - a three-way reconciliation within 10 days of the bank statement date, reviewed by management;
  - "never" a negative file balance;
  - the person who reconciles has no authority to disburse;
  - ACH and international wire blocks;
  - Positive Pay, where the bank pays only items on a list the firm pre-approved.

  ([ALTA Best Practice #2 summary](https://www.invtitle.com/docs/cfpb/nc/abp2nc.pdf))

- **Banks report trust overdrafts to the regulator.**
  - In Pennsylvania the bank must report any instrument presented against insufficient funds within five business days, whether or not it pays the item. ([204 Pa. Code § 91.174](https://www.law.cornell.edu/regulations/pennsylvania/204-Pa-Code-SS-91-174))
  - Wyoming called itself the 47th state to adopt such a rule. ([Wyoming State Bar](https://www.wyomingbar.org/new-lawyer-trust-account-overdraft-rule))
- **A shortfall must be replaced immediately.** The UK regulator says money missing from a client account must be replaced at once, from the managers' own resources if necessary. The managers are jointly responsible, and the shortfall must be reported. A deficient pooled account is likely to be shared out pro rata, so every client loses. ([SRA warning notice: money missing from client account](https://www.sra.org.uk/solicitors/guidance/money-missing-client-account/))
- **Small unexplained debits can be fraud probes.** A Florida firm found an unauthorized 47-cent debit on its trust account and read it as a test before a larger theft. The firm added an ACH debit block, so the account now only accepts wires. ([Florida Bar News](https://www.floridabar.org/the-florida-bar-news/sarasota-lawyers-vigilance-over-47-cents-highlights-trust-account-vulnerabilities/))
- **Random audits trace the records.** New Jersey has run random audits of attorney trust records since 1981. Auditors check client ledgers and reconciliation records, then issue written findings. ([NJ Courts random audit program](https://www.njcourts.gov/sites/default/files/forms/12996_random_audit_program.pdf))

## How it applies to Rescrow

- **`reconcile()` checks the books against themselves, not against a bank.** `trustCents` is derived from locked holds, so the check proves the holds, payouts and operating balance agree with each other. No regulator would accept that as reconciliation: every source above compares the books with an independent bank balance. The biggest gain in fidelity is a third leg, a trust bank balance from the `BankFeed`, alongside the existing identity.
- **Holds are already per-artist client ledger entries.** Grouping them by artist with a running balance gives the "client ledger card" every rule requires. The CalBar rule that a client balance is never negative becomes a testable invariant.
- **Galleries need the same disputed-funds and collected-funds rules.** The planned framing deduction for Theo is a disputed-portion case. ACH and card payments are uncollected funds until they clear.
- **The insolvency beat matches the SRA's pro rata point.** In an ordinary failed client account, every client shares the loss pro rata. Under Rescrow every artist gets 100%, because the trust leg was never short. That contrast fits the 8-pence hook.
- **`releaseTrust` is Rescrow's version of Positive Pay and the named-payee rule.** Recording authorized-by, payee and confirmation on each payout brings it up to NY and ABA record standards without widening the artist|buyer guard.

## Feature ideas

### Three-way reconciliation

- What:
  - Add `threeWay(snapshot, galleryId, bankStatement)` beside `reconcile()`. It compares three figures:
    - the trust bank balance from the fake `BankFeed`, adjusted for outstanding items (payouts sent but not yet posted, deposits in transit);
    - the trust journal total (every hold lock and release);
    - the sum of artist ledger balances.
  - The result is three numbers, the outstanding items, and named breaks. A "Reconciled 3/3" badge goes on the dashboard.
  - The existing five-bucket identity is unchanged. This is a second, independent proof.
- Why judges care: It shows we know the real standard (bank vs books vs sub-ledgers) and don't just check our own arithmetic.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a pure function over existing data plus one fake bank balance; tests can inject a bank-side discrepancy and expect a named break.
- Grounding: [CalBar Handbook Section VIII](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf), [CalBar Reconciliation Form](https://www.calbar.ca.gov/sites/default/files/portals/0/documents/ctapp/Reconciliation-Form.pdf), [ALTA BP #2](https://www.invtitle.com/docs/cfpb/nc/abp2nc.pdf), [SRA warning notice](https://www.sra.org.uk/solicitors/guidance/money-missing-client-account/), from the codebase (`reconcile.ts` derives `trustCents` from holds)

### Artist ledger cards with a never-negative invariant

- What:
  - Add a derived `ledgerCard(snapshot, artistId)` with one row per event: date, source (payment id and Ramp transaction id), sale, in, out and running balance.
  - Add a property-based test (fast-check) that runs random sequences of payments, cancels, deadline payouts and insolvency, and asserts that no artist's running balance ever drops below zero. The test also asserts the cards sum to the trust total.
  - The UI shows the card on the artist portal like a bank passbook.
- Why judges care: It is a fiduciary-grade sub-ledger with a randomized proof, not a demo-path test.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is read-only and derived from holds and payouts, which already exist.
- Grounding: [CalBar Handbook Key Concepts 2–3](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf), [NY 1.15(d)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15), [DC Rule 1.15 Comment 2](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property)

### Disputed portion stays locked, undisputed portion pays

- What:
  - Add a `disputedCents` field and a reason on a hold, set when the gallery claims a deduction such as Theo's $400 framing cost.
  - At payout, `releaseTrust` pays the undisputed part to the artist and leaves the disputed cents locked in trust.
  - The disputed cents stay locked until a resolution entry: the artist wins (pay the artist) or the artist accepts the deduction. Acceptance is booked by reducing the hold at split time on the next payment, never as a trust-to-gallery move.
  - Reconciliation counts disputed cents inside trust, so the identity holds.
- Why judges care: It encodes a real ABA rule exactly. The gallery can't pay itself a contested amount just by asserting it.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med. The resolution path has to go through the guard without adding a gallery destination. The simplest version only lets the artist release or keep the disputed cents, so `releaseTrust` keeps its artist|buyer targets.
- Grounding: [DC Rule 1.15(d)](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property), [NY 1.15(b)(4)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15), [ABA Model Rule 1.15](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_15_safekeeping_property.html), from the codebase (PRD tier 2 framing deduction)

### Collected-funds gate

- What:
  - Holds get a `collectedAt` timestamp.
  - Wire payments are collected on receipt. ACH and card stay uncollected for a fixed clearing window (for example two business days on the demo clock).
  - `releaseTrust` refuses to pay out an uncollected hold. The UI shows the hold as "in trust, clearing".
  - Uncollected holds still count in `trustCents`, so the identity is unchanged.
  - The demo uses wires, so the same-day payout beat is unaffected.
- Why judges care: Ramp engineers know ACH returns. This shows we won't pay an artist with money that can still bounce.
- Demo visibility: both
- Effort: S
- Demo risk: low. It only changes behavior for non-wire methods.
- Grounding: [CalBar Handbook Key Concept 4](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf), [Stewart good-funds bulletin](https://assets.stewart.com/content/stewart/virtualunderwriter/en/bulletins/2012-12/BL129688633300000011.html)

### Insufficient-funds notice to a regulator

- What:
  - When any release would take an artist's ledger, or the trust bank balance, below zero, `releaseTrust` throws as now and also appends a `TrustOverdraftNotice` record: time, attempted payee, amount, available balance, and a report-by date five business days later.
  - The notice is written even if the move "would have cleared".
  - A notices panel lists them. The insolvency beat can show a creditor grab attempt generating one.
- Why judges care: It turns a thrown error into the paper trail a real regulator expects.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is an append-only record on an existing refusal path.
- Grounding: [204 Pa. Code § 91.174](https://www.law.cornell.edu/regulations/pennsylvania/204-Pa-Code-SS-91-174), [Wyoming overdraft rule](https://www.wyomingbar.org/new-lawyer-trust-account-overdraft-rule), [NY 1.15 (no overdraft protection)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15)

### Positive pay on trust payouts

- What:
  - Before any outgoing trust transfer, Rescrow issues a positive-pay entry (payee id, amount, hold ids, nonce) into an issued-items list.
  - The fake bank side settles a debit only if it matches an issued item exactly, and marks it consumed so it can't be replayed.
  - Any unmatched debit is rejected and flagged.
  - A test forges a payout with the right amount and the wrong payee and shows it bouncing.
- Why judges care: It is defense in depth on the bank side, independent of the app's own guard, the way real escrow desks work.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It sits behind the `BankFeed` interface, and the demo path only issues matched items.
- Grounding: [ALTA BP #2, Positive Pay](https://www.invtitle.com/docs/cfpb/nc/abp2nc.pdf)

### Payout records that meet the NY and ABA standard

- What:
  - Extend `Payout` with `authorizedBy`, `payeeName` and `payeeAccountRef` (never blank or "cash"), `purpose`, and a bank `confirmationId` from the feed.
  - Every hold and payout row also records `enteredAt`, and a test asserts it is within a set tolerance of the event time.
  - Show it on the printable artist statement.
  - Needs new fields in `types.ts`.
- Why judges care: Every outbound dollar answers who approved it, who received it and the bank reference.
- Demo visibility: both
- Effort: S
- Demo risk: low. The fields are additive.
- Grounding: [NY 1.15(d), (e)](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15), [Hinshaw on ABA Client Trust Account Records rules](https://www.hinshawlaw.com/en/insights/lawyers-for-the-profession-alert/newly-adopted-aba-model-rule-115-offers-guidance-to-client-trust-account-maintenance-brings-lawyers-into-updated-technological-practices)

### Append-only, hash-chained trust journal

- What:
  - Every trust movement (lock, pay, refund) is appended to a `trustJournal` whose entries carry `prevHash` and `hash` over a canonical JSON form.
  - `verifyJournal()` recomputes the chain, and three-way reconciliation uses it as the journal leg.
  - A test edits one historic amount in the JSON store and shows verification naming the exact broken entry.
- Why judges care: Regulators require records that can't be quietly rewritten, and this proves it in about 40 lines.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is deterministic (Node `crypto` SHA-256, no network) and a reset rebuilds the chain.
- Grounding: [NY 1.15(d) contemporaneous records](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15), [DC Rule 1.15 Comment 2](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property)

### Shortfall detector with pro rata comparison

- What:
  - If the trust bank leg is ever below the sum of artist ledgers, `detectShortfall()` names the gap, blocks all gallery commission transfers, and requires an immediate top-up from operating, booked as a `shortfall_replaced` entry.
  - The insolvency screen adds one line: "Without segregation: each artist would get X% pro rata; with Rescrow: 100%."
  - X is computed from the actual demo numbers.
- Why judges care: It quantifies the hook ("8p in the pound") from live state instead of asserting it.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: med. The pro rata comparison is a counterfactual, so the label must make clear it is a what-if and not a ledger entry.
- Grounding: [SRA warning notice](https://www.sra.org.uk/solicitors/guidance/money-missing-client-account/), from the codebase (insolvency beat)

### Monthly close with reviewer sign-off and separation of duties

- What:
  - A `closePeriod(month)` produces an immutable report: the three-way figures, the outstanding items, open holds aged past half their `dueBy` window, and any breaks.
  - The report must be signed off by a `reviewer` role distinct from the `disburser` role that triggered payouts in that period. The code rejects the sign-off if they match.
  - Output is a printable page in the style of CalBar's Form Three.
- Why judges care: It mirrors real audit controls (maker-checker) that Ramp's own finance customers live with.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a report, not on the money path.
- Grounding: [ALTA BP #2, separation of duties](https://www.invtitle.com/docs/cfpb/nc/abp2nc.pdf), [CalBar Reconciliation Form](https://www.calbar.ca.gov/sites/default/files/portals/0/documents/ctapp/Reconciliation-Form.pdf)

### Trust-side debit block and unexpected-debit alarm

- What:
  - Model the trust account as credit-only from outside: only `releaseTrust`-issued debits are expected.
  - Any feed transaction that debits trust without a matching issued payout, even 47 cents, raises an `unexpected_debit` alarm, freezes further releases, and shows as a red break in reconciliation.
  - A fake-feed scenario injects one.
- Why judges care: It is a concrete fraud control taken from a real incident.
- Demo visibility: both
- Effort: S
- Demo risk: low. It is only triggered by a test fixture or a hidden key.
- Grounding: [Florida Bar News, 47-cent debit](https://www.floridabar.org/the-florida-bar-news/sarasota-lawyers-vigilance-over-47-cents-highlights-trust-account-vulnerabilities/), [ALTA BP #2, ACH block](https://www.invtitle.com/docs/cfpb/nc/abp2nc.pdf)

### Seeded random audit trace

- What:
  - `audit(seed, n)` uses a seeded PRNG to pick n holds and traces each end to end:
    - the agreement clause (the cited quote from the agreement reader);
    - the sale and the incoming payment with its Ramp transaction id;
    - the split math in basis points;
    - the hold, then the payout or refund with its confirmation.
  - Each step is marked pass or fail. The same seed always gives the same sample.
- Why judges care: It shows an auditor could verify any dollar without asking us, which is the In re Clower standard.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is deterministic and read-only.
- Grounding: [NJ random audit program](https://www.njcourts.gov/sites/default/files/forms/12996_random_audit_program.pdf), [DC Rule 1.15 Comment 2](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property)

### Bank charges ledger funded by the gallery

- What:
  - Ramp or bank fees on the trust account are charged against a small gallery-funded `feeBufferCents` line inside trust, recorded in a separate bank charges ledger.
  - Fees never touch an artist hold.
  - The reconcile identity gains one tracked term (buffer in, fees out), and a test proves a fee can't reduce any artist ledger.
- Why judges care: It handles the one legal exception to commingling exactly, which shows attention to edge cases.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: med. It adds a term to the reconcile identity, so every existing invariant test must be updated in the same change.
- Grounding: [DC Rule 1.15(f)](https://www.dcbar.org/for-lawyers/legal-ethics/rules-of-professional-conduct/client-lawyer-relationship/safekeeping-property), [CalBar Handbook, bank charges ledger](https://www.calbar.ca.gov/Portals/0/documents/ethics/Publications/2023_CTA_Handbook.pdf), [NY 1.15 account charges exception](https://www.law.cornell.edu/regulations/new-york/22-NYCRR-1200.1.15)
