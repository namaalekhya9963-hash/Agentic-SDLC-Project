# Password Reset Service

## Overview

This project provides a password-reset web flow using an email reset link and SMS verification code. It includes password policy enforcement, password-history reuse prevention, reset expiration, abuse limits, audit events, and session revocation state.

## Requirements

- Node.js 24 or later
- No third-party npm dependencies

## Run

```powershell
npm.cmd start
```

The application listens on `http://localhost:3000` by default. Set `PORT` to change the port.

For direct HTTPS, set both `TLS_KEY_PATH` and `TLS_CERT_PATH`. Otherwise, terminate HTTPS at the deployment gateway.

## API

- `POST /api/password-reset/requests`
- `POST /api/password-reset/links/verify`
- `POST /api/password-reset/verify-code`
- `POST /api/password-reset/password`

All mutating API requests require `Content-Type: application/json`.

## Test

```powershell
npm.cmd test
```

The test suite includes unit and HTTP integration coverage for happy paths, invalid inputs, missing fields, not-found routes, provider failures, malformed requests, oversized bodies, and internal exceptions.