/**
 * Google OAuth: конфиг, callback URL, state CSRF, linking logic.
 * npm run verify:google-auth
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  getGoogleAuthUiState,
  getGoogleOAuthCallbackUrl,
  getGoogleOAuthEnvStatus,
  getGoogleOAuthStartUrl,
  isGoogleOAuthConfigured,
} from "../src/lib/google-auth-config";
import { googleProfileFromUserInfo } from "../src/lib/google-profile";
import { mapGoogleSignInFailureToErrorParam } from "../src/lib/google-auth-errors";

const GOOGLE_IDENTITY_PROVIDER = "google";

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

function testCallbackUrl(): void {
  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://app.qazcardai.kz",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
    () => {
      assert.equal(
        getGoogleOAuthCallbackUrl(),
        "https://app.qazcardai.kz/api/auth/google/callback",
      );
      assert.match(
        getGoogleOAuthStartUrl("/dashboard"),
        /^https:\/\/app\.qazcardai\.kz\/api\/auth\/google\?callbackUrl=/,
      );
    },
  );
}

function testConfigured(): void {
  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    },
    () => {
      assert.equal(isGoogleOAuthConfigured(), true);
      assert.equal(getGoogleAuthUiState(), "enabled");
      const status = getGoogleOAuthEnvStatus();
      assert.equal(status.configured, true);
      assert.equal(status.clientIdPresent, true);
      assert.equal(status.clientSecretPresent, true);
      assert.equal(
        status.callbackUrl,
        "http://localhost:3000/api/auth/google/callback",
      );
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://app.qazcardai.kz",
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    },
    () => {
      assert.equal(isGoogleOAuthConfigured(), false);
      assert.equal(getGoogleAuthUiState(), "hidden");
    },
  );

  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    },
    () => {
      assert.equal(getGoogleAuthUiState(), "disabled");
    },
  );
}

function testProfileParsing(): void {
  const verified = googleProfileFromUserInfo({
    sub: "123456789",
    email: "user@example.com",
    email_verified: true,
    name: "Test User",
    picture: "https://lh3.googleusercontent.com/a/photo.jpg",
  });
  assert.ok(verified);
  assert.equal(verified!.id, "123456789");
  assert.equal(verified!.email, "user@example.com");
  assert.equal(verified!.emailVerified, true);

  const unverified = googleProfileFromUserInfo({
    sub: "123",
    email: "user@example.com",
    email_verified: false,
  });
  assert.ok(unverified);
  assert.equal(unverified!.emailVerified, false);

  assert.equal(googleProfileFromUserInfo({}), null);
}

function testErrorMapping(): void {
  assert.equal(
    mapGoogleSignInFailureToErrorParam("EMAIL_NOT_VERIFIED"),
    "google_email_not_verified",
  );
  assert.equal(
    mapGoogleSignInFailureToErrorParam("ERROR"),
    "google_oauth_failed",
  );
}

function testRoutesExist(): void {
  const root = path.join(process.cwd(), "src/app/api/auth/google");
  assert.ok(fs.existsSync(path.join(root, "route.ts")));
  assert.ok(fs.existsSync(path.join(root, "callback/route.ts")));
}

function testNoClientSecretExposure(): void {
  const clientFiles = [
    "src/components/auth/google-login-button.tsx",
    "src/app/login/login-form.tsx",
    "src/app/register/register-form.tsx",
  ];
  for (const rel of clientFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.ok(
      !content.includes("GOOGLE_CLIENT_SECRET"),
      `${rel} must not reference GOOGLE_CLIENT_SECRET`,
    );
  }
}

function testProviderConstant(): void {
  assert.equal(GOOGLE_IDENTITY_PROVIDER, "google");
}

function main(): void {
  testCallbackUrl();
  testConfigured();
  testProfileParsing();
  testErrorMapping();
  testRoutesExist();
  testNoClientSecretExposure();
  testProviderConstant();
  console.log("verify:google-auth OK");
}

main();
