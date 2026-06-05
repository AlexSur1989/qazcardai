import { NextResponse, type NextRequest } from "next/server";

import { buildPublicAppRedirect } from "@/lib/auth-public-url";
import { postAuthLandingPath } from "@/lib/auth";
import { setAuthJwtSession } from "@/lib/auth-jwt-session";
import { consumeGoogleOAuthState } from "@/lib/google-oauth-state";
import {
  completeGoogleOAuthSignIn,
  mapGoogleSignInFailureToErrorParam,
} from "@/server/services/googleSignIn";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserProfile,
} from "@/server/services/googleOAuthClient";
import { isGoogleOAuthConfigured } from "@/lib/google-auth-config";

export const dynamic = "force-dynamic";

function fail(errorParam: string): NextResponse {
  return NextResponse.redirect(
    buildPublicAppRedirect(`/login?error=${encodeURIComponent(errorParam)}`),
  );
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (!isGoogleOAuthConfigured()) {
    return fail("google_oauth_failed");
  }

  const oauthError = sp.get("error");
  if (oauthError) {
    console.warn(`[google] oauth_provider_error: ${oauthError}`);
    return fail("google_oauth_failed");
  }

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code?.trim()) {
    return fail("google_oauth_failed");
  }

  const stateCheck = await consumeGoogleOAuthState(state);
  if (!stateCheck.ok) {
    console.warn(`[google] state_validation_failed: ${stateCheck.reason}`);
    return fail("google_oauth_failed");
  }

  const tokenRes = await exchangeGoogleAuthCode(code.trim());
  if (!tokenRes.ok) {
    return fail("google_oauth_failed");
  }

  const profile = await fetchGoogleUserProfile(tokenRes.accessToken);
  if (!profile) {
    return fail("google_oauth_failed");
  }

  const signIn = await completeGoogleOAuthSignIn(profile);
  if (!signIn.ok) {
    return fail(mapGoogleSignInFailureToErrorParam(signIn.failureReason));
  }

  try {
    await setAuthJwtSession(signIn.user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AUTH_SECRET")) {
      return fail("google_oauth_failed");
    }
    console.warn("[google] session_set_error: unknown");
    return fail("google_oauth_failed");
  }

  const target = postAuthLandingPath(
    stateCheck.callbackPath,
    signIn.user.role,
  );
  return NextResponse.redirect(buildPublicAppRedirect(target));
}
