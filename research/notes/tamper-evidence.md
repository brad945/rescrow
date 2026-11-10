# Tamper-evident records and what an artist can verify

How certificate transparency, transparency logs, and exchange proof of reserves make records checkable by outsiders, where those schemes fail, and what Rescrow can borrow so an artist can check their trust money without trusting the gallery.

## What we learned

- RFC 9162 (Certificate Transparency 2.0) hashes leaves as `HASH(0x00 || entry)` and interior nodes as `HASH(0x01 || left || right)`. The RFC calls this domain separation "required to give second preimage resistance". The number of leaves alone fixes the tree's shape, so the leaf count doesn't need to be a power of two. [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html)
- RFC 9162 defines two kinds of proof. An inclusion proof is the sibling hashes along one leaf's path to the root. A consistency proof shows that an older tree is a prefix of a newer one, so nothing earlier was changed or removed. Each proof is about log2(n) hashes, and the RFC gives step-by-step verification algorithms for both. [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html)
- A CT log signs a tree head that contains a timestamp, the tree size and the root hash. Monitors must inspect every new entry, and auditors use the two proofs to check that the log behaves. [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html)
- In practice, a log returns a signed timestamp that promises to include the certificate within the Maximum Merge Delay, usually about 24 hours. Chrome and Safari require at least two of these. Monitors alert domain owners about certificates they never asked for. [Certificate Transparency: how CT works](https://certificate.transparency.dev/howctworks/)
- Transparency.dev's guidance is that a client shouldn't accept a record just because the log served it. Clients must keep copies of past tree heads so they can check later heads for consistency. A "log-backed map" makes a change take effect only once it appears in the log. [transparency.dev: verifiable data structures](https://transparency.dev/verifiable-data-structures/)
- A C2SP checkpoint is a small signed text note with three lines: origin (the log's name), tree size in decimal, and the root hash in base64. A log or cosigner must never sign two checkpoints that no consistency proof can connect. [C2SP tlog-checkpoint](https://github.com/C2SP/C2SP/blob/main/tlog-checkpoint.md)
- In C2SP, a witness checks each new checkpoint for consistency against the latest one it has saved before it adds an Ed25519 cosignature. Clients can require a quorum of cosignatures, which stops a log from showing different histories to different people (a "split view"). [C2SP tlog-cosignature](https://github.com/C2SP/C2SP/blob/main/tlog-cosignature.md)
- Crosby and Wallach's history tree, a Merkle tree over log events, makes auditing and lookup logarithmic. They contrast it with hash chains, where auditing stays linear. [Crosby and Wallach, USENIX Security 2009 (slides)](https://static.usenix.org/events/sec09/tech/slides/crosby.pdf)
- Maxwell's proof of liabilities puts customer balances in a Merkle sum tree. Each node is a (balance, hash) pair, the parent's balance is the sum of its children's, and the root shows the total owed. Each user checks their own branch against the published root. Users can still infer things about neighbouring balances. Fiat holdings can only be attested by banks, not proven cryptographically. [Vitalik Buterin: having a safe CEX](https://vitalik.eth.limo/general/2022/11/19/proof_of_solvency.html)
- Hu, Zhang and Guo showed that the original summation Merkle tree is insecure. An exchange could understate its total liabilities, and could even pass verification with only one account included. They propose fixes to how parent sums are bound into the hash. [IACR ePrint 2018/1139](https://eprint.iacr.org/2018/1139)
- Kraken's proof-of-reserves leaf is a hash of a per-user record ID plus that user's balances. Users get their sibling hashes so they can rebuild the path to the root themselves. Kraken warns that the result depends on the exact string formatting of the balances. [Kraken: proof of reserves](https://www.kraken.com/gb/proof-of-reserves)
- The PCAOB warned in 2023 that proof-of-reserve reports are "not audits". They cover a single point in time, may count borrowed assets, and likely don't examine liabilities. Earlier, Mazars had pulled its Binance report and paused all such work for crypto firms. [Accounting Today on the PCAOB advisory](https://www.accountingtoday.com/news/pcaob-warns-about-limitations-on-crypto-proof-of-reserve-reports), [Decrypt on Mazars](https://decrypt.co/117416/bnb-plummets-binance-auditor-mazars-halts-work-crypto-firms)
- Amazon QLDB let users check a document revision against a saved journal digest using a Merkle proof. The service's end of support was 07/31/2025. That is a reason to keep the verifier in the user's hands rather than inside a hosted service. [AWS QLDB: data verification](https://docs.aws.amazon.com/de_de/qldb/latest/developerguide/verification.html)
- RFC 8032 says "EdDSA signatures are deterministic". No random number is needed per signature, so a fixed key and message always produce the same signature. [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)
- RFC 8785 (JCS) makes JSON hashable by sorting properties, removing whitespace and serializing numbers the way ECMAScript does. It is an Informational RFC, not a standard. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)

## How it applies to Rescrow

- **A gallery-controlled hash chain is not enough.** The hash-chained journal proposed in `ledger-design.md`, `ramp-platform.md` and `gallery-collapses.md` catches a hand edit to one row. But whoever controls the JSON store can rewrite history and recompute every hash, and `verifyChain()` will still pass. Tamper evidence only starts once a root hash leaves the gallery's control. In CT that copy is the signed tree head held by browsers and monitors. In Rescrow it should be a signed checkpoint (origin, size, root) that goes to the artist with every hold receipt. The next statement then has to carry a consistency proof from the checkpoint the artist already holds. That is what "the artist can verify independently" means, and it is the gap all three existing notes leave open.
- **Rescrow already fixes the main criticisms of proof of reserves.**
  - _Point in time:_ Rescrow can sign a checkpoint after every operation, not once a quarter.
  - _Liabilities missing:_ trust holds are the liabilities, so a per-artist Merkle sum tree is a natural fit, and its root must equal `reconcile().trustCents`.
  - _Negative balances and understated sums:_ rule that every leaf is greater than 0 and every parent is the exact sum of its children, and test both.
  - _Exclusion:_ an artist can't see a payment that was never recorded. Tie each leaf to its `rampTransactionId` and also give the buyer a receipt.
- **Say plainly what the proofs don't cover.** A proof shows what Rescrow's ledger says. It does not show that the bank holds the cash. Fiat can only be attested by the bank, so the Ramp `BankFeed` covers that side. Ramp engineers will trust a "what this proves / what it doesn't" panel more than a claim of "provable solvency".
- **Determinism.**
  - `generateKeyPairSync` is random, so a reset would change every signature. Use a fixed 32-byte demo seed, imported as a JWK and labelled demo-only, in `seed.ts`.
  - Ed25519 signing is deterministic (RFC 8032 §8.2), so with a fixed seed every reset produces the same checkpoints byte for byte, and tests can pin the expected signatures.
  - Canonical JSON can be a small sorted-key serializer, because all money is integer cents and there are no floats. It follows the JCS idea without claiming full RFC 8785 compliance.
- **Every idea below only reads the Snapshot.** None of them changes `releaseTrust`, the trust guard or `reconcile()`. Checkpoints and proofs are computed from records that already exist, so the books keep balancing, and the most a bug in proof code can do is fail verification.

## Feature ideas

The ideas build on the hash-chained journal described in `ledger-design.md` ("Shadow append-only journal", "Hash-chained journal with a tamper check"). Until that journal exists, the log can be the ordered list of `Activity` rows plus the hold and payout records they mention. Leaves use RFC 9162 hashing: `sha256(0x00 || canonical(entry))` for a leaf, `sha256(0x01 || L || R)` for a node. Everything uses Node's built-in `crypto` and runs offline.

### Signed checkpoint after every write

- What: Add `checkpoints: Checkpoint[]` to the Snapshot, where each one is `{ origin: "rescrow/gal_lowline", size, rootB64, at, sigB64 }`. `mutate()` appends one after every operation, signed with Ed25519 using a fixed demo key built from a seed in `seed.ts`. The UI's reconciliation strip shows the latest one as `size 14 · root 3f9a…c2` with a "signed" chip.
- Why judges care: a ledger that commits to its own state after every write is how CT and Trillian work. It is more than a log that happens to have hashes.
- Demo visibility: both
- Effort: M
- Demo risk: low. The code only reads the Snapshot and is deterministic, so a fixed seed means the same root and signature on every reset.
- Grounding: [C2SP tlog-checkpoint](https://github.com/C2SP/C2SP/blob/main/tlog-checkpoint.md), [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html), [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)

### Hold receipt with an inclusion proof

- What: When a hold is locked, the artist portal gets a downloadable `receipt.json`. It contains the leaf (`holdId, paymentId, rampTransactionId, saleId, amountCents, dueBy`), its leaf index, the signed checkpoint and the sibling hashes up to the root. A pure `verifyInclusion(receipt, publicKey)` recomputes the root and checks the signature. The portal shows a "Receipt verified: $X in trust, due by D" card next to each hold.
- Why judges care: this is proof of liabilities for one artist. They can check their own money without trusting the gallery's dashboard.
- Demo visibility: both
- Effort: M
- Demo risk: low. The receipt is generated from data the app already has, and verification needs no network.
- Grounding: [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html), [Kraken: proof of reserves](https://www.kraken.com/gb/proof-of-reserves)

### Artist-held checkpoint and consistency check

- What: The artist portal saves the last checkpoint the artist has seen. In the demo that lives in the Snapshot under `artistViews[artistId]`, since there is no auth, and in real life it would be a file the artist keeps. Each new statement or payout carries a consistency proof from that size to the current one, and `verifyConsistency(old, new, proof)` must pass before the portal shows a green "history unchanged since your last receipt". A failure shows the size at which the two histories split.
- Why judges care: this is the one check that catches the gallery rewriting the whole file and recomputing every hash, which a plain hash chain can't catch.
- Demo visibility: both
- Effort: M (upper end. The RFC 9162 consistency algorithm is fiddly, and the fuzz test below covers it.)
- Demo risk: med. An off-by-one in proof generation would show red on camera, so the fuzz test needs to pass before this goes in the demo.
- Grounding: [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html), [transparency.dev: verifiable data structures](https://transparency.dev/verifiable-data-structures/)

### "Rewrite history" button: gallery green, artist red

- What: A demo-only control on `/lab` (or the key `H` on `/present`) simulates a gallery that edits an old hold from $4,000 to $2,000 and then rebuilds the whole chain and re-signs the checkpoint. The gallery's own `verifyChain()` and checkpoint signature both stay green. The artist's saved checkpoint fails its consistency check and turns red with "the record at position 6 changed after you were given a receipt". The change is applied to a copy of the Snapshot, so the real books and `reconcile()` are never touched.
- Why judges care: in ten seconds it shows the difference between tamper-evident to whoever controls the file and tamper-evident to the person owed the money.
- Demo visibility: shown-on-screen
- Effort: S, once the checkpoint and consistency ideas exist
- Demo risk: low. It runs on a copy and is scripted, and reset puts everything back.
- Grounding: [C2SP tlog-cosignature](https://github.com/C2SP/C2SP/blob/main/tlog-cosignature.md), from the codebase (`store.ts` JSON file, `/present` key controls)

### Merkle sum tree of trust balances

- What: `trustTree(snapshot)` builds a sum tree with one leaf per locked hold: `(amountCents, hash(0x00 || holdId || artistId || amountCents || dueBy))`. Each node is `(sumL + sumR, hash(0x01 || sumL || hashL || sumR || hashR))`, so both children's sums are bound into the hash, following the Hu et al. fix. The root sum must equal `reconcile().trustCents`, and a test asserts it after every operation. The portal draws the artist's branch as a small tree, with their leaf highlighted and the sums adding up to "total held in trust for all artists".
- Why judges care: this is exchange-style proof of liabilities with the known flaw fixed, and it ties directly to the existing reconciliation.
- Demo visibility: both
- Effort: M
- Demo risk: low. It only reads the Snapshot, and the sums are integer cents.
- Grounding: [Vitalik Buterin: having a safe CEX](https://vitalik.eth.limo/general/2022/11/19/proof_of_solvency.html), [IACR ePrint 2018/1139](https://eprint.iacr.org/2018/1139)

### Adversarial tests for the sum tree

- What: A `trust-tree.attacks.test.ts` file plays a dishonest gallery against the verifier:
  - insert a −$5,000 leaf to hide a shortfall;
  - set a parent's sum to the larger child's value instead of the sum, the understatement in Hu et al.;
  - drop one artist's leaf;
  - reorder leaves to move a hold;
  - give two artists the same leaf.

  Each case must be rejected by `verifyBranch` or by the rule that the root equals `trustCents`, with the reason named.

- Why judges care: it shows we read the attack literature and tested against it, not only the happy path.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. These are tests only.
- Grounding: [IACR ePrint 2018/1139](https://eprint.iacr.org/2018/1139), [Vitalik Buterin: having a safe CEX](https://vitalik.eth.limo/general/2022/11/19/proof_of_solvency.html)

### Standalone receipt verifier the artist can run

- What: `scripts/verify-receipt.ts` imports only `node:crypto` and the pure proof functions, and is runnable as `npx tsx scripts/verify-receipt.ts receipt.json [older-receipt.json]`. It prints the leaf, the recomputed root, whether the signature is valid and, given two receipts, whether the history is consistent. A test runs it against fixture receipts and diffs the output. The public key is printed on every statement, so the artist doesn't need the Rescrow server at all.
- Why judges care: "verify independently" stops being a slogan when the verifier works with the app turned off. QLDB's shutdown shows why this matters.
- Demo visibility: both (a two-second terminal cut is possible)
- Effort: S
- Demo risk: low. It is offline and deterministic.
- Grounding: [AWS QLDB: data verification](https://docs.aws.amazon.com/de_de/qldb/latest/developerguide/verification.html), [transparency.dev: verifiable data structures](https://transparency.dev/verifiable-data-structures/)
- Note: Ed25519 support in browser WebCrypto was not confirmed during this research. Verify on the server or in the script, or check browser support before promising in-page verification.

### Witness cosignature against split views

- What: Add a second fixed key for a "witness" played by a stand-in such as an artists' association or the gallery's bank. `witnessCosign(checkpoint)` saves the witness's latest checkpoint and refuses to cosign unless a consistency proof links the new one to it. Receipts then need both signatures. A test shows the attack: the gallery gives Ines one history and Theo another, and the witness refuses the second branch.
- Why judges care: it shows the next problem after tamper evidence, a gallery showing each artist a different story, and solves it the way CT does.
- Demo visibility: repo-rigor (a "cosigned by witness" chip on the receipt is optional)
- Effort: M
- Demo risk: low. It is pure functions with a fixed key.
- Grounding: [C2SP tlog-cosignature](https://github.com/C2SP/C2SP/blob/main/tlog-cosignature.md), [Certificate Transparency: how CT works](https://certificate.transparency.dev/howctworks/)

### Buyer payment receipt to close the exclusion gap

- What: Every `receivePayment` also issues the buyer a receipt containing the same leaf (with `rampTransactionId`) and its inclusion proof. The artist's statement lists the installment count and amounts per sale. A test plays a gallery that never records payment 2. The buyer's receipt for that payment won't verify against any checkpoint, and the artist sees "2 of 3 installments recorded" against a sale price that says otherwise.
- Why judges care: it answers the strongest criticism of proof of liabilities, that you can't prove something wasn't left out, by giving a second party a receipt for the same money.
- Demo visibility: repo-rigor
- Effort: M
- Demo risk: low. It sits off the main demo path.
- Grounding: [Vitalik Buterin: having a safe CEX](https://vitalik.eth.limo/general/2022/11/19/proof_of_solvency.html), from the codebase (`IncomingPayment.rampTransactionId`)

### Insolvency packet that proves every hold was honoured

- What: `declareInsolvency` pins checkpoint N as the "insolvency checkpoint". `insolvencyPacket(snapshot)` exports the trust sum tree at N, plus for each hold locked at N the later payout entry that paid it, with inclusion proofs against the current checkpoint and a consistency proof from N to now. The `/present` beat 6 card shows "12 holds in trust at failure · 12 paid to artists · 0 to creditors · verified", and the packet downloads as JSON.
- Why judges care: it turns the demo climax from the UI saying so into a file an administrator or artist can check line by line.
- Demo visibility: both
- Effort: M
- Demo risk: low. It only reads the Snapshot after insolvency, and the numbers already come from `reconcile()`.
- Grounding: [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html), from the codebase (`declareInsolvency`, `claimedByCreditorsCents`)

### "What this proves / what it doesn't" panel

- What: A short panel on the artist portal and in the README, beside the receipt card. **Proves:** your hold is in the ledger, history hasn't been rewritten since your last receipt, and the total in trust equals the sum of every artist's holds. **Doesn't prove:** that the bank holds the cash (the Ramp feed and the bank attest that), or anything the gallery never recorded (the buyer receipts cover that). Each line links to the test that backs it.
- Why judges care: it is the PCAOB's critique of proof of reserves applied to our own product, and engineers trust that kind of honesty.
- Demo visibility: shown-on-screen
- Effort: S
- Demo risk: low. It is static content.
- Grounding: [Accounting Today on the PCAOB advisory](https://www.accountingtoday.com/news/pcaob-warns-about-limitations-on-crypto-proof-of-reserve-reports), [Decrypt on Mazars](https://decrypt.co/117416/bnb-plummets-binance-auditor-mazars-halts-work-crypto-firms)

### Zero merge delay: no unsigned state ever leaves the API

- What: This is CT's Maximum Merge Delay set to zero. Every API route that returns a Snapshot must return it with a checkpoint whose `size` equals the current log length, and whose root matches a recompute. A route-level test walks every demo route (sale, payment, cancel, insolvency, reset) and asserts this, so a new route can't skip signing.
- Why judges care: it makes "signed after every write" an invariant that is enforced, not a convention.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is a test plus one wrapper in `mutate()`.
- Grounding: [Certificate Transparency: how CT works](https://certificate.transparency.dev/howctworks/), from the codebase (`store.ts mutate`, `routes.test.ts`)

### Proof code fuzzed against a naive rebuild

- What: For every pair (m, n) with 1 ≤ m ≤ n ≤ 64, build the tree naively from all leaves. Then check that every inclusion proof at size n and every consistency proof from m to n verifies. Also check that flipping any single byte in any proof node or leaf makes it fail. This runs in under a second in Vitest.
- Why judges care: proof code fails at the edges (unbalanced trees, m = n, powers of two), and an exhaustive small-range test is the standard way to catch that.
- Demo visibility: repo-rigor
- Effort: S
- Demo risk: low. It is a test only, and it is the safety net for the consistency check on camera.
- Grounding: [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html), [Crosby and Wallach (slides)](https://static.usenix.org/events/sec09/tech/slides/crosby.pdf)
