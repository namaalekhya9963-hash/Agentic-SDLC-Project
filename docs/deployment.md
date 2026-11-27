# Deployment

## Local Deployment

Start the service with:

```powershell
npm.cmd start
```

Set `PORT` to override the default port of `3000`.

## Production Prerequisites

Before deployment, provide and verify:

- Approved account and session integrations
- Managed reset-state and password-history database
- Managed cache or Redis-compatible implementation
- Email and SMS provider credentials
- KMS or secret-manager access
- TLS, gateway, CORS, and CSRF configuration
- Monitoring, alerts, audit retention, and cleanup jobs
- Feature flags and controlled rollout configuration
- Security, architecture, operations, and release approval

The local implementation and documents do not yet contain a production deployment process or credentials.
