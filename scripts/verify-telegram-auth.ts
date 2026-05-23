/**
 * Telegram Login Widget: verify hash + public URL + конфиг.
 * npm run verify:telegram-auth
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildPublicAppRedirect,
  getPublicAppUrl,
  normalizePublicAppUrlRaw,
} from "../src/lib/auth-public-url";
import {
  computeTelegramLoginHash,
  verifyTelegramLoginPayload,
} from "../src/lib/telegram-login-verify";
import {
  getTelegramBotUsernameForWidget,
  getTelegramWidgetAuthCallbackUrl,
  isTelegramWidgetConfigured,
  telegramAuthEnabledForUi,
} from "../src/lib/telegram-auth-config";

const TEST_BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
const TEST_NOW = 1_700_000_000;

/** process.env в Node типизирован как read-only; для verify-script нужен временный override. */
const mutableEnv = process.env as Record<string, string | undefined>;

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void,
): void {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = mutableEnv[key];
    if (value === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete mutableEnv[key];
      } else {
        mutableEnv[key] = value;
      }
    }
  }
}

function buildValidPayload() {
  const fields = {
    auth_date: String(TEST_NOW),
    first_name: "Ivan",
    id: "42424242",
    username: "ivan_test",
  };
  const hash = computeTelegramLoginHash(fields, TEST_BOT_TOKEN);
  return { ...fields, hash };
}

function testVerifyHash(): void {
  const payload = buildValidPayload();
  const ok = verifyTelegramLoginPayload(payload, TEST_BOT_TOKEN, {
    nowSec: TEST_NOW,
  });
  assert.equal(ok.ok, true, "valid payload must pass");

  const badHash = verifyTelegramLoginPayload(
    { ...payload, hash: "deadbeef".repeat(8) },
    TEST_BOT_TOKEN,
    { nowSec: TEST_NOW },
  );
  assert.equal(badHash.ok, false);
  assert.equal(badHash.reason, "invalid_hash");

  const noHash = verifyTelegramLoginPayload(
    { ...payload, hash: undefined },
    TEST_BOT_TOKEN,
    { nowSec: TEST_NOW },
  );
  assert.equal(noHash.ok, false);
  assert.equal(noHash.reason, "missing_hash");

  const noId = verifyTelegramLoginPayload(
    { ...payload, id: undefined },
    TEST_BOT_TOKEN,
    { nowSec: TEST_NOW },
  );
  assert.equal(noId.ok, false);
  assert.equal(noId.reason, "missing_id");

  const expired = verifyTelegramLoginPayload(payload, TEST_BOT_TOKEN, {
    nowSec: TEST_NOW + 86_401,
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, "expired_auth_date");
}

function testPublicAppUrl(): void {
  assert.equal(
    normalizePublicAppUrlRaw("http://0.0.0.0:3000", { production: false }),
    "http://localhost:3000",
  );
  assert.equal(
    normalizePublicAppUrlRaw("https://app.qazcardai.kz/", { production: true }),
    "https://app.qazcardai.kz",
  );

  assert.throws(
    () => normalizePublicAppUrlRaw("http://0.0.0.0:3000", { production: true }),
    /0\.0\.0\.0/,
  );
  assert.throws(
    () => normalizePublicAppUrlRaw("http://localhost:3000", { production: true }),
    /localhost/,
  );

  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://0.0.0.0:3000",
    },
    () => {
      assert.equal(getPublicAppUrl(), "http://localhost:3000");
      assert.equal(
        buildPublicAppRedirect("/login?error=telegram_auth_failed"),
        "http://localhost:3000/login?error=telegram_auth_failed",
      );
      assert.doesNotMatch(getPublicAppUrl(), /0\.0\.0\.0/);
    },
  );

  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://app.qazcardai.kz",
    },
    () => {
      assert.equal(
        getTelegramWidgetAuthCallbackUrl("/dashboard"),
        "https://app.qazcardai.kz/api/auth/telegram/callback?callbackUrl=%2Fdashboard",
      );
    },
  );
}

function testBotTokenNotInClientBundle(): void {
  const clientPaths = [
    path.join(process.cwd(), "src/components/auth/telegram-login-button.tsx"),
    path.join(process.cwd(), "src/app/login/login-form.tsx"),
    path.join(process.cwd(), "src/app/register/register-form.tsx"),
  ];
  for (const file of clientPaths) {
    const src = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(src, /TELEGRAM_BOT_TOKEN/);
    assert.doesNotMatch(src, /process\.env\.TELEGRAM_BOT_TOKEN/);
  }

  const callbackRoute = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/auth/telegram/callback/route.ts"),
    "utf8",
  );
  assert.match(callbackRoute, /getTelegramBotToken/);
  assert.match(callbackRoute, /buildPublicAppRedirect/);
  assert.doesNotMatch(callbackRoute, /new URL\([^,]+,\s*req\.url\)/);
}

function testNoOidcFlowInUi(): void {
  const loginForm = fs.readFileSync(
    path.join(process.cwd(), "src/app/login/login-form.tsx"),
    "utf8",
  );
  const registerForm = fs.readFileSync(
    path.join(process.cwd(), "src/app/register/register-form.tsx"),
    "utf8",
  );
  for (const src of [loginForm, registerForm]) {
    assert.doesNotMatch(src, /oauth\.telegram\.org/);
    assert.doesNotMatch(src, /telegram\/start/);
    assert.doesNotMatch(src, /response_type=code/);
    assert.doesNotMatch(src, /scope=openid/);
  }

  assert.equal(
    fs.existsSync(path.join(process.cwd(), "src/app/api/auth/telegram/start/route.ts")),
    false,
    "OIDC start route must be removed",
  );
}

function testCallbackRoute(): void {
  const callbackRoute = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/auth/telegram/callback/route.ts"),
    "utf8",
  );
  assert.match(callbackRoute, /verifyTelegramLoginPayload/);
  assert.match(callbackRoute, /completeTelegramWidgetSignIn/);
  assert.match(callbackRoute, /setAuthJwtSession/);
  assert.match(callbackRoute, /telegram_auth_failed/);
  assert.match(callbackRoute, /wrong_telegram_flow_oidc_payload/);
  assert.match(callbackRoute, /logTelegramAuthFailure/);
}

function testConfigHelpers(): void {
  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      TELEGRAM_AUTH_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "x:y",
      NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "@MyBot",
    },
    () => {
      assert.equal(getTelegramBotUsernameForWidget(), "MyBot");
      assert.equal(isTelegramWidgetConfigured(), true);
      assert.equal(telegramAuthEnabledForUi(), true);
    },
  );
}

async function main(): Promise<void> {
  testVerifyHash();
  testPublicAppUrl();
  testBotTokenNotInClientBundle();
  testNoOidcFlowInUi();
  testCallbackRoute();
  testConfigHelpers();
  console.log("verify:telegram-auth OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
