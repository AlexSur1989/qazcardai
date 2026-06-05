import { NextResponse, type NextRequest } from "next/server";

import { buildPublicAppRedirect } from "@/lib/auth-public-url";
import { isGoogleOAuthConfigured } from "@/lib/google-auth-config";
import { buildGoogleAuthorizationUrl } from "@/server/services/googleOAuthClient";
import { issueGoogleOAuthState } from "@/lib/google-oauth-state";
import { postAuthLandingPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

function safeCallbackPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return postAuthLandingPath(raw, undefined);
  }
  return postAuthLandingPath(null, undefined);
}

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      buildPublicAppRedirect("/login?error=google_oauth_failed"),
    );
  }

  const callbackPath = safeCallbackPath(
    req.nextUrl.searchParams.get("callbackUrl"),
  );

  try {
    const { state } = await issueGoogleOAuthState(callbackPath);
    const authUrl = buildGoogleAuthorizationUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.warn(
      `[google] oauth_start_failed: ${err instanceof Error ? err.message : "unknown"}`,
    );
    return NextResponse.redirect(
      buildPublicAppRedirect("/login?error=google_oauth_failed"),
    );
  }
}
