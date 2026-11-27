# Setup

## Requirements

- Node.js 24 or later
- No third-party npm dependencies

## Start the Service

```powershell
npm.cmd start
```

The service listens on `http://localhost:3000` by default. Set `PORT` to use a different port.

For direct HTTPS, set `TLS_KEY_PATH` and `TLS_CERT_PATH`. Without these variables, HTTPS should be terminated by the deployment gateway.
