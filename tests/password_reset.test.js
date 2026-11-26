import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  InMemoryEmailProvider,
  InMemorySmsProvider,
  PasswordResetService,
} from "../src/password_reset.js";

function createFixture() {
  const db = new DatabaseSync(":memory:");
  const email = new InMemoryEmailProvider();
  const sms = new InMemorySmsProvider();
  const service = new PasswordResetService({
    db,
    email,
    sms,
    hmacKey: "test-key",
  });
  service.createAccount({
    accountId: "account-1",
    email: "user@example.com",
    phone: "+15555550101",
    password: "InitialPassword1",
  });
  return { service, email, sms };
}

test("password reset completes with email link and SMS code", async () => {
  const { service, email, sms } = createFixture();

  const requested = await service.requestReset("user@example.com", "127.0.0.1");
  assert.equal(requested.message, "If an eligible account exists, reset instructions have been sent.");
  assert.equal(email.outbox.length, 1);
  assert.equal(sms.outbox.length, 1);

  const reset = service.verifyLink(email.outbox[0].linkSecret);
  assert.ok(reset.resetRequestId);
  assert.ok(reset.resetSessionNonce);

  const code = sms.outbox[0].code;
  assert.equal(
    service.verifyCode(reset.resetRequestId, code, reset.resetSessionNonce).verified,
    true,
  );

  const completed = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "NewSecurePass2",
    "NewSecurePass2",
  );
  assert.equal(completed.success, true);

  const state = service.db.prepare(
    "SELECT status, consumed_at, invalidation_reason FROM password_reset_requests WHERE reset_request_id = ?",
  ).get(reset.resetRequestId);
  assert.equal(state.status, "completed");
  assert.ok(state.consumed_at);
  assert.equal(state.invalidation_reason, "completed");

  service.close();
});

test("password reset rejects replay and invalid password policy", async () => {
  const { service, email, sms } = createFixture();
  await service.requestReset("user@example.com", "127.0.0.2");
  const reset = service.verifyLink(email.outbox[0].linkSecret);
  assert.equal(service.verifyCode(reset.resetRequestId, sms.outbox[0].code, reset.resetSessionNonce).verified, true);

  const tooShort = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "Short1A",
    "Short1A",
  );
  assert.match(tooShort.error, /12 characters/);

  const missingUppercase = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "lowercasepass1",
    "lowercasepass1",
  );
  assert.match(missingUppercase.error, /uppercase/);

  const reused = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "InitialPassword1",
    "InitialPassword1",
  );
  assert.match(reused.error, /last 5/);

  const completed = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "NewSecurePass2",
    "NewSecurePass2",
  );
  assert.equal(completed.success, true);

  const replay = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "AnotherPass3",
    "AnotherPass3",
  );
  assert.ok(replay.error);
  service.close();
});

test("SMS verification is limited to five authoritative attempts", async () => {
  const { service, email, sms } = createFixture();
  await service.requestReset("user@example.com", "127.0.0.3");
  const reset = service.verifyLink(email.outbox[0].linkSecret);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.ok(
      service.verifyCode(reset.resetRequestId, "000000", reset.resetSessionNonce).error,
    );
  }

  assert.ok(
    service.verifyCode(reset.resetRequestId, sms.outbox[0].code, reset.resetSessionNonce).error,
  );
  service.close();
});

test("unknown identifiers return the same generic response", async () => {
  const { service, email, sms } = createFixture();
  const unknown = await service.requestReset("unknown@example.com", "127.0.0.4");
  const known = await service.requestReset("user@example.com", "127.0.0.5");

  assert.equal(unknown.message, known.message);
  assert.equal(email.outbox.length, 1);
  assert.equal(sms.outbox.length, 1);
  service.close();
});

test("reset requests are limited to three within 15 minutes", async () => {
  const { service } = createFixture();
  const source = "127.0.0.6";

  assert.equal((await service.requestReset("user@example.com", source)).limited, undefined);
  assert.equal((await service.requestReset("user@example.com", source)).limited, undefined);
  assert.equal((await service.requestReset("user@example.com", source)).limited, undefined);
  const fourth = await service.requestReset("user@example.com", source);
  assert.equal(fourth.limited, true);
  service.close();
});

test("email reset link is one-time and wrong session nonce is rejected", async () => {
  const { service, email, sms } = createFixture();
  await service.requestReset("user@example.com", "127.0.0.7");
  const first = service.verifyLink(email.outbox[0].linkSecret);
  assert.ok(first.resetRequestId);
  const replay = service.verifyLink(email.outbox[0].linkSecret);
  assert.ok(replay.error);

  const codeVerified = service.verifyCode(
    first.resetRequestId,
    sms.outbox[0].code,
    "wrong-session-nonce",
  );
  assert.ok(codeVerified.error);
  service.close();
});

test("successful reset sends notification and revokes other sessions", async () => {
  const { service, email, sms } = createFixture();
  service.db.prepare(`
    INSERT INTO active_sessions (session_id, account_id, session_generation, revoked)
    VALUES (?, ?, 1, 0), (?, ?, 1, 0)
  `).run("current", "account-1", "other", "account-1");
  await service.requestReset("user@example.com", "127.0.0.8");
  const reset = service.verifyLink(email.outbox[0].linkSecret);
  assert.equal(
    service.verifyCode(reset.resetRequestId, sms.outbox[0].code, reset.resetSessionNonce).verified,
    true,
  );
  const completed = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "AnotherSecure3",
    "AnotherSecure3",
    "current",
  );
  assert.equal(completed.success, true);
  assert.equal(email.outbox.some((item) => item.type === "success"), true);
  const sessions = service.db.prepare(
    "SELECT session_id, revoked FROM active_sessions ORDER BY session_id",
  ).all();
  assert.deepEqual(
    sessions.map((item) => [item.session_id, item.revoked]),
    [["current", 0], ["other", 1]],
  );
  service.close();
});

test("password mismatch and missing number are rejected", async () => {
  const { service, email, sms } = createFixture();
  await service.requestReset("user@example.com", "127.0.0.9");
  const reset = service.verifyLink(email.outbox[0].linkSecret);
  assert.equal(
    service.verifyCode(reset.resetRequestId, sms.outbox[0].code, reset.resetSessionNonce).verified,
    true,
  );

  const mismatch = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "MismatchPass3",
    "DifferentPass3",
  );
  assert.match(mismatch.error, /do not match/);

  const missingNumber = await service.completeReset(
    reset.resetRequestId,
    reset.resetSessionNonce,
    "NoDigitsHere",
    "NoDigitsHere",
  );
  assert.match(missingNumber.error, /number/);

  service.close();
});

test("expired link and SMS verification state are rejected", async () => {
  let currentTime = 1000;
  const { service, email, sms } = createFixture();
  service.now = () => currentTime;

  await service.requestReset("user@example.com", "127.0.0.10");
  const reset = service.verifyLink(email.outbox[0].linkSecret);
  assert.ok(reset.resetRequestId);

  currentTime += 60 * 60 * 1000 + 1;
  assert.ok(service.verifyLink(email.outbox[0].linkSecret).error);
  assert.ok(
    service.verifyCode(reset.resetRequestId, sms.outbox[0].code, reset.resetSessionNonce).error,
  );
  assert.ok(
    (await service.completeReset(
      reset.resetRequestId,
      reset.resetSessionNonce,
      "ExpiredPass123",
      "ExpiredPass123",
    )).error,
  );
  service.close();
});
