# Accounting integration and month-end close for consignment galleries

How a gallery's accountant would see Rescrow: which accounts the money lands in, how those entries reach QuickBooks, Xero or NetSuite, how a month is closed and locked, and what an auditor pulls when testing the books. Other notes already cover the internal journal (`ledger-design.md`) and trust reconciliation with reviewer sign-off (`legal-trust-accounting.md`). This note covers the general ledger layer on top of them.

## What we learned

- Bookkeeping guides for galleries say the gallery books only its commission as revenue and carries the artist's share as a payable. On a 40/60 split of a $10,000 sale, that is $4,000 of revenue and $6,000 owed to the artist. [Invoice Data Extraction: art gallery consignment bookkeeping](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)
- The same guide says buyer sales tax or VAT is tracked separately, is not part of the artist's share, and stays out of the commission base. Deductions such as framing or shipping are allowed only when the agreement provides for them, and each one is listed on the artist's statement. [Invoice Data Extraction](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)
- Before paying an artist, the guide says to reconcile cash received, tax collected, commission recognized and payables. It also flags register states that need follow-up: a sale with no buyer funds, or buyer funds with no payout date. [Invoice Data Extraction](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)
- Under ASC 606, an entity that arranges for another party to provide the goods is an agent and recognizes only its fee or commission as revenue (net), not the gross price. Control of the goods is the deciding test. [Deloitte DART, ASC 606 chapter 10.3](https://dart.deloitte.com/USDART/home/codification/revenue/asc606-10/roadmap-revenue-recognition/chapter-10-principal-versus-agent-considerations/10-3-determining-whether-an-entity), [BillingPlatform: principal vs agent](https://billingplatform.com/blog/asc-606-principal-vs-agent)
- In practice the treatment varies. Intuit's own consignment guide uses a "Consignment Sales" income account with a "Consignment Payouts" sub-account, sets up each consignor as a supplier with its own Class, and never mentions a liability account. Shop owners in Intuit's community instead book the consignor's share as a current liability tracked per consignor. [QuickBooks: record consignment sales](https://quickbooks.intuit.com/learn-support/en-us/help-articles/how-to-record-consignment-sales/00/261331), [QuickBooks Community: consignee setup](https://quickbooks.intuit.com/learn-support/en-us/other-questions/re-how-to-set-up-consignment-as-the-consignee/01/958556/highlight/true)
- Ramp Banking syncs checking-account activity to the ERP as journal entries. That covers deposits, withdrawals, external wires and RTP payments, and transfers between Ramp accounts. Each checking account and linked bank account is mapped to a GL account. Sync runs daily or on demand, to QuickBooks, NetSuite, Xero, Sage Intacct and others, or to a Universal CSV file. [Ramp: Banking accounting](https://support.ramp.com/ramp-banking-accounting)
- Entries in Ramp's Banking table "cannot be deleted or hidden," which keeps the audit trail intact. An entry that failed in Ramp but was already recorded in the ERP can be cleared with "Mark as synced." [Ramp: Banking accounting](https://support.ramp.com/ramp-banking-accounting)
- Ramp's API for custom accounting connections works like this:
  - The partner uploads the gallery's GL accounts in all-or-nothing batches of up to 500.
  - Ramp marks objects `SYNC_READY`. Transfers are marked ready automatically; card transactions wait for a person to mark them.
  - The partner reports results to `POST /accounting/syncs` with a `sync_type`, an `idempotency_key`, and lists of successful and failed syncs.

  [Ramp developer docs: ERP integrations](https://docs.ramp.com/llms-guides/erp-integrations.txt)

- QuickBooks Online journal entries need at least one debit line and one credit line with matching totals. Each line has a `PostingType` of Debit or Credit, and QuickBooks computes `TotalAmt` itself, overwriting any value sent. [CData: QuickBooks JournalEntries table](https://cdn.cdata.com/help/RNK/jdbc/pg_table-journalentries.htm)
- Xero manual journals use signed line amounts: debits positive, credits negative. A journal whose lines don't sum to zero is rejected. [Stack Overflow mirror: Xero ManualJournals must balance](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/63173549/do-manualjournals-lineamounts-have-to-equal-to-zero-xero-api), [CData: Xero ManualJournals](https://cdn.cdata.com/help/DXN/jdbc/pg_accountingtable-manualjournals.htm)
- Each system locks a closed period in its own way:
  - QuickBooks Online sets a closing date. Edits before it either show a warning or require a password.
  - Xero has two lock dates: one stops everyone except advisers, the other stops everyone. An integration that publishes into a locked period gets the error "The document date cannot be before the end of year lock date."
  - NetSuite locks AR and AP separately, then Lock All. Only users with an override permission can post after a lock.

  [QuickBooks: close your books](https://quickbooks.intuit.com/learn-support/global/banking/close-your-books-to-lock-past-transactions/00/381456), [Dext: Xero lock dates](https://help.dext.com/en/articles/105721-how-do-xero-lock-dates-affect-publishing-in-dext), [Oracle NetSuite: locking periods](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1452163.html)

- PCAOB staff list the traits auditors look for in journal entries:
  - entries to unrelated, unusual or seldom-used accounts;
  - entries made by people who don't normally post;
  - period-end or post-closing entries with little or no description;
  - round numbers.

  A common inspection finding is that the auditor never tested whether the population of entries was complete. [PCAOB Audit Focus: Journal Entries (2025)](https://pcaobus.org/documents/audit-focus-journal-entries.pdf)

- One worked example of journal-entry testing proves completeness by rolling last year's trial balance forward with the year's entries, then comparing the result to this year's trial balance. It also checks that each entry's debits equal its credits, and selects entries posted on weekends or holidays. [Journal of Accountancy: journal entry testing in Excel](https://www.journalofaccountancy.com/issues/2021/nov/journal-entry-testing-excel.html)
- ASU 2016-18 requires restricted cash to be included with cash in the opening and closing totals of the cash flow statement. When the balance sheet shows more than one cash line, the filer must reconcile them to that total and disclose the nature of the restrictions. [PwC Viewpoint: ASU 2016-18](https://viewpoint.pwc.com/dt/us/en/fasb_financial_accou/asus_fulltext/2016/asu_201618statement_/asu_201618statement__US/asu_201618statement__US.html), [Hexion 10-K, 2016](https://www.sec.gov/Archives/edgar/data/0000013239/000001323917000009/hexion201610k.htm)

## How it applies to Rescrow

- `reconcile()` shows where the cash is, but it doesn't show how an accountant would classify it. A gallery's books need the trust cash, the matching liability to artists, and revenue that is commission only. Without that layer, Rescrow can't say what the gallery's P&L or balance sheet looks like after a sale.
- Installment sales raise a timing question that the current model doesn't answer. Is the gallery's share of payment 1 revenue, or a buyer deposit? `cancelSale` already treats it as a deposit, because the gallery's part is refunded from operating. The GL should say the same, which means commission is recognized only when the sale completes.
- That same deposit matters at insolvency. When creditors take the operating balance, they also take the gallery's share of open sales, so the buyer becomes an unsecured creditor for that amount. A statement of affairs can show this next to the trust money, which is ring-fenced and goes to artists in full.
- Ramp already syncs transfers between its own accounts as journal entries, and its API has a real sync contract (`SYNC_READY`, `idempotency_key`, successful and failed results). Rescrow can model its export on that contract and stay offline, which keeps the PRD's goal of being honest about Ramp.
- Closing a period is where trust accounting meets the ERP. A gallery should not be able to lock a month while the trust cash and the amount due to artists disagree, or while entries are still waiting to sync.

## Feature ideas

### Gallery chart of accounts and a GL view of every event

- What: Define a small chart of accounts:

  | Account | Name                          | Type               |
  | ------- | ----------------------------- | ------------------ |
  | 1010    | Operating cash                | asset              |
  | 1020    | Artist trust cash             | restricted asset   |
  | 2010    | Due to artists, held in trust | liability          |
  | 2020    | Buyer deposits                | contract liability |
  | 4010    | Commission revenue            | revenue            |
  | 3000    | Opening equity                | equity             |

  A pure `glEntries(snapshot)` turns every payment, payout, refund, cancellation and creditor claim into balanced debit and credit lines tagged with artist and sale. A `/books` panel shows the trial balance, with debits equal to credits to the cent. Build it on the journal from `ledger-design.md` if that lands first; otherwise derive it from the snapshot.

- Why judges care: it is the view of Rescrow that a gallery's accountant (and Ramp's accounting team) works in every day, and it is checked by a second, independent invariant.
- Demo visibility: both
- Effort: M
- Demo risk: low. It is a read-only view derived from existing state.
- Grounding: [Invoice Data Extraction](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping), [QuickBooks Community](https://quickbooks.intuit.com/learn-support/en-us/other-questions/re-how-to-set-up-consignment-as-the-consignee/01/958556/highlight/true), from the codebase (`reconcile.ts`, `engine.ts`)

### Trust tie-out: restricted cash equals due-to-artists, artist by artist

- What: An invariant says account 1020 equals account 2010 in total, and for every artist the 2010 balance equals that artist's locked holds. This is the control account checked against its subledger, the way Intuit's guide tags each consignor with a Class. The invariant runs in `invariants.test.ts` after every operation, and a badge on `/books` reads "Trust covered 100.00%".
- Why judges care: the trust guarantee becomes a balance-sheet identity that an accountant can check, not only an engine rule.
- Demo visibility: both
- Effort: S. Assumes the GL view exists.
- Demo risk: low
- Grounding: [QuickBooks: record consignment sales](https://quickbooks.intuit.com/learn-support/en-us/help-articles/how-to-record-consignment-sales/00/261331), from the codebase (`EscrowHold`, `invariants.test.ts`)

### Commission held as a buyer deposit until the sale completes

- What: Each installment credits the gallery's share to 2020 Buyer deposits, not to revenue. When the sale is fully paid, one entry moves the whole commission from 2020 to 4010 Commission revenue. A cancellation reverses from 2020, which matches the operating refund `cancelSale` already makes. A test also pins down one edge case. When a share was already paid to the artist on its `dueBy` date and the buyer then cancels, the buyer gets back less than they paid. The GL has to say where that difference sits (kept by the artist, or still owed to the buyer), so the policy is written down instead of left implicit.
- Why judges care: revenue is booked net as an agent and only when it is earned. That is correct under ASC 606, and the cancellation path already depends on it.
- Demo visibility: both
- Effort: M
- Demo risk: low. The reclassification line appears on the final payment beat.
- Grounding: [Deloitte DART 10.3](https://dart.deloitte.com/USDART/home/codification/revenue/asc606-10/roadmap-revenue-recognition/chapter-10-principal-versus-agent-considerations/10-3-determining-whether-an-entity), from the codebase (`cancelSale` refunds the gallery part from operating)

### Cash basis and accrual basis from the same entries

- What: A toggle on the gallery's P&L. On a cash basis, the gallery's share counts as income when it lands. On an accrual basis, it counts only when the sale completes, which is the deferral above. A test proves the two views converge once every sale is either complete or cancelled, and that they differ by exactly the 2020 balance while sales are open.
- Why judges care: it answers the first question a small business's bookkeeper asks, and the difference between the two views can be proved.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low
- Grounding: [QuickBooks: cash vs accrual](https://quickbooks.intuit.com/r/bookkeeping/understanding-the-basics-of-accrual-accounting/), from the codebase

### Map Rescrow accounts to the gallery's own chart of accounts

- What: The gallery uploads its account list, the way Ramp's API takes `POST /accounting/accounts`, then maps each Rescrow account to one of its own numbers. Validation rejects a bad map:
  - artist trust cash mapped to anything that isn't a bank account;
  - due-to-artists mapped to an income or equity account;
  - two Rescrow accounts mapped to one GL account.

  The upload is all-or-nothing, so one bad row rejects the batch.

- Why judges care: mapping into the customer's chart of accounts is the core of Ramp's accounting product, and here it also protects the trust classification.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low
- Grounding: [Ramp developer docs: ERP integrations](https://docs.ramp.com/llms-guides/erp-integrations.txt), [Ramp: Banking accounting](https://support.ramp.com/ramp-banking-accounting)

### Export files for QuickBooks, Xero and Universal CSV

- What: Pure serializers turn GL entries into three formats:
  - QuickBooks `JournalEntry` JSON, with `PostingType` lines and no `TotalAmt`;
  - Xero `ManualJournal` JSON, with signed `LineAmount`;
  - a flat CSV like Ramp's Universal CSV.

  Each entry's `DocNumber` or reference is derived from the event id, so re-exporting never creates duplicates. Golden-file tests check that every QuickBooks entry balances, that every Xero journal sums to 0, and that the output is byte-for-byte the same on every run. Nothing is sent over the network.

- Why judges care: it shows the books leave Rescrow in the exact shapes the target systems accept, without pretending to have a live connection.
- Demo visibility: both. Shown as a "Download for QuickBooks" button; the golden tests are the rigor.
- Effort: M
- Demo risk: low
- Grounding: [CData: QuickBooks JournalEntries](https://cdn.cdata.com/help/RNK/jdbc/pg_table-journalentries.htm), [CData: Xero ManualJournals](https://cdn.cdata.com/help/DXN/jdbc/pg_accountingtable-manualjournals.htm), [Ramp: Banking accounting](https://support.ramp.com/ramp-banking-accounting)

### Sync status modeled on Ramp's accounting API

- What: Each GL entry carries a sync state:
  - `NOT_READY`, then `SYNC_READY`, then `SYNCED` or `FAILED`.
  - Trust entries are rule-generated, so they become ready on their own, like Ramp's transfers. Manual adjustments wait for a person to mark them ready.

  A fake ERP that runs in-process accepts a batch and returns successful and failed lists keyed by an `idempotency_key`. A replay with the same key changes nothing. The fake rejects any entry dated inside a locked period with Xero's real lock-date error text. Synced entries can't be deleted, only reversed.

- Why judges care: it follows Ramp's real sync contract and its failure modes closely, and it runs offline.
- Demo visibility: repo-rigor. A sync column on `/books` is optional.
- Effort: L. Scoped to one target and no retries, it drops to M.
- Demo risk: low. It never touches the money path.
- Grounding: [Ramp developer docs: ERP integrations](https://docs.ramp.com/llms-guides/erp-integrations.txt), [Dext: Xero lock dates](https://help.dext.com/en/articles/105721-how-do-xero-lock-dates-affect-publishing-in-dext)

### Month-end close gate with two lock levels

- What: `closeMonth(galleryId, month)` runs named checks and refuses to lock if any fail:
  - the trial balance balances;
  - the trust tie-out holds;
  - no hold is past its `dueBy`;
  - no entry is waiting to sync;
  - `reconcile()` is clean.

  After a close, any posting dated in the month throws. A correction is a new adjusting entry dated in the open month that points to the entry it fixes. There are two lock levels, after Xero: "staff" (an override is allowed and logged) and "final" (nobody can post). The reviewer sign-off in `legal-trust-accounting.md` can sit on top of this.

- Why judges care: closing the books is the work Ramp's customers do every month, and this close won't run until the trust money is right.
- Demo visibility: both
- Effort: M
- Demo risk: low
- Grounding: [QuickBooks: close your books](https://quickbooks.intuit.com/learn-support/global/banking/close-your-books-to-lock-past-transactions/00/381456), [Oracle NetSuite: locking periods](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1452163.html), [Dext: Xero lock dates](https://help.dext.com/en/articles/105721-how-do-xero-lock-dates-affect-publishing-in-dext)

### Auditor's journal-entry test pack

- What: An export of every GL line with:
  - entry id and posted time;
  - source (`system` or `manual`) and user;
  - account, amount and description.

  Built-in checks run against it:
  - completeness: opening trial balance plus entries equals closing trial balance;
  - every entry balances;
  - no manual entry touches 1020 or 2010;
  - list manual entries that are round-number, posted on a weekend, posted after a close, or missing a description.

  A test seeds one bad manual entry and expects each check to name it.

- Why judges care: these are the exact tests PCAOB staff say auditors must run, and Rescrow can pass them as soon as it's set up.
- Demo visibility: repo-rigor. An "Audit pack: 6/6 checks pass" line is optional.
- Effort: M
- Demo risk: low
- Grounding: [PCAOB Audit Focus: Journal Entries](https://pcaobus.org/documents/audit-focus-journal-entries.pdf), [Journal of Accountancy](https://www.journalofaccountancy.com/issues/2021/nov/journal-entry-testing-excel.html)

### Cash flow statement with trust cash shown as restricted

- What: A monthly cash flow statement whose opening and closing totals include operating cash plus restricted trust cash. A reconciliation table ties those totals to the 1010 and 1020 balance-sheet lines. A generated note describes the restriction, for example: "held in trust for 3 artists under NY Arts and Cultural Affairs Law §12.01; earliest release due Dec 14."
- Why judges care: it presents the trust money the way a GAAP filer would present restricted cash, not as a custom label.
- Demo visibility: shown-on-screen
- Effort: M
- Demo risk: low
- Grounding: [PwC Viewpoint: ASU 2016-18](https://viewpoint.pwc.com/dt/us/en/fasb_financial_accou/asus_fulltext/2016/asu_201618statement_/asu_201618statement__US/asu_201618statement__US.html), [Hexion 10-K](https://www.sec.gov/Archives/edgar/data/0000013239/000001323917000009/hexion201610k.htm)

### Insolvency statement of affairs

- What: When the gallery goes under, generate a two-column statement. The left side, "Held in trust, not part of the estate," lists 1020 against 2010 by artist and shows each one paid in full. The right side, "Estate," shows operating cash taken by creditors, and lists buyer deposits on open sales (2020) as unsecured claims, because that cash was in operating. A test proves that the trust side always nets to zero and the estate side ties to `claimedByCreditorsCents`.
- Why judges care: it turns the demo's climax into the document an administrator would actually produce, and it is honest about who still loses money.
- Demo visibility: shown-on-screen. It appears on beat 6.
- Effort: M
- Demo risk: med. It adds a panel to the climax beat, so keep it to one screen and one key press.
- Grounding: from the codebase (`declareInsolvency`, `cancelSale`), [Invoice Data Extraction](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping)

### Sales tax kept out of the split

- What: A sale can carry a tax rate. Tax collected on each installment posts to a Sales tax payable account in operating. It is never added to the trust hold or to the commission base, so the artist's share is computed on the pre-tax price. `reconcile()` gains a tax line, and a property test over random prices and installment counts proves that tax + commission + artist share equals cash received, to the cent.
- Why judges care: real sales are taxed, and putting tax in the wrong bucket is a common consignment bookkeeping mistake.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: med. It changes the split math, so the demo seed keeps the tax rate at 0 unless the tax line is part of the story.
- Grounding: [Invoice Data Extraction](https://invoicedataextraction.com/blog/art-gallery-consignment-bookkeeping), from the codebase (`artistShareOfPayment`)
