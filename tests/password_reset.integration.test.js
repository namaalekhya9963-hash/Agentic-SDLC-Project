import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  InMemoryEmailProvider,
  InMemorySmsProvider,
  PasswordResetService,
  createPasswordResetServer,
} from "../src/password_reset.js";

async function startServer(service, publicDir = "src/public") {
  const server = createPasswordResetServer(service, publicDir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function post(baseUrl, pathname, body, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    setCookie: response.headers.get("set-cookie"),
  };
}

function createFixture() {
  const db = new DatabaseSync(":memory:");
  const email = new InMemoryEmailProvider();
  const sms = new InMemorySmsProvider();
  const service = new PasswordResetService({ db, email, sms, hmacKey: "integration-key" });
  service.createAccount({
    accountId: "integration-account",
    email: "integration@example.com",
    phone: "+15555550199",
    password: "InitialPassword1",
  });
  return { service, email, sms };
}

test("integration happy path completes password reset through HTTP", async () => {
  const { service, email, sms } = createFixture();
  const { server, baseUrl } = await startServer(service);

  try {
    const request = await post(baseUrl, "/api/password-reset/requests", {
      identifier: "integration@example.com",
    });
    assert.equal(request.status, 200);
    assert.match(request.body.message, /eligible account/);

    const link = await post(baseUrl, "/api/password-reset/links/verify", {
      linkSecret: email.outbox[0].linkSecret,
    });
    assert.equal(link.status, 200);
    assert.ok(link.body.resetRequestId);
    assert.match(link.setCookie, /^reset_session=/);
    assert.match(link.setCookie, /HttpOnly/);
    assert.match(link.setCookie, /Secure/);

    const resetCookie = link.setCookie.split(";")[0];
    const code = await post(
      baseUrl,
      "/api/password-reset/verify-code",
      {
        resetRequestId: link.body.resetRequestId,
        smsCode: sms.outbox[0].code,
      },
      { Cookie: resetCookie },
    );
    assert.equal(code.status, 200);
    assert.equal(code.body.verified, true);

    const completed = await post(
      baseUrl,
      "/api/password-reset/password",
      {
        resetRequestId: link.body.resetRequestId,
        newPassword: "VerifiedPass123",
        confirmationPassword: "VerifiedPass123",
      },
      { Cookie: resetCookie },
    );
    assert.equal(completed.status, 200);
    assert.equal(completed.body.success, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
  }
});

test("integration rejects invalid password and missing verification fields", async () => {
  const { service } = createFixture();
  const { server, baseUrl } = await startServer(service);

  try {
    const missingRequest = await post(baseUrl, "/api/password-reset/requests", {});
    assert.equal(missingRequest.status, 200);
    assert.match(missingRequest.body.message, /eligible account/);

    const missingLink = await post(baseUrl, "/api/password-reset/links/verify", {});
    assert.equal(missingLink.status, 400);

    const missingCode = await post(baseUrl, "/api/password-reset/verify-code", {});
    assert.equal(missingCode.status, 400);

    const missingPassword = await post(baseUrl, "/api/password-reset/password", {});
    assert.equal(missingPassword.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
  }
});

test("integration returns Not Found for unknown routes and missing pages", async () => {
  const { service } = createFixture();
  const { server, baseUrl } = await startServer(service);

  try {
    const unknownRoute = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(unknownRoute.status, 404);

    const missingPage = await fetch(`${baseUrl}/missing-page`);
    assert.equal(missingPage.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
  }
});

test("integration rejects wrong content type, origin, malformed JSON, and oversized body", async () => {
  const { service } = createFixture();
  const { server, baseUrl } = await startServer(service);

  try {
    const wrongContentType = await fetch(`${baseUrl}/api/password-reset/requests`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.equal(wrongContentType.status, 415);

    const wrongOrigin = await post(
      baseUrl,
      "/api/password-reset/requests",
      {},
      { Origin: "https://attacker.example" },
    );
    assert.equal(wrongOrigin.status, 403);

    const malformed = await fetch(`${baseUrl}/api/password-reset/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);

    const oversized = await fetch(`${baseUrl}/api/password-reset/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "x".repeat(1024 * 1024) }),
    });
    assert.equal(oversized.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
  }
});

test("integration handles provider delivery failures and internal exceptions", async () => {
  const db = new DatabaseSync(":memory:");
  const email = new InMemoryEmailProvider();
  const sms = new InMemorySmsProvider();
  email.sendReset = async () => {
    throw new Error("provider unavailable");
  };
  const service = new PasswordResetService({ db, email, sms, hmacKey: "provider-key" });
  service.createAccount({
    accountId: "provider-account",
    email: "provider@example.com",
    phone: "+15555550200",
    password: "InitialPassword1",
  });
  const { server, baseUrl } = await startServer(service);

  try {
    const request = await post(baseUrl, "/api/password-reset/requests", {
      identifier: "provider@example.com",
    });
    assert.equal(request.status, 200);
    const state = db.prepare(
      "SELECT delivery_state FROM password_reset_requests WHERE account_id = ?",
    ).get("provider-account");
    assert.equal(state.delivery_state, "failed");

    const broken = {
      requestReset: async () => {
        throw new Error("database unavailable");
      },
    };
    const brokenServer = createPasswordResetServer(broken, "src/public");
    await new Promise((resolve) => brokenServer.listen(0, "127.0.0.1", resolve));
    const brokenAddress = brokenServer.address();
    try {
      const brokenResponse = await fetch(
        `http://127.0.0.1:${brokenAddress.port}/api/password-reset/requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: "test@example.com" }),
        },
      );
      assert.equal(brokenResponse.status, 500);
    } finally {
      await new Promise((resolve) => brokenServer.close(resolve));
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
  }
});

test("documentation quality includes setup, API, test, and project documents", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  assert.match(readme, /^# Password Reset Service/m);
  assert.match(readme, /## Overview/);
  assert.match(readme, /## Requirements/);
  assert.match(readme, /## Run/);
  assert.match(readme, /## API/);
  assert.match(readme, /## Test/);

  for (const file of [
    "requirements.md",
    "architecture.md",
    "design-review.md",
    "impl-plan.md",
  ]) {
    assert.equal(fs.statSync(file).isFile(), true);
    assert.ok(fs.readFileSync(file, "utf8").trim().length > 100, `${file} must contain documentation`);
  }
});
