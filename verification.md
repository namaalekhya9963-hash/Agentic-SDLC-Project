# Password Reset Verification

## Verification Status

**Status: Local verification passed**

The repository's Node.js test suite passed locally on 2026-11-27.
GitHub Actions CI is configured in `.github/workflows/ci.yml`; remote CI
execution must be confirmed after the workflow is pushed.

## Test Command

```powershell
npm.cmd test
```

## Test Result

- Tests: 15
- Passed: 15
- Failed: 0
- Cancelled: 0
- Skipped: 0

## Verified Behavior

- Password-reset link and SMS verification flows complete successfully.
- Password mismatch, missing numbers, and invalid password policy are rejected.
- Reset links cannot be reused.
- SMS verification is limited to five authoritative attempts.
- Reset requests are limited to three within 15 minutes.
- Unknown identifiers receive the same generic response as known identifiers.
- Successful reset sends the notification and revokes other sessions.
- Invalid, expired, replayed, wrong-session, malformed, oversized, and provider-failure cases are rejected or handled safely.
- Required setup, API, test, and project documentation is present.

## Not Verified

- GitHub Actions remote execution after this workflow is pushed.
- Production email and SMS provider integrations.
- Production account, database, cache, session, KMS, and audit integrations.
- Deployment, rollback, monitoring, accessibility, localization, performance, failover, and cross-region behavior.
- Human architecture and security approval.
