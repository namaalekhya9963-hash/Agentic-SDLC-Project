# Password Reset Architecture Design Review

## Review Summary

The architecture provides a reasonable high-level structure and covers the core web reset flow, account and session services, email/SMS delivery, reset state, rate limiting, audit events, and password-history concepts.

The design is not ready for approval or implementation. It does not define several security-critical controls needed to enforce the approved requirements safely. In particular, the reset-link design, session binding, atomic verification/completion, SMS attempt enforcement, abuse limits, and session revocation require further specification.

## Architecture Strengths

- Clearly separates the web UI, API gateway, password-reset orchestration, account operations, session operations, and external providers.
- Uses generic reset responses and avoids disclosing account existence.
- Defines a 1-hour reset window and 15-minute abuse windows.
- Requires both an email link and an SMS code.
- Stores reset and SMS values as hashes rather than plaintext in the proposed model.
- Preserves the current session and revokes other-device sessions in the intended behavior.
- Includes password-length, uppercase, number, confirmation, and five-password-history checks.
- Defines audit events that exclude passwords and reset secrets.
- Uses stateless service instances and cache/database separation for horizontal scaling.

## Identified Issues

1. **Reset-link secret and request identifier are not separated**
   - The `resetRequestId` is used as the link path and also reused as the API flow identifier.
   - This can expose a reset capability in browser history, access logs, and analytics.
   - Recommendation: issue a separate cryptographically random link secret; send and store only a hash; exchange it through a POST for a short-lived server-side verification state.

2. **Reset flow is not bound to a browser or session**
   - The API design does not define how the current browser, reset flow, email link, and SMS code are cryptographically bound together.
   - Recommendation: add a reset-session nonce or browser-bound HttpOnly state and require it through verification and password completion.

3. **Session preservation behavior is ambiguous**
   - The design does not identify the exact authenticated session to preserve.
   - Recommendation: explicitly define trusted pre-existing sessions and preserve only a verified legitimate session. Otherwise revoke all sessions and establish a fresh authenticated session.

4. **Session revocation is incomplete**
   - “Other active sessions” may include browser sessions, refresh tokens, remember-me credentials, device registrations, and provider sessions.
   - Recommendation: use an account session-generation value or revocation registry; invalidate bearer and refresh tokens issued before the reset.

5. **SMS and reset attempt limits are not atomic**
   - Cache counters can be evicted, reset, or raced by concurrent verification requests.
   - Recommendation: use an atomic database conditional update or distributed lock as the authoritative control and use cache only as an accelerator.

6. **SMS code protection is insufficiently specified**
   - A generic hash does not protect low-entropy SMS codes from offline guessing if a database or backup is exposed.
   - Recommendation: use a HMAC or dedicated KMS-backed keyed verifier and retain server-side attempt enforcement.

7. **Completion is not defined as an atomic transaction**
   - Password activation, history updates, reset invalidation, and session revocation are separate operations.
   - Recommendation: complete reset in a transaction or durable state machine with optimistic locking and idempotency.

8. **Reset metadata is missing one-time-use fields**
   - The data model lacks reset-link nonce/version, delivery state, consumption timestamps, invalidation reason, and request version.
   - Recommendation: add these fields and prevent stale or concurrent completion.

9. **Rate-limit keys are undefined**
   - The architecture does not specify whether limits apply by account, IP, device, identifier, provider, or combinations.
   - Recommendation: use layered account, IP/network, and device limits with global provider limits.

10. **Enumeration protection does not address timing or processing differences**
    - Known identifiers perform database writes and notification work; unknown identifiers do not.
    - Recommendation: use constant-time or bounded dummy processing and asynchronous delivery, while keeping public responses identical.

11. **No explicit link-to-SMS binding field is defined**
    - The request ID is described as the binding mechanism, but the model does not include separate link verification state tied to the browser/session.
    - Recommendation: persist issued-at, link-verified-at, SMS-verified-at, verification-method version, and reset-session nonce on the request.

12. **No delivery or provider failure behavior is specified**
    - The architecture lacks retries, status handling, and partial delivery safeguards.
    - Recommendation: define provider retry, timeout, dead-letter, notification, and partial-failure behavior in an approved design.

13. **Availability and recovery behavior is unspecified**
    - Cache loss, database outage, provider outage, and multi-instance behavior are not addressed.
    - Recommendation: define failover, cache-loss policy, retry behavior, and reset-state persistence before implementation.

14. **Performance targets are missing**
    - The architecture has no latency, throughput, or queue/SMS/email capacity targets.
    - Recommendation: establish measurable service-level objectives based on existing application standards.

15. **Audit account identifier format is undefined**
    - It is unclear whether the audit system uses an email, phone number, or internal account ID.
    - Recommendation: use an internal account ID and store contact details only in protected account records.

## Security Risks

### HIGH

- **Reset-link exposure:** using a request identifier or reset secret in a GET URL can leak credentials through browser, proxy, and log systems.
- **Cross-request reset takeover:** no browser/session binding may allow a stolen request identifier or code to be combined with a different session.
- **Session revocation gap:** the design may leave refresh tokens or remembered sessions active.
- **SMS attempt race:** cache-based counters may be bypassed by concurrent requests or cache loss.
- **Account abuse:** layered abuse controls are missing, allowing repeated email/SMS harassment and provider-cost abuse.
- **Enumeration by timing:** differences in known/unknown account processing may reveal account existence.

### MEDIUM

- **Low-entropy code offline guessing:** a generic hash is weaker than keyed or HMAC-based SMS-code verification.
- **No atomic completion:** concurrent requests could produce inconsistent credential and reset state.
- **Reset metadata spoofing or replay:** missing nonce, version, delivery, and consumption fields weaken one-time-use guarantees.
- **Provider and data-store outages:** failover and cache-loss behavior may permit inconsistent security enforcement.

## Performance Risks

- Password-history validation across credential records may require indexed lookup by account and credential type.
- Synchronous email and SMS calls in the reset-request path may increase response latency and cause request-thread exhaustion.
- Cache and database writes on every reset and verification attempt may become hot spots for a single account.
- Known versus unknown account processing can introduce observable timing differences.
- Provider retries and timeouts are not bounded in the architecture.

## Scalability Risks

- Cache is the only design location for some reset state and abuse counters; cache loss or eviction could weaken limits.
- No sharding or partitioning strategy is specified for large reset and audit histories.
- Reset and audit cleanup/retention jobs are not defined.
- SMS/email providers impose external quotas that are not modeled.
- Horizontal scaling of the audit pipeline or provider workers is not defined.
- Geographic deployment and cross-region cache consistency are not specified.

## Recommended Improvements

1. Define a separate, high-entropy, one-time reset-link secret and server-side reset-session nonce.
2. Use a POST exchange for link verification instead of GET-based state mutation.
3. Add explicit browser/session binding to all reset stages.
4. Specify account, IP/network, device, and provider rate-limit keys and global provider quotas.
5. Make SMS attempt enforcement authoritative, atomic, and persisted.
6. Use keyed/HMAC verification for low-entropy SMS codes.
7. Define an atomic reset-completion state machine and optimistic locking.
8. Specify complete session and token revocation using session-generation or revocation state.
9. Implement bounded or asynchronous provider delivery with retries, timeouts, and failure handling.
10. Add constant-time or bounded dummy processing for unknown identifiers.
11. Add issued-at, verified-at, consumed-at, invalidation reason, delivery state, nonce, and version fields.
12. Define cache-loss, provider-outage, database-failover, and recovery behavior.
13. Define measurable performance targets and capacity assumptions.
14. Use internal account IDs in audit events.
15. Add cleanup and retention rules for reset requests and audit records.

## Agreed Design Decisions
Human approval has been granted to implement the reviewed security and design improvements in architecture.md.

Approved improvements include:

- Separate reset-link secrets and browser/session binding.
- POST-based link verification.
- Atomic SMS attempt and reset completion controls.
- Keyed SMS-code protection.
- Layered reset and provider abuse limits.
- Complete session/token revocation rules.
- Provider failure, cache-loss, failover, audit, and performance specifications.

## Final Review Status

**Status: REVIEWED AND UPDATED - PENDING FINAL IMPLEMENTATION VALIDATION**

The architecture now documents the critical security and design controls identified during review. Implementation must still validate these controls with focused security, concurrency, session, delivery, and abuse tests.