import type { NextApiRequest, NextApiResponse } from "next";

import { buildOidcLogoutUrl, OIDC_PROVIDER_ID } from "@kan/auth/server";
import * as userRepo from "@kan/db/repository/user.repo";
import { createLogger } from "@kan/logger";
import { auth, createNextApiContext } from "@kan/server/context";
import { withRateLimit } from "@kan/server/utils/rateLimit";

import { env } from "~/env";

const log = createLogger("session-logout");

const toHeaders = (req: NextApiRequest) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
};

// Ends the Kan session and, for users who signed in through the OIDC
// provider, returns the provider's end-session URL so the browser can end the
// SSO session too. Without that, the next "Sign in with SSO" would log the
// user straight back in without asking for credentials.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { db, user } = await createNextApiContext(req);

  let redirectUrl = "/login";

  if (user) {
    try {
      const oidcAccount = await userRepo.getLatestProviderAccount(
        db,
        user.id,
        OIDC_PROVIDER_ID,
      );

      if (oidcAccount) {
        const baseUrl =
          env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
        const oidcLogoutUrl = await buildOidcLogoutUrl({
          idToken: oidcAccount.idToken,
          postLogoutRedirectUri: new URL("/login", baseUrl).toString(),
        });
        if (oidcLogoutUrl) redirectUrl = oidcLogoutUrl;
      }
    } catch (error) {
      log.error(
        { err: error, userId: user.id },
        "Failed to resolve SSO logout",
      );
    }
  }

  try {
    const signOutResponse = await auth.api.signOut({
      headers: toHeaders(req),
      asResponse: true,
    });
    const setCookies = signOutResponse.headers.getSetCookie();
    if (setCookies.length > 0) res.setHeader("Set-Cookie", setCookies);
  } catch (error) {
    log.warn({ err: error, userId: user?.id }, "Kan sign-out failed");
  }

  log.info(
    { userId: user?.id, sso: redirectUrl !== "/login" },
    "User signed out",
  );

  return res.status(200).json({ redirectUrl });
}

export default withRateLimit(
  { keyPrefix: "session-logout", points: 30, duration: 60 },
  handler,
);
