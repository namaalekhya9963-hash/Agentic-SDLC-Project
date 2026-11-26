import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_HMAC_KEY = crypto.randomBytes(32).toString("hex");
const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

function hmac(value, key) {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

function timingSafeEqualHex(left, right) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function normalizeIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (/^[+\d][+\d().\s-]*$/.test(value)) {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length >= 7) {
      return value.trim().startsWith("+") ? `+${digits}` : digits;
    }
  }
  return value.toLowerCase();
}

function isEmail(identifier) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

function isPhone(identifier) {
  return /^\+?[0-9]{7,15}$/.test(identifier);
}

function validatePassword(password, confirmation, currentHashes) {
  if (typeof password !== "string" || typeof confirmation !== "string") {
    return "Password and confirmation are required.";
  }
  if (password !== confirmation) {
    return "Password and confirmation do not match.";
  }
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  for (const [iterations, salt, stored] of currentHashes) {
    const candidate = pbkdf2(password, salt, iterations);
    if (timingSafeEqualHex(candidate, stored)) {
      return "Password cannot match one of the last 5 passwords.";
    }
  }
  return null;
}

function pbkdf2(password, salt, iterations = 310000) {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
}

function passwordRecord(password) {
  const iterations = 310000;
  const salt = randomToken(16);
  return [iterations, salt, pbkdf2(password, salt, iterations)];
}

export class InMemoryEmailProvider {
  constructor() {
    this.outbox = [];
  }

  async sendReset(accountId, email, linkSecret) {
    this.outbox.push({ accountId, email, type: "reset", linkSecret });
  }

  async sendSuccess(accountId, email) {
    this.outbox.push({ accountId, email, type: "success" });
  }
}

export class InMemorySmsProvider {
  constructor() {
    this.outbox = [];
  }

  async sendCode(accountId, phone, code) {
    this.outbox.push({ accountId, phone, code });
  }
}

export class PasswordResetService {
  constructor(options = {}) {
    this.db = options.db || new DatabaseSync(options.databasePath || ":memory:");
    this.email = options.email || new InMemoryEmailProvider();
    this.sms = options.sms || new InMemorySmsProvider();
    this.hmacKey = options.hmacKey || process.env.RESET_HMAC_KEY || DEFAULT_HMAC_KEY;
    this.now = options.now || (() => Date.now());
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS accounts (
        account_id TEXT PRIMARY KEY,
        email_address TEXT UNIQUE,
        phone_number TEXT UNIQUE,
        password_iterations INTEGER NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        session_generation INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS password_history (
        account_id TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        changed_at INTEGER NOT NULL,
        FOREIGN KEY(account_id) REFERENCES accounts(account_id)
      );
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        reset_request_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        link_secret_hash TEXT NOT NULL,
        sms_code_hash TEXT NOT NULL,
        reset_session_nonce_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        link_verified_at INTEGER,
        link_consumed_at INTEGER,
        sms_verified_at INTEGER,
        sms_attempt_count INTEGER NOT NULL DEFAULT 0,
        delivery_state TEXT NOT NULL DEFAULT 'pending',
        issued_at INTEGER NOT NULL,
        consumed_at INTEGER,
        invalidation_reason TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        FOREIGN KEY(account_id) REFERENCES accounts(account_id)
      );
      CREATE TABLE IF NOT EXISTS abuse_counters (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        account_id TEXT,
        occurred_at INTEGER NOT NULL,
        outcome TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS active_sessions (
        session_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        session_generation INTEGER NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(account_id) REFERENCES accounts(account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_reset_account ON password_reset_requests(account_id);
      CREATE INDEX IF NOT EXISTS idx_reset_status_expiry ON password_reset_requests(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_history_account ON password_history(account_id, changed_at);
    `);
  }

  close() {
    this.db.close();
  }

  createAccount({ accountId, email, phone, password }) {
    const [iterations, salt, hash] = passwordRecord(password);
    const normalizedPhone = phone ? normalizeIdentifier(phone) : null;
    this.db.prepare(`
      INSERT INTO accounts (
        account_id, email_address, phone_number, password_iterations,
        password_salt, password_hash, session_generation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(accountId, email?.toLowerCase() || null, normalizedPhone, iterations, salt, hash, this.now());
  }

  getAccountByIdentifier(identifier) {
    const normalized = normalizeIdentifier(identifier);
    if (isEmail(normalized)) {
      return this.db.prepare("SELECT * FROM accounts WHERE email_address = ?").get(normalized);
    }
    if (isPhone(normalized)) {
      return this.db.prepare("SELECT * FROM accounts WHERE phone_number = ?").get(normalized);
    }
    return undefined;
  }

  audit(eventType, accountId, outcome) {
    this.db.prepare(`
      INSERT INTO audit_events (event_id, event_type, account_id, occurred_at, outcome)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomToken(16), eventType, accountId || null, this.now(), outcome);
  }

  consumeAbuseLimit(key, limit) {
    const now = this.now();
    const row = this.db.prepare("SELECT * FROM abuse_counters WHERE key = ?").get(key);
    if (!row || now - row.window_start >= WINDOW_MS) {
      this.db.prepare(`
        INSERT INTO abuse_counters (key, count, window_start) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start
      `).run(key, now);
      return true;
    }
    if (row.count >= limit) {
      return false;
    }
    this.db.prepare("UPDATE abuse_counters SET count = count + 1 WHERE key = ?").run(key);
    return true;
  }

  async requestReset(identifier, sourceKey = "unknown") {
    const normalized = normalizeIdentifier(identifier);
    if (!this.consumeAbuseLimit(`reset:source:${sourceKey}`, 3)) {
      this.audit("reset_requested", null, "rate_limited");
      return { limited: true, message: "If an eligible account exists, reset instructions have been sent." };
    }

    const account = this.getAccountByIdentifier(normalized);
    let eligible = account;

    if (!account) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    } else {
      const accountKey = `reset:account:${account.account_id}`;
      if (!this.consumeAbuseLimit(accountKey, 3)) {
        this.audit("reset_requested", account.account_id, "rate_limited");
        return { limited: true, message: "If an eligible account exists, reset instructions have been sent." };
      }
    }

    if (eligible) {
      const now = this.now();
      const resetRequestId = randomToken(24);
      const linkSecret = randomToken(32);
      const smsCode = String(crypto.randomInt(100000, 1000000));
      const resetSessionNonce = randomToken(32);

      this.db.prepare(`
        INSERT INTO password_reset_requests (
          reset_request_id, account_id, link_secret_hash, sms_code_hash,
          reset_session_nonce_hash, created_at, expires_at, sms_attempt_count,
          delivery_state, issued_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, 'pending')
      `).run(
        resetRequestId,
        account.account_id,
        hmac(linkSecret, this.hmacKey),
        hmac(smsCode, this.hmacKey),
        hmac(resetSessionNonce, this.hmacKey),
        now,
        now + HOUR_MS,
        now,
      );

      let emailSent = false;
      let smsSent = false;
      try {
        await this.email.sendReset(account.account_id, account.email_address, linkSecret);
        emailSent = true;
      } catch (_error) {
        this.db.prepare("UPDATE password_reset_requests SET delivery_state = 'failed' WHERE reset_request_id = ?")
          .run(resetRequestId);
        this.audit("email_delivery", account.account_id, "delivery_failed");
      }
      try {
        await this.sms.sendCode(account.account_id, account.phone_number, smsCode);
        smsSent = true;
      } catch (_error) {
        this.db.prepare("UPDATE password_reset_requests SET delivery_state = 'failed' WHERE reset_request_id = ?")
          .run(resetRequestId);
        this.audit("sms_delivery", account.account_id, "delivery_failed");
      }
      if (emailSent && smsSent) {
        this.db.prepare("UPDATE password_reset_requests SET delivery_state = 'sent' WHERE reset_request_id = ?")
          .run(resetRequestId);
      }
      this.audit("reset_requested", account.account_id, "success");
    } else {
      this.audit("reset_requested", null, "unknown_account");
    }

    return {
      resetRequestId: eligible ? undefined : undefined,
      message: "If an eligible account exists, reset instructions have been sent.",
    };
  }

  verifyLink(linkSecret) {
    if (!linkSecret) {
      return { error: "Invalid or expired reset link." };
    }
    const hash = hmac(String(linkSecret), this.hmacKey);
    const row = this.db.prepare("SELECT * FROM password_reset_requests WHERE link_secret_hash = ?").get(hash);
    const now = this.now();
    if (!row || row.status !== "pending" || row.expires_at <= now) {
      this.audit("link_verification", row?.account_id || null, "failure");
      return { error: "Invalid or expired reset link." };
    }

    const nonce = randomToken(32);
    const consumed = this.db.prepare(`
      UPDATE password_reset_requests
      SET link_verified_at = ?, link_consumed_at = ?, reset_session_nonce_hash = ?, version = version + 1
      WHERE reset_request_id = ? AND status = 'pending' AND expires_at > ?
        AND link_consumed_at IS NULL
    `).run(now, now, hmac(nonce, this.hmacKey), row.reset_request_id, now);
    if (consumed.changes !== 1) {
      this.audit("link_verification", row.account_id, "failure");
      return { error: "Invalid or expired reset link." };
    }
    this.audit("link_verification", row.account_id, "success");
    return { resetRequestId: row.reset_request_id, resetSessionNonce: nonce };
  }

  verifyCode(resetRequestId, smsCode, resetSessionNonce) {
    if (!resetRequestId || !smsCode || !resetSessionNonce) {
      return { error: "Invalid or expired verification code." };
    }

    const now = this.now();
    const row = this.db.prepare("SELECT * FROM password_reset_requests WHERE reset_request_id = ?").get(resetRequestId);
    if (!row || row.status !== "pending" || row.expires_at <= now || !row.link_verified_at) {
      this.audit("sms_verification", row?.account_id || null, "failure");
      return { error: "Invalid or expired verification code." };
    }
    if (!timingSafeEqualHex(hmac(resetSessionNonce, this.hmacKey), row.reset_session_nonce_hash)) {
      this.audit("sms_verification", row.account_id, "failure");
      return { error: "Invalid or expired verification code." };
    }

    const updated = this.db.prepare(`
      UPDATE password_reset_requests
      SET sms_attempt_count = sms_attempt_count + 1
      WHERE reset_request_id = ? AND sms_attempt_count < 5
        AND status = 'pending' AND expires_at > ? AND link_verified_at IS NOT NULL
    `).run(resetRequestId, now);
    if (updated.changes !== 1) {
      this.audit("sms_verification", row.account_id, "failure");
      return { error: "Invalid or expired verification code." };
    }

    if (!timingSafeEqualHex(hmac(String(smsCode), this.hmacKey), row.sms_code_hash)) {
      const attempts = this.db.prepare(
        "SELECT sms_attempt_count FROM password_reset_requests WHERE reset_request_id = ?",
      ).get(resetRequestId)?.sms_attempt_count || 0;
      if (attempts >= 5) {
        this.db.prepare(`
          UPDATE password_reset_requests
          SET status = 'invalidated', invalidation_reason = 'sms_attempt_limit',
              consumed_at = ?, version = version + 1
          WHERE reset_request_id = ? AND status = 'pending'
        `).run(now, resetRequestId);
      }
      this.audit("sms_verification", row.account_id, "failure");
      return { error: "Invalid or expired verification code." };
    }

    this.db.prepare(`
      UPDATE password_reset_requests
      SET sms_verified_at = ?, version = version + 1
      WHERE reset_request_id = ? AND status = 'pending' AND expires_at > ?
    `).run(now, resetRequestId, now);
    this.audit("sms_verification", row.account_id, "success");
    return { verified: true };
  }

  async completeReset(resetRequestId, resetSessionNonce, password, confirmation, currentSessionId = null) {
    if (!resetRequestId || !resetSessionNonce || typeof password !== "string" ||
        typeof confirmation !== "string") {
      this.audit("password_reset", null, "missing_fields");
      return { error: "Reset fields are required." };
    }
    const now = this.now();
    const row = this.db.prepare("SELECT * FROM password_reset_requests WHERE reset_request_id = ?").get(resetRequestId);
    if (!row || row.status !== "pending" || row.expires_at <= now || !row.link_verified_at || !row.sms_verified_at) {
      this.audit("password_reset", row?.account_id || null, "failure");
      return { error: "Reset is invalid or expired." };
    }
    if (!timingSafeEqualHex(hmac(resetSessionNonce || "", this.hmacKey), row.reset_session_nonce_hash)) {
      this.audit("password_reset", row.account_id, "failure");
      return { error: "Reset is invalid or expired." };
    }

    const history = this.db.prepare(`
      SELECT password_hash, password_salt, password_iterations
      FROM password_history
      WHERE account_id = ?
      ORDER BY changed_at DESC
      LIMIT 4
    `).all(row.account_id);

    const account = this.db.prepare("SELECT * FROM accounts WHERE account_id = ?").get(row.account_id);
    const historyHashes = history.map((item) => [
      item.password_iterations,
      item.password_salt,
      item.password_hash,
    ]);
    historyHashes.push([account.password_iterations, account.password_salt, account.password_hash]);

    const policyError = validatePassword(password, confirmation, historyHashes.slice(0, 5));
    if (policyError) {
      this.audit("password_reset", row.account_id, "password_rejected");
      return { error: policyError };
    }

    let completed = false;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.db.prepare(`
        SELECT * FROM password_reset_requests
        WHERE reset_request_id = ? AND status = 'pending'
          AND expires_at > ? AND link_verified_at IS NOT NULL
          AND sms_verified_at IS NOT NULL AND version = ?
      `).get(resetRequestId, now, row.version);
      if (current) {
        const [iterations, salt, hash] = passwordRecord(password);
        this.db.prepare(`
          INSERT INTO password_history (
            account_id, password_hash, password_salt, password_iterations, changed_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(row.account_id, account.password_hash, account.password_salt, account.password_iterations, now);
        this.db.prepare(`
          UPDATE accounts
          SET password_iterations = ?, password_salt = ?, password_hash = ?,
              session_generation = session_generation + 1
          WHERE account_id = ?
        `).run(iterations, salt, hash, row.account_id);
        if (currentSessionId) {
          this.db.prepare(`
            UPDATE active_sessions SET revoked = 1
            WHERE account_id = ? AND session_id != ?
          `).run(row.account_id, currentSessionId);
          this.db.prepare(`
            INSERT INTO active_sessions (session_id, account_id, session_generation, revoked)
            VALUES (?, ?, (SELECT session_generation FROM accounts WHERE account_id = ?), 0)
            ON CONFLICT(session_id) DO UPDATE SET
              account_id = excluded.account_id,
              session_generation = excluded.session_generation,
              revoked = 0
          `).run(currentSessionId, row.account_id, row.account_id);
        } else {
          this.db.prepare(`
            UPDATE active_sessions SET revoked = 1 WHERE account_id = ?
          `).run(row.account_id);
        }
        this.db.prepare(`
          UPDATE password_reset_requests
          SET status = 'completed', consumed_at = ?, invalidation_reason = 'completed',
              version = version + 1
          WHERE reset_request_id = ? AND status = 'pending'
        `).run(now, resetRequestId);
        completed = true;
      }
      this.db.exec(completed ? "COMMIT" : "ROLLBACK");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    if (!completed) {
      this.audit("password_reset", row.account_id, "failure");
      return { error: "Reset is invalid or expired." };
    }

    this.audit("password_reset", row.account_id, "success");
    const updatedAccount = this.db.prepare("SELECT * FROM accounts WHERE account_id = ?").get(row.account_id);
    try {
      await this.email.sendSuccess(row.account_id, updatedAccount.email_address);
      this.audit("success_notification", row.account_id, "success");
    } catch (_error) {
      this.audit("success_notification", row.account_id, "delivery_failed");
    }
    return { success: true, message: "Password changed successfully." };
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookie = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`) && item.indexOf("=") === name.length);
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

async function readJson(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    chunks.push(chunk);
    totalBytes += chunk.length;
    if (totalBytes > 1024 * 1024) {
      throw new Error("Request body too large");
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function createPasswordResetServer(service, publicDir, tlsOptions = null) {
  const requestHandler = async (request, response) => {
    try {
      if (request.method === "POST" &&
          !String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { message: "Content-Type must be application/json." });
        return;
      }
      if (request.method === "POST" && request.headers.origin) {
        let origin;
        try {
          origin = new URL(request.headers.origin);
        } catch (_error) {
          sendJson(response, 403, { message: "Request origin is not allowed." });
          return;
        }
        const host = request.headers.host ? `http${tlsOptions ? "s" : ""}://${request.headers.host}` : null;
        if (!host || origin.origin !== new URL(host).origin) {
          sendJson(response, 403, { message: "Request origin is not allowed." });
          return;
        }
      }
      if (request.method === "GET" && (request.url?.split("?")[0] === "/" || request.url?.split("?")[0] === "/index.html")) {
        const file = path.join(publicDir, "index.html");
        if (!fs.existsSync(file)) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(fs.readFileSync(file));
        return;
      }

      if (request.method === "POST" && request.url === "/api/password-reset/requests") {
        const body = await readJson(request);
        const source = request.socket.remoteAddress || "unknown";
        const result = await service.requestReset(body.identifier, source);
        sendJson(response, 200, { message: result.message });
        return;
      }

      if (request.method === "POST" && request.url === "/api/password-reset/links/verify") {
        const body = await readJson(request);
        const result = service.verifyLink(body.linkSecret);
        if (result.error) {
          sendJson(response, 400, { message: result.error });
          return;
        }
        response.setHeader("Set-Cookie", `reset_session=${encodeURIComponent(result.resetSessionNonce)}; HttpOnly; Secure; SameSite=Strict; Path=/api/password-reset; Max-Age=3600`);
        sendJson(response, 200, { resetRequestId: result.resetRequestId });
        return;
      }

      if (request.method === "POST" && request.url === "/api/password-reset/verify-code") {
        const body = await readJson(request);
        const nonce = parseCookie(request.headers.cookie, "reset_session");
        const result = service.verifyCode(body.resetRequestId, body.smsCode, nonce);
        sendJson(response, result.error ? 400 : 200, result.error ? { message: result.error } : { verified: true });
        return;
      }

      if (request.method === "POST" && request.url === "/api/password-reset/password") {
        const body = await readJson(request);
        const nonce = parseCookie(request.headers.cookie, "reset_session");
        const appSessionId = parseCookie(request.headers.cookie, "app_session");
        const result = await service.completeReset(
          body.resetRequestId,
          nonce,
          body.newPassword,
          body.confirmationPassword,
          appSessionId,
        );
        sendJson(response, result.error ? 400 : 200, result.error ? { message: result.error } : result);
        return;
      }

      sendJson(response, 404, { message: "Not found." });
    } catch (error) {
      if (error instanceof SyntaxError || error.message === "Request body too large") {
        sendJson(response, 400, { message: "Invalid request." });
        return;
      }
      sendJson(response, 500, { message: "The request could not be completed." });
    }
  };
  return tlsOptions ? https.createServer(tlsOptions, requestHandler) : http.createServer(requestHandler);
}
