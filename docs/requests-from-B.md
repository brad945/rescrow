# Requests from lane B to lane A

Lane B appends here (new fields, routes, packages, view functions); lane A checks items off. Newest at the bottom.

- [ ] **Heads up, Bradley: Neil asked me to land the live agent, so lane B edited lane A files once.** Please review; revert anything you disagree with. What changed in your lane:
  - `src/lib/agent/`: `verify.ts` (quote snapping incl. curly quotes, number checks from digits, words, fractions, "divided equally", or the gallery's side of the split), `numbers.ts`, `ollama.ts` (streaming chat, `pickModel` per your §4: `OLLAMA_MODEL`, then gpt-oss, qwen, llama), `index.ts` (`readAgreement(agreement, mode)`: `"saved"` default, `"live"` streams, falls back to the saved answer with the reason). Sets your `confidence`, `unverifiedCitations` and `model` fields, plus an additive `checks` field.
  - `src/types.ts`: added `AgreementTerms.checks?` and `VerificationCheck`. Nothing renamed or removed.
  - `src/lib/escrow/engine.ts`: `termsFor` refuses a sale when any check failed (needs a person); `applyTerms` takes an optional `flag` and logs `agent_flag`.
  - `src/app/api/agent/read`: accepts `mode`, and `?stream=1` streams NDJSON (`thinking`, `token`, `done`). New routes `api/agent/extract` (lab, nothing saved) and `api/agent/warm` (loads the model).
  - Timeout is 60s, not 25s: a busy laptop took 42s once.
  - Tests: `src/lib/agent/*.test.ts`, plus `RESCROW_AGENT=fixture` in `routes.test.ts`. All 479 pass with your trust tests.
