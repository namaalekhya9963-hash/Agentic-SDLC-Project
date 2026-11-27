# PR: Complete Agentic SDLC capstone workflow artifacts

## Summary

This pull request adds the documented Agentic SDLC capstone workflow for a password-reset service and links the project lifecycle to Jira issue [KAN-2](https://namaalekhya9963.atlassian.net/browse/KAN-2). The repository now includes project requirements, architecture, implementation planning, design review, a password-reset implementation, integration tests, and validation configuration.

## Changes Made

- `README.md` — documents the password-reset service, Jira work item, setup, API, and test commands.
- `requirements.md` — defines the Jira tracking metadata, project overview, user story, requirements, business rules, dependencies, and acceptance criteria.
- `architecture.md` — defines the high-level service architecture, component responsibilities, API design, database model, security controls, and scalability considerations.
- `design-review.md` — records architecture strengths, risks, identified issues, approved improvements, and final review status.
- `impl-plan.md` — provides prioritized implementation tasks, dependencies, blocked tasks, testing activities, and completion criteria.
- `code-review.md` — records the implementation review scope, strengths, findings, and production gaps.
- `verification.md` — records the local test command, passing result, verified behavior, and remaining verification gaps.
- `docs/` — provides setup, API, testing, deployment, and documentation-index guides.
- `src/` — contains the password-reset service entry point and password-reset implementation.
- `tests/` — contains password-reset unit and integration coverage.
- `.github/hooks/validation.json` — configures a post-tool-use hook to run `node --test` with a 15-second timeout.
- `.github/prompts/create-pr.prompt.md` — requires consistent PR sections, file inventory, test evidence, limitations, and reviewer checks.
- `CHANGELOG.md` — records the Jira and validation-hook additions under Unreleased.
- `pr-description.md` — provides the committed pull-request summary and review record.

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

- The repository documents and local implementation require provider, account, session, database, and secret-manager integration decisions before production deployment.
- Existing application standards for performance, availability, accessibility, localization, compliance, and retention are not supplied and remain design assumptions.
- The requested Jira key `PROJ-KAN-2` was not found. The matching Jira work item is [KAN-2](https://namaalekhya9963.atlassian.net/browse/KAN-2).
- GitHub CI results are not yet available for this branch.
- Execution of `.github/hooks/validation.json` by the target Copilot Agent Mode host has not been verified.
- Production provider, account, database, cache, session, KMS, audit, monitoring, and deployment integrations remain to be supplied and verified.

## Reviewer Checklist

- [ ] Review the requirements, architecture, design review, and implementation plan against Jira KAN-2.
- [ ] Verify the password-reset API behavior and security controls described in the project documents.
- [ ] Confirm the `postToolUse` hook event and command configuration are supported by the target Copilot Agent Mode version.
- [ ] Confirm the README and requirements links resolve to Jira KAN-2.
- [ ] Confirm external provider credentials and application integration contracts are available before implementation tasks are completed.
- [ ] Confirm the file inventory, test evidence, and limitations are accurate.
- [ ] Confirm GitHub CI checks pass before approval.
- [ ] Confirm no credentials or other secrets are included.
