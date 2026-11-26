import { createLogger } from "@kan/logger";

const log = createLogger("auth");

export const OIDC_PROVIDER_ID = "oidc";

interface DiscoveryDocument {
  end_session_endpoint?: string;
}

let cachedEndSessionEndpoint: { url: string | null; fetchedAt: number } | null =
  null;
const DISCOVERY_CACHE_MS = 60 * 60 * 1000;

export const isOidcConfigured = () =>
  !!(
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.OIDC_DISCOVERY_URL
  );

async function getEndSessionEndpoint(
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const override = process.env.OIDC_END_SESSION_URL;
  if (override) return override;

  const discoveryUrl = process.env.OIDC_DISCOVERY_URL;
  if (!discoveryUrl) return null;

  if (
    cachedEndSessionEndpoint &&
    Date.now() - cachedEndSessionEndpoint.fetchedAt < DISCOVERY_CACHE_MS
  ) {
    return cachedEndSessionEndpoint.url;
  }

  const response = await fetchImpl(discoveryUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`OIDC discovery request failed: ${response.status}`);
  }
  const doc = (await response.json()) as DiscoveryDocument;
  const url = doc.end_session_endpoint ?? null;
  cachedEndSessionEndpoint = { url, fetchedAt: Date.now() };
  return url;
}

/**
 * Builds the OIDC RP-initiated logout URL that ends the user's session at the
 * identity provider, so the next sign-in asks for credentials again instead of
 * silently reusing the SSO session. Returns null when OIDC isn't configured or
 * the provider doesn't advertise an end_session_endpoint.
 */
export async function buildOidcLogoutUrl(args: {
  idToken: string | null;
  postLogoutRedirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  if (!isOidcConfigured()) return null;

  try {
    const endpoint = await getEndSessionEndpoint(args.fetchImpl ?? fetch);
    if (!endpoint) {
      log.warn(
        "OIDC provider has no end_session_endpoint; SSO session will stay active",
      );
      return null;
    }

    const url = new URL(endpoint);
    if (args.idToken) url.searchParams.set("id_token_hint", args.idToken);
    url.searchParams.set("client_id", process.env.OIDC_CLIENT_ID ?? "");
    url.searchParams.set(
      "post_logout_redirect_uri",
      args.postLogoutRedirectUri,
    );
    return url.toString();
  } catch (error) {
    log.error({ err: error }, "Failed to build OIDC logout URL");
    return null;
  }
}

/** Test helper. */
export const resetOidcLogoutCache = () => {
  cachedEndSessionEndpoint = null;
};
