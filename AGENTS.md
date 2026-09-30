# psnine_next

- Codex is the coordinator and reviewer. Gemini subagents implement production code.
- Gemini must use `gemini-3.8-flash-high` with reasoning effort `high`.
- This is a new private repository; preserve the audited upstream MIT attribution.
- Read `docs/implementation-plan.md` and the feature catalog before implementation.
- Multiple contributors share this checkout. Modify only assigned files and never revert another contributor's edits.
- Deliver a self-contained browser userscript. Do not execute authenticated PSNINE actions during development.
- DOM enhancements must be idempotent, tolerate missing elements, avoid unsafe HTML interpolation, and preserve site functionality.
- No secrets, cookies, personal browser state, or raw authenticated pages belong in Git.
- Record historical features that were removed or depend on unavailable services explicitly; do not silently claim parity.
- Keep source-history evidence and test results reproducible.
