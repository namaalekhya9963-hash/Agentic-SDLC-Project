---
name: create-pr
description: Prepare Pull Request title, summary, and checklist documentation.
---

Review `requirements.md`, `code-review.md`, `verification.md`, and all changes in the current branch. If a referenced review or verification document is missing, state that explicitly instead of assuming it exists.

Prepare `pr-description.md` with a clear PR title and all of these sections:

- **Summary** — 2-3 sentences describing what was built and why.
- **Changes Made** — bullets for every added or modified file and its reason.
- **Test Evidence** — actual test command and output, or a link to CI results.
- **Known Limitations** — missing, not found, unverified, or out-of-scope items.
- **Reviewer Checklist** — actionable tick-boxes for reviewers.

Do not claim unrun tests or completed work. Wait for human approval before finalizing.
