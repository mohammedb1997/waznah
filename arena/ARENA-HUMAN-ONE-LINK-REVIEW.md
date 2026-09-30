# Arena Review: Single-Link Human Handoff

**Published:** 2026-09-30  
**Transport:** public, intentionally curated review text; **not** a mirror of the private Arena repository.

> This is a human-use review handoff, not permission for automated browser requests. Arena's current Terms prohibit programmatic/automated site queries. Do not create automatic votes or automate CAPTCHAs. A human decides whether and what to submit via the ordinary Arena interface.

## A. Immediately available pilot: completed Gate D

- Task: `TEAM-ORCH-ARENA-WEB-SMOKE-V1` (historical accepted smoke, reusable only for a human access test)
- **Exact reviewed implementation SHA:** `467bf8742b7556393629de157f5be061cddae970`
- Curated one-file source bundle: https://raw.githubusercontent.com/mohammedb1997/waznah/arena-review-bundles/arena/TEAM-ORCH-ARENA-WEB-SMOKE-V1.md
- Browser-facing source page: https://github.com/mohammedb1997/waznah/blob/arena-review-bundles/arena/TEAM-ORCH-ARENA-WEB-SMOKE-V1.md
- Historical two-model review has already been accepted by ChatGPT. **Do not repeat just to generate extra traffic or treat this pilot as new code-review evidence.** If the human operator happens to verify URL access, do not claim either model accessed the file unless it accurately cites details present in the bundle.

### Human pilot prompt (copy/paste once, only if you choose to test)

Review the exact source bundle at the public raw GitHub URL above, SHA `467bf8742b7556393629de157f5be061cddae970`. **First:** truthfully state whether you could actually read the URL and identify two specific source files and two grounded source observations. If you cannot fetch it, say **SOURCE_UNAVAILABLE** immediately; do not invent a review or ask for repeated retries. If read access works, review Gate D HELLO authentication, persisted role authority, role-safe Host/Player/Display projections, duplicate-socket disconnect, and exclusion of Gate E mutation. Distinguish implemented Gate D from Gate E/F non-goals. Return an explicit `Result: APPROVED` or `Result: CHANGES REQUESTED`, P0/P1/P2/P3 with file/function evidence, exact SHA, and `Handoff to ChatGPT`. This is a supplemental review only; you cannot merge or certify tests you did not run.

**Access fallback:** Our earlier GLM Side-by-Side runtime reported that it could not fetch external links. If either model replies SOURCE_UNAVAILABLE, **do not keep resending the same URL**. Use an ordinary, human-permitted Arena mode with a supported source-file upload or direct GitHub connection. Official Arena Agent Mode supports GitHub connection and Markdown uploads, but Agent Mode is not identical to Side-by-Side. Arena's published Battle file list supports PDF, not Markdown; if you manually upload for Side-by-Side/Battle, first confirm the exact mode supports that attachment and that both visible models received it.

## B. Next Gate E review: PENDING

- Intended task: `ARENA-GAME-001` Classic first gameplay vertical slice.
- **Accepted final tested implementation SHA: PENDING.** The assigned ZCode task must finish, publish its worker branch/report, pass `npm run typecheck` and `npm run test:gameplay`, and pass independent ChatGPT source/diff/acceptance verification before sharing code with Arena.
- **Curated Gate E source bundle: NOT PUBLISHED.** Do not review or infer correctness from the Gate D sample or the GitHub link alone. A separate reviewed, secret-screened Gate E source bundle will be published only after readiness and approval.
- Planned Side-by-Side names (human selects and verifies visible labels): `GLM 5.2 (Max)` and `Claude Sonnet 5 (High)` if still offered by Arena.

### Intended Gate E review contract, once source is approved

Independently assess authenticated Host/Player/Display command authorization **before** `decide()`, PostgreSQL-derived caller role and player actor identity, HTTP `Idempotency-Key`, durable `commandId` exactly-once behavior, transactional question usage / answer submission / judgment / score / event / snapshot coherence, Gate D role-safe broadcasting, canonical-answer secrecy, and strict exclusion of Gate F/Redis/frontend/real corpus work. Classify P0/P1/P2/P3 with exact file/function observations; distinguish code-derived evidence from tests not executed by the reviewing model. Provide `Result: APPROVED` or `Result: CHANGES REQUESTED` and `Handoff to ChatGPT`. No Arena UI winner or preference vote constitutes engineering acceptance. NotebookLM remains the mandatory independent final Gate E review when required.

## Submission and evidence protocol

1. The human operator first checks that every externalized source is intentionally approved; publishing private code to a public GitHub repo is irreversible in practical terms. Keep secrets and personal data out.
2. Send **one** complete approved review bundle (or supported human-uploaded file) and **one** concise review prompt, rather than many browser messages. This may reduce message count, but **does not guarantee fewer CAPTCHA prompts or override rate limits/terms**.
3. Record the exact reviewed SHA, model labels, full unabridged outputs A/B, source-access truthfulness and any challenge interruption. Optionally supply these to the ChatGPT coordinator for independent source comparison. Do **not** fabricate automated REPORT_READY or set a blocked queue task DONE from a human vote.
