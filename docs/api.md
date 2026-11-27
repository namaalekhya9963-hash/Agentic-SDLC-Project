# Password Reset API

All mutating requests require `Content-Type: application/json`.

## Request a Reset

`POST /api/password-reset/requests`

```json
{
  "identifier": "user@example.com"
}
```

Known and unknown identifiers receive the same generic response.

## Verify an Email Link

`POST /api/password-reset/links/verify`

```json
{
  "linkSecret": "opaque-email-link-secret"
}
```

## Verify the SMS Code

`POST /api/password-reset/verify-code`

```json
{
  "resetRequestId": "opaque-request-id",
  "smsCode": "123456"
}
```

## Complete the Reset

`POST /api/password-reset/password`

```json
{
  "resetRequestId": "opaque-request-id",
  "newPassword": "sensitive-value",
  "confirmationPassword": "sensitive-value"
}
```

The reset requires both the verified email factor and SMS factor. Passwords must meet the approved length, uppercase, number, confirmation, and password-history rules.
