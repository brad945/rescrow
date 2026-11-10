# Rescrow PRD (build round)

**Due:** Tue Nov 10, 11:59 PM PT (we submit at 10 PM). **Submit:** the GitHub repo and a recorded demo (form: https://forms.gle/FxUVTm6Z75f121ov5). **Final:** Nov 19, presented live to Ramp engineers. They will ask why we chose each tool, so the decisions log below is part of the deliverable.

**Lanes:** A = backend (Bradley), B = frontend (Neil). File ownership is in `CLAUDE.md`. Specs: `docs/spec-A-backend.md`, `docs/spec-B-frontend.md`.

## 1. The problem

An artist consigns a painting to a gallery. A collector buys it, often in installments, and about half the price belongs to the artist. NY Arts and Cultural Affairs Law §12.01 makes those proceeds trust funds, but nothing makes the gallery keep them separate. They land in the same account as rent and payroll, and if the gallery fails, the money is gone. In February 2026, Stephen Friedman Gallery went into administration owing Kehinde Wiley £163,849, and unsecured creditors expect 8 to 9 pence per pound (sources in `docs/demo-script.md`). ArtCloud tells the gallery what it owes but never guarantees the money. Arcual can split a sale, but only when the sale runs through its own platform.

**Rescrow sits on the gallery's bank account (Ramp).** An agent reads the consignment agreement and works out the artist's share. When the buyer's money lands, that share moves to a separate trust account the gallery can't spend. The artist is paid the day the sale completes, and never later than the deadline in their agreement.

## 2. Demo script (the acceptance test)

**The canonical script is Neil's `docs/demo-script.md`**, played on `/present` (Ines Duarte, _Orchard in Rain_, $24,000, three payments). Lane A adds one beat at the end:

| Beat       | What happens                                                                                                                                                                                                                                      | Backend                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1–5        | As in `docs/demo-script.md`: the agent reads the agreement, the collector buys, three payments each split into trust and operating, then a same-day payout with a statement                                                                       | already works                           |
| (optional) | The buyer cancels halfway, and the artist's share goes back to the buyer from trust                                                                                                                                                               | already works                           |
| **6, new** | **The gallery goes under.** Creditors take the operating balance. Every dollar in trust is paid straight to its artists, because trust funds aren't the gallery's property. The code refuses any move of trust money to the gallery or creditors. | `POST /api/demo/insolvency` (spec A §3) |

For beat 6 to show money landing in trust, run it after payment 2 and before the final payment. It closes the loop on the Kehinde Wiley hook: "Same failure. This time the artist gets paid."

**Live agent:** saved answers are the default, so nothing stalls on camera. One optional live call uses whatever local model Ollama has (spec A §4). If it fails, it falls back automatically and the screen says which source was used.

## 3. Scope

**Tier 1, must ship:**

1. **Payout rule (D4):** hold the share until the sale completes, then pay it the same day. Never pay later than the agreement's deadline: each hold carries a `dueBy` date, and a hold that reaches it before the sale completes is paid out then.
2. **Trust guard:** every move of money out of trust goes through one function, which only allows the artist or a refund to the buyer.
3. **Insolvency** (beat 6).
4. **Reconciliation:** a pure function proving received = operating + trust + paid out + refunded + claimed by creditors, to the cent.
5. **Agent:** a real local-model call with a JSON schema, validation, citations snapped to the exact text, a timeout, and fallback to saved answers.
6. **Ramp feed:** a `BankFeed` interface that polls transactions like Ramp's real banking API, with a fake implementation. Ingest is idempotent on the transaction id.

**Tier 2, only if tier 1 is done by ~2 PM:** framing deduction (Theo, capped at $400), a disconnect alert on the artist portal, a printable statement.

**Cut:** webhooks (Ramp's API has no deposit webhook), discount sharing, multi-gallery, auth, email, a real Ramp connection.

## 4. What makes this "wow" for a Ramp engineer

1. **It survives the failure case.** The demo ends with the gallery going bankrupt, and the artist still gets paid.
2. **The rule is code, not policy.** Moving trust money to operating or creditors throws. There's a test for it, and we show it.
3. **Balances to the cent.** Running-total rounding (D5), plus reconciliation after every operation in tests.
4. **The agent shows its work.** Every number is backed by a quote found word for word in the agreement and highlighted. A quote that can't be found is flagged, never trusted.
5. **It's honest about Ramp.** It polls banking transactions the way Ramp's API really works, behind one interface, so the real swap is one class.

## 5. Decisions log

| #   | Decision                                                                      | Why                                                                                                                                                   | Rejected                                                                                                                           |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Fake Ramp feed behind a polling `BankFeed` interface                          | No sandbox access in 24h, and the demo has to run offline. Ramp's banking API is read-only with no deposit webhook, so polling matches reality.       | Webhooks (Ramp doesn't have them for deposits); calling a live API on camera                                                       |
| D2  | Local model via Ollama, any installed model                                   | Consignment agreements are confidential contracts that stay on the gallery's machine. Free, works offline, nothing to download for the demo.          | A hosted LLM API (sends contracts to a third party, costs money, needs a network)                                                  |
| D3  | JSON schema + validation + citation snapping                                  | An LLM shouldn't be trusted with money. Every number needs a quote that's actually in the text.                                                       | Free text parsed with regex                                                                                                        |
| D4  | Hold until the sale completes, with a per-payment deadline from the agreement | Holding lets a buyer who backs out be refunded from trust. The deadline honors Mara clause 4 and Ines clause 4 ("runs from receipt of each payment"). | Paying each installment immediately (no refund protection); holding with no deadline (breaks the agreements on long payment plans) |
| D5  | Integer cents, running-total rounding                                         | Rounding each installment separately leaks cents ($4,750.01 vs $4,750.00 on _Salt Study_ in 3 payments)                                               | Floats, rounding each installment on its own                                                                                       |
| D6  | One guarded function for all trust outflows                                   | "The gallery can never spend it" becomes something the code refuses to do                                                                             | Mutating balances anywhere                                                                                                         |
| D7  | JSON file store                                                               | Inspect and reset in one second                                                                                                                       | Postgres (roadmap)                                                                                                                 |
| D8  | Poll `/api/state` every 1.5s                                                  | Simple, fast enough                                                                                                                                   | WebSockets                                                                                                                         |
| D9  | Two lanes, disjoint files, push to main                                       | Two people, one day, no merge conflicts                                                                                                               | Branches + PRs                                                                                                                     |

## 6. Roadmap

Poll Ramp's real banking transactions, open a Ramp Checking account per gallery for trust, pay artists via Ramp transfers, emailed statements, PDF agreement upload, per-state trust law (NY §12.01, CA Civil Code 1738.5–1738.9).

## 7. Timeline

| When     | A (Bradley)                                                  | B (Neil)                                                 |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Tonight  | Docs, `ActivityFeed` fix, additive types                     | `/present`, redesign (done)                              |
| By 12 PM | Deadline rule, trust guard, insolvency route, reconciliation | Add beat 6 to `/present` (see `docs/requests-from-A.md`) |
| 12–3 PM  | Agent live call + citation snapping, Ramp feed               | Reconciliation badge, "due by" on the artist portal      |
| 3–5 PM   | Tier 2                                                       | Polish                                                   |
| 5–6 PM   | Run the full script together                                 | same                                                     |
| **6 PM** | **Freeze**                                                   |                                                          |
| 8 PM     | Record                                                       | Record                                                   |
| 10 PM    | **Submit**                                                   |                                                          |
