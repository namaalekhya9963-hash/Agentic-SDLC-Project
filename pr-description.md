# PR: Configure validation hook and link Jira KAN-2

## Summary

This change adds a post-tool-use validation hook that runs the existing Node.js test suite and links the workspace documentation to Jira issue KAN-2. It also records the change in the changelog and makes the reusable PR prompt require consistent evidence, limitations, and reviewer checks.

## Changes Made

- `.github/hooks/validation.json` — adds a `postToolUse` command hook configured to run `node --test` with a 15-second timeout.
- `CHANGELOG.md` — records the validation hook and Jira links under Unreleased.
- `README.md` — links the project overview to Jira KAN-2.
- `requirements.md` — adds Jira issue tracking metadata and link.
- `.github/prompts/create-pr.prompt.md` — requires the five PR sections, accurate file inventory, and explicit reporting of missing documents.
- `pr-description.md` — records this PR's description, local test evidence, limitations, and reviewer checklist.

## Test Evidence

Command: `npm.cmd test`

```text
> test
> node --test

✔ integration happy path completes password reset through HTTP
✔ integration rejects invalid password and missing verification fields
✔ integration returns Not Found for unknown routes and missing pages
✔ integration rejects wrong content type, origin, malformed JSON, and oversized body
✔ integration handles provider delivery failures and internal exceptions
✔ documentation quality includes setup, API, test, and project documents
✔ password reset completes with email link and SMS code
✔ password reset rejects replay and invalid password policy
✔ SMS verification is limited to five authoritative attempts
✔ unknown identifiers return the same generic response
✔ reset requests are limited to three within 15 minutes
✔ email reset link is one-time and wrong session nonce is rejected
✔ successful reset sends notification and revokes other sessions
✔ password mismatch and missing number are rejected
✔ expired link and SMS verification state are rejected
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## Known Limitations

- This PR configures validation and Jira tracking; it does not implement source-to-destination automated documentation synchronization.
- The requested Jira key `PROJ-KAN-2` was not found. The matching issue on the configured Jira site is [KAN-2](https://namaalekhya9963.atlassian.net/browse/KAN-2).
- The Jira story's `docs/` lifecycle deliverables, Jira OAuth authorization verification, and merge criteria are not completed or verified by this PR. Existing lifecycle documents are at the repository root and describe the password-reset service.
- `code-review.md` and `verification.md` were not found in the repository. Local tests were run for this PR, but no GitHub CI results are available yet.
- The hook JSON and its command are valid and were exercised as `npm test` locally; execution by the target Copilot Agent Mode host has not been verified.

## Reviewer Checklist

- [ ] Confirm the `postToolUse` hook event and command configuration are supported by the target Copilot Agent Mode version.
- [ ] Confirm running `node --test` after each tool use is appropriate for this workspace and within the configured timeout.
- [ ] Verify the README and requirements links resolve to Jira KAN-2.
- [ ] Confirm the file inventory, test evidence, and limitations are accurate.
- [ ] Confirm GitHub CI checks pass before approval.
- [ ] Confirm no credentials or other secrets are included.
