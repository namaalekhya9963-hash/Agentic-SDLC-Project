 # Password Reset Requirements

## Project Overview

This project enables users who have forgotten their passwords to securely regain access to their accounts through an identity-verification and password-reset flow.

The reset flow supports account lookup by email address or phone number and uses both an email reset link and an SMS verification code as required verification factors.

## User Story

As a user, I want to reset my password so that I can access my account if I forget my password.

## Business Objective

Allow legitimate account owners to restore access to their accounts while protecting accounts from unauthorized password changes.

## Functional Requirements

### Password Reset Request

1. The system shall provide a "Forgot password" or equivalent action on the web sign-in page.
2. The system shall allow the user to enter an email address or phone number.
3. When valid account details are submitted, the system shall initiate the password-reset process.
4. The system shall send a password-reset link to the account's registered email address.
5. The system shall send a verification code to the account's registered phone number.
6. The system shall return the same generic confirmation response whether or not the submitted identifier belongs to an account.
7. The system shall not reveal whether an account is unknown, unverified, suspended, locked, or otherwise unavailable.

### Reset Verification

8. The reset link and SMS verification code shall remain valid for 1 hour.
9. The user shall complete the reset flow using both the email reset link and the SMS verification code.
10. The system shall reject an invalid, expired, reused, or already-used reset link or verification code.
11. The system shall permit no more than 5 verification-code attempts within 15 minutes.
12. The system shall permit no more than 3 password-reset requests within 15 minutes.
13. When the rate limit is reached, the system shall reject additional requests or attempts and display a generic retry-later message.
14. The system shall bind the reset link and SMS code to the same password-reset request.

### Password Update

15. The system shall allow the user to enter and confirm a new password.
16. The new password shall contain at least 12 characters.
17. The new password shall contain at least 1 uppercase letter and 1 number.
18. The new password and confirmation password shall match.
19. The new password shall not match any of the user's last 5 passwords.
20. The system shall invalidate the reset link and verification code after successful password reset.
21. The system shall update the account password only after successful identity verification and password validation.
22. On success, the system shall display a confirmation that the password was changed.
23. The system shall send an email notification to the registered email address after a successful password reset.

### Session Management

24. The system shall keep the user's current session active after the password reset.
25. The system shall log out active sessions on other devices after a successful password reset.

## Non-Functional Requirements

1. The password-reset flow shall follow the application's existing security standards.
2. The password-reset flow shall follow the application's existing availability standards.
3. The password-reset flow shall follow the application's existing performance standards.
4. The password-reset flow shall follow the application's existing accessibility standards.
5. The password-reset flow shall follow the application's existing localization standards.
6. The password-reset flow shall follow the application's existing compliance and audit standards.
7. Password values shall not be exposed in logs, notifications, browser URLs, or error messages.
8. Reset links and SMS verification codes shall be transmitted and stored securely.
9. Audit events shall record success/failure timestamps and account identifiers only, without passwords or reset secrets.
10. The system shall use generic user-facing messages for reset failures where revealing account or security details could help an attacker.
11. The system shall remain usable in the web application through the sign-in page link.

## Business Rules

- An account identifier is considered valid only if it matches an account record.
- A reset link and SMS code are valid for 1 hour from issuance.
- The reset process requires both factors: the email reset link and the SMS verification code.
- A reset request expires after the password is changed or after the 1-hour validity period.
- Passwords must be at least 12 characters, include at least 1 uppercase letter and 1 number, and differ from the last 5 passwords.
- Unknown and known accounts receive the same generic reset-request response.
- A successful reset ends sessions on other devices but preserves the current session.
- Reset requests and code attempts are limited to 3 requests and 5 attempts, respectively, within a 15-minute period.

## Assumptions

- The user has access to the registered email address and phone number.
- The web application already has authentication, account, session, email, and SMS capabilities.
- Existing application standards define exact infrastructure, performance, compliance, accessibility, and localization targets.
- "Reset link and SMS code together" means both factors are required for the same password-reset request.
- The current session means the browser session in which the password reset is completed.

## Dependencies

- Account data must expose the registered email address and phone number securely.
- Email delivery service.
- SMS delivery service.
- Password policy and password-history validation services.
- Session-management service.
- Audit logging service.
- Application security and abuse-protection configuration.

## Acceptance Criteria

1. A user can select "Forgot password" from the web sign-in page.
2. A user can submit a registered email address or phone number.
3. The system sends an email reset link and an SMS verification code for a valid account.
4. The response does not disclose whether the submitted identifier belongs to an account.
5. The reset link and SMS code expire after 1 hour.
6. The reset cannot proceed unless both the correct email link and SMS code are associated with the same reset request.
7. Invalid or expired verification data is rejected.
8. A 6th verification attempt or 4th reset request within 15 minutes is blocked.
9. A password shorter than 12 characters is rejected.
10. A password without an uppercase letter or number is rejected.
11. A password matching one of the user's last 5 passwords is rejected.
12. A successful reset:
   - updates the account password;
   - confirms success to the user;
   - sends an email notification;
   - invalidates the reset link and SMS code; and
   - logs out other-device sessions while preserving the current session.
13. Password values and reset secrets do not appear in application logs or user-facing messages.
