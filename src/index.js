import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PasswordResetService, InMemoryEmailProvider, InMemorySmsProvider, createPasswordResetServer } from "./password_reset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const service = new PasswordResetService();
service.createAccount({
  accountId: "demo-account",
  email: "demo@example.com",
  phone: "+15555550100",
  password: "InitialPassword1",
});

const publicDir = path.join(__dirname, "public");
let tlsOptions = null;
if (process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH) {
  tlsOptions = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  };
} else {
  console.warn("TLS certificates are not configured; HTTPS should be provided by the deployment gateway.");
}
const server = createPasswordResetServer(service, publicDir, tlsOptions);
const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Password reset web app listening on http://localhost:${port}`);
});

// Application entry point
