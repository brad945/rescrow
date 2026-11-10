# Testing financial software rigorously

## What we learned

- fast-check has a model-based mode. `fc.commands` generates random sequences of actions. Each action has a `check(model)` precondition, a `run(model, real)` step with assertions, and a `toString` label for failure reports. `fc.modelRun` executes the sequence, and a failing sequence shrinks to a minimal counterexample. [fast-check: model based testing](https://fast-check.dev/docs/advanced/model-based-testing/)
- fast-check failures print a seed, a path and a `replayPath`. Passing them back replays only the minimal failing scenario, so a red CI run becomes a one-line local reproduction. [fast-check: model based testing](https://fast-check.dev/docs/advanced/model-based-testing/)
- TigerBeetle's VOPR runs real cluster code against simulated network, storage and process faults at about 1000x speed. It runs around the clock on 1024 cores. The double-entry design means value moves between accounts and never appears or vanishes. [TigerBeetle: Safety](https://docs.tigerbeetle.com/concepts/safety/)
- TigerBeetle made the same simulator into a browser game. Three scenarios (calm, flaky network, heavy disk corruption) show replicas recovering live. Their reasoning: make correctness testing something people can watch. They quote 3.3 seconds of simulation as about 39 minutes of real-world testing. [TigerBeetle: a distributed database in the browser](https://tigerbeetle.com/blog/2023-07-11-we-put-a-distributed-database-in-the-browser)
- Jepsen's audit of TigerBeetle praised its runtime assertions and its "exceptional resilience to disk corruption". It also found bugs the simulator had missed. One was a query bug the simulator's generated data never reached, because no generated object triggered that join path. The lesson: a random test is only as good as the states its generator reaches. [Jepsen: TigerBeetle 0.16.11](https://jepsen.io/analyses/tigerbeetle-0.16.11)
- FoundationDB simulates a whole cluster deterministically in one single-threaded process. Every run is repeatable, and failures are injected: dropped connections, machine reboots, clogged links. They estimate about one trillion CPU-hours of simulation in total, with tens of thousands of simulations run nightly. [FoundationDB: Simulation and Testing](https://apple.github.io/foundationdb/testing.html)
- FoundationDB's BUGGIFY puts fault points inside application code. They are always false in production. In simulation, each site is switched on or off once per run and then fires on some fraction of calls. This drives the system straight into rare multi-step situations that random low-level faults seldom produce. [Deterministic Simulation Testing: BUGGIFY](https://hn.jakechampion.name/reader/https://transactional.blog/simulation/buggify)
- Stripe's Ledger relies on double-entry and immutability. Intermediate "clearing" accounts should return to zero when a flow completes, and a leftover balance means money is stuck. Separate checks cover timeliness and completeness, and Stripe reports over 99.9999% explainability of money movement. [Stripe: Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)
- Stripe allows no direct edits to Ledger. Fixes are reversals plus reprocessing, reviewed with a data-quality impact report. [Stripe: Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)
- Uber's accounting pipeline uses shadow validation: it replays production requests through a release candidate and compares monetary totals per GL account against a threshold. Completeness checks require every event to land in exactly one of processed, filtered or errored. [Uber: accounting data testing strategies](https://www.uber.com/blog/accounting-data-testing-strategies/)
- The classic TLA+ bank example: two transfers each check the balance before either withdraws, and the account goes negative. The bug appears only in one interleaving. The model checker explores every behavior within small bounds and returns the exact trace of steps that breaks the invariant. [Learn TLA+: conceptual overview](https://learntla.com/intro/conceptual-overview.html)
- A payments-network write-up (seen in search results) models balances plus credits in flight as a conserved total. The first model fails because processing one message twice creates money. That is the duplicate-delivery bug idempotent ingest exists to stop. [NPCI: formal modelling](https://www.npci.org.in/blog/building-reliable-distributed-systems-with-formal-modelling)
- Mutation testing measures whether tests catch planted bugs, not just whether lines ran. StrykerJS has a Vitest runner, but it supports only the `threads` pool, not browser mode, and it always uses per-test coverage. [StrykerJS Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)

## How it applies to Rescrow

- The engine is already shaped for deterministic simulation. Every operation is a pure `Snapshot -> Snapshot` function (structuredClone in, new snapshot out), and time and ids come from an injectable `Clock`. That is the precondition FoundationDB and TigerBeetle had to build a framework to get. Here it is free.
- `invariants.test.ts` already runs 300 seeded random sales with a hand-rolled LCG, but one sale at a time, with only pay steps. Interleaving several sales with cancels, deadline ticks and insolvency is where real bugs would hide (the learntla lesson). A hand-rolled generator also gives no shrinking or replay.
- `reconcile()` has a weak spot. When `gallery.openingBalanceCents` is missing, it derives the opening balance from the operating balance. The operating-balance check then compares the balance against a figure built from itself, so that check cannot fail. The seed sets the field, but a check that can't fail should be tested by planting breaks on purpose.
- `releaseTrust` is the single exit from trust and guards `to` at runtime. Nothing yet proves that no other code sets a hold to `paid` or `refunded`. Today the only writer is line 110 of `engine.ts`, which can be locked in with a test.
- `IncomingPayment.rampTransactionId` is documented as "ingesting the same id twice is a no-op", but nothing reads it yet. Duplicate and reordered bank-feed delivery is the textbook money-creation bug (NPCI), so it deserves a property test the moment ingest exists.
- `shareOf` computes `amountCents * bps` in a JS number. Above roughly $9 billion that product passes `Number.MAX_SAFE_INTEGER` and silently loses cents. That is unrealistic for one artwork, but a judge who knows JS will ask about it.

## Feature ideas

### Model-based test of the whole engine with fast-check

- What: Add `fast-check` as a dev dependency and write `engine.model.test.ts`. Commands are CreateSale, Pay(amount), Cancel, AdvanceClock(days) + releaseDueHolds, DeclareInsolvency and DeclareInsolvencyAgain, interleaved across 2-4 sales and both galleries. The model is a tiny ledger: expected trust, operating, paid and refunded per artist. After every command, assert `reconcile().balanced`, model equals real, and illegal commands throw `EscrowError` without changing the snapshot.
- Why judges care: This is how serious payments teams test state machines. A minimal shrunk counterexample beats 300 hand-picked cases.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. Test-only, so the app is unchanged.
- Grounding: [fast-check model based testing](https://fast-check.dev/docs/advanced/model-based-testing/), from the codebase (`invariants.test.ts`, `engine.ts`)

### Seeded day-by-day simulator with a "run 10,000 days" button

- What: A pure `simulate(seed, days)` in `src/lib/sim.ts` uses a seeded PRNG and a simulated `Clock`. Each simulated day it randomly creates sales, delivers installments (some late, some uneven), cancels, ticks deadlines and occasionally bankrupts a gallery. It runs `reconcile()` after every step and returns `{ seed, steps, breaks, firstBreak? }`. A route exposes it. A small panel shows a counter climbing to "10,000 days, 41,000 operations, 0 breaks, seed 20261110", plus a replay link that reruns that exact seed.
- Why judges care: It's a small version of TigerBeetle's VOPR, and it shows a property you can rerun, not a claim.
- Demo visibility: both
- Effort: M
- Demo risk: low. It's pure and deterministic, and capped by step count so it finishes in about a second.
- Grounding: [TigerBeetle browser simulator](https://tigerbeetle.com/blog/2023-07-11-we-put-a-distributed-database-in-the-browser), [FoundationDB testing](https://apple.github.io/foundationdb/testing.html), from the codebase (`Clock`, pure engine)

### Planted-break catalogue for reconcile()

- What: A test table of hand-made corruptions, each applied to a healthy snapshot:
  - add $0.01 to operating;
  - delete a hold;
  - list one hold in two payouts;
  - mark a hold `paid` with no payout;
  - put more in trust than was received;
  - drop `openingBalanceCents`.

  Assert that each one makes `reconcile()` unbalanced, with the expected named break. Fix the circular opening-balance fallback: make the field required, or report a break when it is missing.

- Why judges care: It proves the checker can actually fail. Most "we reconcile" claims are never tested against broken books.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It hardens an existing pure function.
- Grounding: from the codebase (`reconcile.ts` line 64), [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)

### Live "tamper" key in the demo

- What: A demo-only route applies one planted break from the catalogue to the store, such as moving $1 from trust to operating by direct edit and skipping `releaseTrust`. The reconciliation badge flips red and names the break in plain English ("Operating balance is $X but the records add up to $Y"). Reset restores it.
- Why judges care: Ten seconds that show the books catch tampering. Watching the check go red makes it believable when it shows green.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: med. A forgotten reset leaves the demo red, so reset and the demo-flow test must cover it.
- Grounding: from the codebase (`reconcile.ts` breaks, `R` reset), [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement)

### Generator coverage gates

- What: In the model-based test and the simulator, count which transitions actually fired:
  - locked to paid on sale completion;
  - locked to paid on deadline;
  - locked to paid on insolvency;
  - locked to refunded on cancel;
  - a rejected overpayment;
  - a payment rejected after insolvency.

  Fail the suite if any count is zero, or below a floor across N runs. Use `fc.statistics` or a counter map.

- Why judges care: It applies the Jepsen lesson. A random test that never reaches a path proves nothing about that path.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. Test-only.
- Grounding: [Jepsen: TigerBeetle 0.16.11](https://jepsen.io/analyses/tigerbeetle-0.16.11)

### Bounded exhaustive explorer (TLC-style, in TypeScript)

- What: A vitest test that runs breadth-first search over every sequence of up to about 6 operations, with small amounts (1-3 cents), 2 sales and 3 clock positions. States are deduplicated by a canonical hash of the snapshot. At every state it checks the invariants: reconcile balanced, no negative balances, trust only ever decreases through `releaseTrust`, and an insolvent gallery accepts nothing. On failure it prints the shortest trace.
- Why judges care: It gives model-checker-style exhaustiveness with no Java toolchain. That beats random sampling for small rounding cases like 1-cent payments at odd bps.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. Test-only. State count must be bounded to keep CI fast.
- Grounding: [Learn TLA+](https://learntla.com/intro/conceptual-overview.html)

### TLA+ spec of the hold lifecycle

- What: A short `spec/Trust.tla` with variables for holds, operating, creditors and paid, and actions Receive, Complete, DeadlineTick, Cancel and Insolvent. Its invariants are conservation, "creditors never receive trust money" and "every hold ends paid or refunded". Commit a TLC config and the model-checker output, and link it from the README. It is a reference design, not run in CI.
- Why judges care: A formal spec of the core guarantee is uncommon in a hackathon repo, and it states the rule apart from the code.
- Demo visibility: repo-rigor
- Effort: L
- Demo risk: low. It sits outside the app. The risk is effort, not the demo.
- Grounding: [Learn TLA+](https://learntla.com/intro/conceptual-overview.html), [NPCI: formal modelling](https://www.npci.org.in/blog/building-reliable-distributed-systems-with-formal-modelling)

### Idempotent bank-feed ingest, property-tested against duplicates and reordering

- What: Implement ingest on the existing `rampTransactionId`, with a `FakeBankFeed` that can deliver duplicates, reorder pages and replay the full history. Properties:
  - feeding the same transactions twice gives the same snapshot as feeding them once;
  - any delivery order of a batch for different sales gives the same totals;
  - reconcile stays balanced throughout.
- Why judges care: Duplicate delivery creating money is the standard payments failure, and Ramp-style polling makes replays a real risk.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. A new code path behind the existing payment route.
- Grounding: from the codebase (`types.ts` `rampTransactionId`, PRD tier 1 item 6), [NPCI: formal modelling](https://www.npci.org.in/blog/building-reliable-distributed-systems-with-formal-modelling)

### "Only one door out of trust" architecture test

- What: A test reads `src/**/*.ts` (excluding tests) and fails if any line other than the one in `releaseTrust` assigns a hold `status` of `paid` or `refunded`, or builds a `Payout` outside `payOut`. A runtime companion: freeze hold objects in tests, so a write from any other path throws.
- Why judges care: It turns "the only code path out of trust" from a comment into a check that breaks the build.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. Test-only. A regex check is crude, so an AST check is better if time allows.
- Grounding: from the codebase (`engine.ts` `releaseTrust`, line 110)

### Safe-integer guard and money-math properties

- What: Properties over `shareOf` and the running-total split:
  - results are always `Number.isSafeInteger`;
  - artist plus gallery parts equal the payment exactly;
  - the sum of per-installment artist shares equals `shareOf(price, bps)` at completion, for any installment schedule;
  - shares are monotone in bps.

  Add an explicit input cap, or BigInt multiplication, so large amounts throw instead of rounding wrong.

- Why judges care: It removes a silent precision bug class that JS money code often has.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. The guard sits far above any demo amount.
- Grounding: from the codebase (`money.ts` `shareOf`), [fast-check](https://fast-check.dev/docs/advanced/model-based-testing/)

### BUGGIFY-style fault points in the store and engine

- What: A `chaos(site, sim)` helper that is always false outside the simulator. Inside the simulator it fires according to the seed. Sites:
  - throw after the temp-file write but before the rename in `store.ts`;
  - throw between two holds inside one `releaseTrust` call;
  - deliver a payment twice.

  Assert the store is either fully old or fully new, and that a half-finished release never shows up in a saved snapshot.

- Why judges care: It tests the failure moments payments systems actually hit: crashes mid-write and partial batches.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. No behavior changes outside simulation, though the site checks must stay out of the request path.
- Grounding: [BUGGIFY](https://hn.jakechampion.name/reader/https://transactional.blog/simulation/buggify), from the codebase (`store.ts` temp-file + rename)

### Mutation score on the money core

- What: Run StrykerJS with the Vitest runner on `src/lib/escrow/**` and `src/lib/money.ts` only, with a `break` threshold. Publish the score and a short list of surviving mutants and how each was handled in `docs/testing.md`. Ship it as an optional script, not in the gate, since the runner needs the `threads` pool and the repo uses jsdom.
- Why judges care: "Our tests kill X% of planted bugs in the ledger" is a stronger number than line coverage.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It sits outside the demo, though runner setup with jsdom may need a separate config.
- Grounding: [StrykerJS Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)

### Clearing-account check: every flow ends at zero

- What: Add a "settlement" view to `reconcile()`. For each completed or cancelled sale, the trust left for it must be exactly 0, and for each open sale it must equal the artist share of what has been paid. For each insolvent gallery, operating and trust must both be 0. Any leftover is reported as a named "stuck money" break, shown per sale in the existing reconciliation panel.
- Why judges care: It matches Stripe's clearing-account check, and it catches stuck money even when the grand totals balance.
- Demo visibility: both
- Effort: S
- Demo risk: low. A pure addition to `reconcile()`, and the existing panel renders breaks.
- Grounding: [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement), from the codebase (`reconcile.ts`)

### Shadow replay of the event log

- What: Rebuild the final snapshot from the activity log alone. Replay each logged operation into a fresh seed with the recorded clock and ids, and assert the result is deep-equal to the stored snapshot. Run it in tests after the demo flow, and from a `?verify=replay` check on the reconciliation panel.
- Why judges care: It shows the state is fully explained by its history, the immutability and audit property Stripe and Uber both rely on.
- Demo visibility: both
- Effort: M
- Demo risk: med. The activity log may not yet record every input needed to replay, such as amount and method, so an additive type change may be required.
- Grounding: [Stripe Ledger](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement), [Uber shadow validation](https://www.uber.com/blog/accounting-data-testing-strategies/)
