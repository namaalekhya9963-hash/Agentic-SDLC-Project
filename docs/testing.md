# Testing

## Run the Suite

```powershell
npm.cmd test
```

The suite uses Node.js's built-in test runner. It covers unit behavior and HTTP integration behavior.

## Test Coverage

- Password length, uppercase, number, confirmation, and history rules
- Reset-link expiry and one-time use
- SMS attempt limits
- Reset-request limits
- Generic known/unknown account responses
- Session revocation and notification behavior
- Missing fields, malformed JSON, wrong content type, origin, and oversized request bodies
- Unknown routes and missing pages
- Provider delivery failures and internal exceptions
- Documentation completeness
