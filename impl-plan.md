# Password Reset Implementation Plan

## Implementation Overview

This plan implements the password-reset capability from [requirements.md](/C:/Users/AlekhyaNama/OneDrive%20-%20EPAM/Desktop/Agentic-SDLC-Project/requirements.md), [architecture.md](/C:/Users/AlekhyaNama/OneDrive%20-%20EPAM/Desktop/Agentic-SDLC-Project/architecture.md), and [design-review.md](/C:/Users/AlekhyaNama/OneDrive%20-%20EPAM/Desktop/Agentic-SDLC-Project/design-review.md). It does not modify application code or infrastructure.

Security-critical foundations must be completed before UI and provider workflows are enabled. Provider credentials, target application standards, and existing account/session integration details are external blockers.

## Implementation Task Table

| Task | Description | Dependency |
|---|---|---|
| 1 | Confirm existing application framework, coding conventions, database, cache, audit, authentication, deployment, and service boundaries | None |
| 2 | Obtain approved email and SMS provider credentials and KMS/secret-manager access | Task 1 |
| 3 | Confirm existing account, password-credential, password-history, session, refresh-token, and remember-me APIs | Task 1 |
| 4 | Define approved latency, throughput, availability, accessibility, localization, compliance, and audit-retention targets | Task 1 |
| 5 | Define provider retry, timeout, dead-letter, quota, cache-loss, failover, and partial-delivery behavior | Task 1 |
| 6 | Create the password-reset database migration and indexes | Tasks 1 and 3 |
| 7 | Extend password credential and latest-five-password-history storage | Tasks 1 and 3 |
| 8 | Implement cryptographically secure reset-link and SMS-code generation with keyed verification | Task 2 |
| 9 | Implement reset-session nonce generation and secure HttpOnly reset cookies | Tasks 6 and 8 |
| 10 | Implement authoritative atomic SMS attempt counting | Task 6 |
| 11 | Implement reset-link, SMS, expiration, replay, and optimistic-lock state transitions | Tasks 6, 8, 9, and 10 |
| 12 | Implement atomic reset-completion transaction with password history and idempotency | Tasks 7, 11, and 3 |
| 13 | Implement session-generation and revocation integration for sessions, refresh tokens, and remember-me credentials | Task 3 |
| 14 | Implement Redis-compatible cache integration for reset and rate-limit state | Tasks 1, 6, and 10 |
| 15 | Implement 3-request-per-15-minute and provider-level layered abuse limits | Task 14 |
| 16 | Implement bounded unknown-account processing and enumeration-resistant responses | Tasks 3 and 14 |
| 17 | Implement audit event recording with internal account IDs and redaction | Task 1 |
| 18 | Implement email and SMS provider adapters with delivery state and retries | Tasks 2, 5, and 8 |
| 19 | Implement API validation, generic errors, secure routing, and gateway integration | Tasks 1 and 15 |
| 20 | Implement `POST /api/password-reset/requests` | Tasks 3, 11, 15, 16, 18, and 19 |
| 21 | Implement `POST /api/password-reset/links/verify` | Tasks 9, 11, and 19 |
| 22 | Implement `POST /api/password-reset/verify-code` | Tasks 9, 10, 11, and 19 |
| 23 | Implement `POST /api/password-reset/password` | Tasks 12, 13, 17, 18, 21, and 22 |
| 24 | Add the forgotten-password entry point and web reset screens | Task 19 |
| 25 | Apply approved accessibility and localization standards to reset screens | Tasks 4 and 24 |
| 26 | Add structured logging and operational metrics with secret redaction | Tasks 17 and 23 |
| 27 | Add monitoring and alerts for failures, abuse, providers, cache, database, and sessions | Tasks 26 and 5 |
| 28 | Implement reset and audit cleanup and retention jobs | Tasks 6, 17, and 4 |
| 29 | Document deployment, migration, configuration, feature flags, provider setup, and rollback | Tasks 1, 2, 6, and 18 |
| 30 | Add unit tests for password policy, history, expiry, state, hashing, attempts, and sessions | Tasks 7 through 13 |
| 31 | Add API integration tests for verification, invalid factors, generic responses, and limits | Tasks 19 through 23 |
| 32 | Add end-to-end web tests with email/SMS fixtures and session behavior | Tasks 23 and 24 |
| 33 | Add concurrency and replay tests for one-time use and atomic attempt/completion behavior | Tasks 11, 12, 21, 22, and 23 |
| 34 | Add security tests for enumeration, timing, leakage, replay, brute force, cookies, and sessions | Tasks 16, 17, and 20 through 23 |
| 35 | Add performance and resilience tests for load, cache loss, failover, providers, and cleanup | Tasks 4, 14, 18, 23, and 28 |
| 36 | Perform accessibility and localization validation | Task 25 |
| 37 | Conduct final security and architecture review using implementation evidence | Tasks 30 through 36 |
| 38 | Obtain release approval and deploy through a controlled rollout | Tasks 29 and 37 |

## Delivery Principles

- Preserve the approved generic response behavior for unknown accounts.
- Store reset secrets only as secure hashes or keyed verifiers.
- Make security decisions authoritative in durable storage, not only in cache.
- Keep the Password Reset Service stateless.
- Complete password, history, reset-state, and session changes atomically or through a durable state machine.
- Do not log passwords, reset-link secrets, SMS codes, or reset-session nonces.
- Add tests before marking an implementation task complete.

## Task Breakdown

### Phase 1: Foundations and Integration Decisions

#### T01: Confirm existing application conventions

- Identify the existing web framework, REST conventions, authentication/session mechanism, database, cache, audit system, logging format, and deployment process.
- Confirm existing service boundaries and coding standards.
- Dependencies: none.
- Priority: P0.

#### T02: Obtain external integration configuration

- Obtain email-provider configuration and test credentials.
- Obtain SMS-provider configuration and test credentials.
- Obtain KMS or secret-manager access for keyed SMS verification and reset secrets.
- Dependencies: T01.
- Priority: P0.
- Status: blocked until credentials and provider accounts are approved.

#### T03: Confirm existing account, session, and password APIs

- Identify account lookup interfaces for email and phone.
- Identify password credential and password-history APIs.
- Identify active-session, refresh-token, remember-me, and session-generation APIs.
- Dependencies: T01.
- Priority: P0.
- Status: blocked until existing service contracts are supplied.

#### T04: Define measurable operational targets

- Add approved latency, throughput, availability, provider, accessibility, localization, and audit-retention targets.
- Map targets to test thresholds and monitoring alerts.
- Dependencies: T01.
- Priority: P1.
- Status: blocked where existing application standards are unavailable.

#### T05: Confirm provider and abuse-failure behavior

- Define retries, timeouts, dead-letter handling, provider quotas, and partial-delivery behavior.
- Confirm cache-loss and database-failover behavior.
- Dependencies: T01.
- Priority: P1.

### Phase 2: Data and Security Primitives

#### T06: Create database migration for password-reset state

- Add `password_reset_requests` with account ID, factor hashes, timestamps, attempt count, reset-session nonce hash, delivery state, consumed time, invalidation reason, status, and optimistic-lock version.
- Add indexes for account ID, status, expiration, and reset-request lookup.
- Dependencies: T01, T03.
- Priority: P0.

#### T07: Extend password credential and history storage

- Ensure active credentials and latest password hashes are identifiable by account.
- Add migration or repository operations needed to retain and query the latest 5 passwords.
- Dependencies: T01, T03.
- Priority: P0.

#### T08: Implement secure secret generation

- Add cryptographically secure generation for reset-link secrets and SMS codes.
- Add HMAC or KMS-backed keyed verification for SMS codes.
- Hash or HMAC reset-link secrets before storage.
- Dependencies: T02.
- Priority: P0.

#### T09: Implement reset-session nonce and cookie handling

- Generate a reset-session nonce for each eligible reset flow.
- Store only its hash with the reset request.
- Set short-lived HttpOnly, Secure, and SameSite reset cookies.
- Dependencies: T06, T08.
- Priority: P0.

#### T10: Implement atomic SMS attempt counters

- Add a database conditional update or distributed lock that reserves one attempt.
- Reject the sixth attempt and lock the request after five failed attempts.
- Use cache only for acceleration.
- Dependencies: T06.
- Priority: P0.

#### T11: Implement reset request and verification state machine

- Define pending, verified, completed, expired, and invalidated transitions.
- Add expiration and optimistic-lock checks.
- Prevent a factor or reset request from being consumed twice.
- Dependencies: T06, T08, T09, T10.
- Priority: P0.

#### T12: Implement reset-completion transaction

- Atomically validate both factors, password policy, password history, reset state, and request version.
- Activate the new credential and record password history.
- Consume both factors and invalidate the reset request.
- Add idempotency for retries.
- Dependencies: T07, T11, T03.
- Priority: P0.

#### T13: Implement session revocation state

- Integrate account session-generation or revocation capability.
- Define refresh-token and remember-me invalidation.
- Preserve only a verified pre-existing trusted current session.
- Dependencies: T03.
- Priority: P0.

### Phase 3: Cache, Abuse Controls, and Audit

#### T14: Implement Redis-compatible cache integration

- Store short-lived reset state, verification status, and sliding-window counters.
- Ensure cache loss does not bypass database-authoritative controls.
- Dependencies: T01, T06, T10.
- Priority: P1.

#### T15: Implement layered reset-rate limiting

- Apply 3 reset requests per 15 minutes across account, IP/network, and device keys.
- Define provider-level global quotas.
- Return generic retry-later responses.
- Dependencies: T14.
- Priority: P0.

#### T16: Implement constant-time or bounded unknown-account handling

- Apply bounded dummy work for unknown identifiers.
- Keep public response text and timing targets identical for known and unknown accounts.
- Perform provider delivery only for valid matching accounts.
- Dependencies: T03, T14.
- Priority: P0.

#### T17: Implement audit event service

- Record success/failure type, timestamp, internal account ID, and outcome.
- Explicitly exclude passwords, reset secrets, SMS codes, and raw identifiers.
- Dependencies: T01.
- Priority: P0.

#### T18: Implement provider delivery adapters

- Add email adapter for reset-link delivery and success notification.
- Add SMS adapter for verification-code delivery.
- Add retries, timeouts, delivery state, and dead-letter behavior.
- Dependencies: T02, T05, T08.
- Priority: P0.

### Phase 4: API and Web Implementation

#### T19: Implement API request validation and routing

- Add shared validation, generic errors, CSRF/CORS handling, and HTTPS routing.
- Route public endpoints through the API gateway.
- Dependencies: T01, T15.
- Priority: P0.

#### T20: Implement POST /api/password-reset/requests

- Accept email or phone identifier.
- Resolve or dummy-process the identifier.
- Enforce reset limits.
- Create reset state and initiate provider delivery.
- Return the same generic response for all outcomes.
- Dependencies: T03, T11, T15, T16, T18, T19.
- Priority: P0.

#### T21: Implement POST /api/password-reset/links/verify

- Accept the high-entropy link secret.
- Validate hash and expiration.
- Establish the short-lived reset-session cookie.
- Mark email-link verification state.
- Dependencies: T09, T11, T19.
- Priority: P0.

#### T22: Implement POST /api/password-reset/verify-code

- Validate reset-session nonce and request binding.
- Apply atomic attempt counting.
- Validate keyed SMS code.
- Mark SMS verification state.
- Dependencies: T09, T10, T11, T19.
- Priority: P0.

#### T23: Implement POST /api/password-reset/password

- Require verified link and SMS states plus reset-session nonce.
- Validate password length, uppercase letter, number, confirmation match, and latest 5 password hashes.
- Execute reset completion and session revocation.
- Send success notification.
- Dependencies: T12, T13, T17, T18, T21, T22.
- Priority: P0.

#### T24: Implement sign-in password-reset entry point

- Add the forgotten-password action to the web sign-in page.
- Add identifier, link/SMS verification, and new-password views.
- Add generic loading, success, retry-later, and failure states.
- Dependencies: T19.
- Priority: P0.

#### T25: Implement accessibility and localization

- Apply existing accessibility standards to all reset UI states.
- Add localization resources using existing application conventions.
- Dependencies: T04, T24.
- Priority: P1.

### Phase 5: Observability and Operations

#### T26: Implement structured logging and metrics

- Log lifecycle outcomes without passwords or reset factors.
- Expose reset, verification, completion, delivery, abuse, and error metrics.
- Dependencies: T17, T23.
- Priority: P1.

#### T27: Implement monitoring and alerts

- Alert on elevated failures, provider outages, abuse, cache loss, database errors, and session-revocation failures.
- Dependencies: T26, T05.
- Priority: P1.

#### T28: Implement cleanup and retention jobs

- Expire completed, invalidated, and stale reset requests.
- Apply approved audit and reset-record retention policies.
- Dependencies: T06, T17, T04.
- Priority: P1.

#### T29: Document deployment and rollback

- Document database migration, cache configuration, service configuration, provider credentials, feature flags, and rollback.
- Dependencies: T01, T02, T06, T18.
- Priority: P1.

### Phase 6: Testing and Release

#### T30: Add unit tests

- Test password policy, password-history checks, expiration, state transitions, token hashing, attempt limits, and session behavior.
- Dependencies: T07 through T13.
- Priority: P0.

#### T31: Add API integration tests

- Test all reset API operations, binding, invalid or expired factors, generic responses, and rate limits.
- Dependencies: T19 through T23.
- Priority: P0.

#### T32: Add end-to-end reset tests

- Test the complete web flow with email and SMS fixtures.
- Verify current-session preservation and other-device revocation.
- Dependencies: T23, T24.
- Priority: P0.

#### T33: Add concurrency and replay tests

- Test concurrent link, SMS, and password requests.
- Verify one-time use, optimistic-lock rejection, idempotency, and authoritative attempt limits.
- Dependencies: T11, T12, T21, T22, T23.
- Priority: P0.

#### T34: Add security tests

- Test account enumeration, timing, secret leakage, log redaction, replay, brute force, cookie flags, and session revocation.
- Dependencies: T16, T17, T20 through T23.
- Priority: P0.

#### T35: Add performance and resilience tests

- Test provider latency, cache loss, database failover, timeout/retry behavior, throughput, and reset cleanup.
- Dependencies: T04, T14, T18, T23, T28.
- Priority: P1.

#### T36: Perform accessibility and localization validation

- Validate keyboard use, screen-reader output, labels, errors, and localization.
- Dependencies: T25.
- Priority: P1.

#### T37: Conduct final security and architecture review

- Review implementation against requirements, architecture, design review, and test evidence.
- Dependencies: T30 through T36.
- Priority: P0.

#### T38: Approve deployment and release

- Obtain operations, security, product, and architecture approval.
- Deploy behind a feature flag or controlled rollout.
- Dependencies: T29, T37.
- Priority: P0.

## Task Priorities

| Priority | Meaning | Tasks |
|---|---|---|
| P0 | Required before secure release | T01-T03, T06-T13, T15-T23, T30-T34, T37-T38 |
| P1 | Required for operational readiness or standards compliance | T04-T05, T14, T25-T29, T35-T36 |

## Task Dependencies

Critical dependency chain:

T01 -> T03 -> T06/T07 -> T11 -> T12 -> T23 -> T32

Security-provider chain:

T01 -> T02 -> T08 -> T18 -> T23

Abuse-control chain:

T06 -> T10 -> T14 -> T15 -> T20

Session chain:

T03 -> T13 -> T23 -> T32

Testing chain:

T20-T23 -> T31/T32/T33/T34 -> T37 -> T38

## Blocked Tasks

| Task | Blocker | Required to unblock |
|---|---|---|
| T02 | Email/SMS credentials, KMS access, and provider accounts | Approved provider setup |
| T03 | Existing account, password, and session API contracts | Existing service documentation or integration owners |
| T04 | Existing performance, availability, accessibility, localization, compliance, and retention standards | Application standards/owners |
| T05 | Provider retry and partial-failure policy | Architecture and operations approval |
| T18 | Email/SMS providers and credentials | T02 and T05 |
| T25 | Approved localization/accessibility targets | T04 |
| T28 | Approved retention periods | T04 |
| T35 | Production-like provider and infrastructure capacity | T04, T18, T29 |
| T38 | Security, operations, and architecture sign-off | T37 |

Tasks T01, T06, T07, T10, T11, T17, and T19 should begin first because they establish foundations that do not require provider credentials.

## Testing Activities

- Unit tests for password policy and password history.
- Unit tests for reset state, factor expiration, replay rejection, and attempt counting.
- API tests for known/unknown identifiers and generic responses.
- Integration tests with email/SMS provider fixtures.
- End-to-end web tests for the complete reset flow.
- Concurrency tests for simultaneous reset, link, SMS, and password operations.
- Security tests for enumeration, timing, brute force, URL/log leakage, replay, and session revocation.
- Resilience tests for cache loss, database failover, provider outage, retries, and cleanup.
- Accessibility tests for keyboard and screen-reader use.
- Localization tests for all approved languages.
- Performance tests for expected and peak reset volume.

## Completion Criteria

Implementation is complete only when:

- All P0 tasks are complete.
- The 1-hour link and SMS expiration behavior is enforced.
- Both reset factors are required and bound to the same browser/reset request.
- Known and unknown identifiers receive generic responses without observable account-enumeration behavior.
- 3 reset requests and 5 SMS attempts are enforced per 15 minutes.
- Passwords meet the 12-character, uppercase, number, confirmation, and latest-5-password rules.
- Successful reset consumes both factors, preserves only the approved current session, and revokes other-device sessions and credentials.
- Passwords and reset secrets do not appear in logs, URLs, notifications, or audit events.
- Email success notification is sent after a successful reset.
- Audit events contain timestamps and internal account IDs only.
- Unit, integration, end-to-end, security, concurrency, and resilience tests pass.
- P1 operational and standards targets are documented or explicitly accepted.
- Architecture and security review sign-off is obtained before deployment.