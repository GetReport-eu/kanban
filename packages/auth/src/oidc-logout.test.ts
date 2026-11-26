import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildOidcLogoutUrl, resetOidcLogoutCache } from "./oidc-logout";

const discovery = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;

beforeEach(() => {
  resetOidcLogoutCache();
  process.env.OIDC_CLIENT_ID = "kan";
  process.env.OIDC_CLIENT_SECRET = "secret";
  process.env.OIDC_DISCOVERY_URL =
    "https://sso.example.com/.well-known/openid-configuration";
  delete process.env.OIDC_END_SESSION_URL;
});

afterEach(() => {
  delete process.env.OIDC_CLIENT_ID;
  delete process.env.OIDC_CLIENT_SECRET;
  delete process.env.OIDC_DISCOVERY_URL;
  delete process.env.OIDC_END_SESSION_URL;
});

describe("buildOidcLogoutUrl", () => {
  it("builds the end-session URL from the discovery document", async () => {
    const url = await buildOidcLogoutUrl({
      idToken: "id.token.value",
      postLogoutRedirectUri: "https://kan.example.com/login",
      fetchImpl: discovery({
        end_session_endpoint: "https://sso.example.com/logout",
      }),
    });

    const parsed = new URL(url ?? "");
    expect(parsed.origin + parsed.pathname).toBe(
      "https://sso.example.com/logout",
    );
    expect(parsed.searchParams.get("id_token_hint")).toBe("id.token.value");
    expect(parsed.searchParams.get("client_id")).toBe("kan");
    expect(parsed.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://kan.example.com/login",
    );
  });

  it("uses OIDC_END_SESSION_URL without fetching discovery", async () => {
    process.env.OIDC_END_SESSION_URL = "https://sso.example.com/custom-logout";
    const fetchImpl = discovery({});

    const url = await buildOidcLogoutUrl({
      idToken: null,
      postLogoutRedirectUri: "https://kan.example.com/login",
      fetchImpl,
    });

    expect(url).toContain("https://sso.example.com/custom-logout?");
    expect(url).not.toContain("id_token_hint");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null when OIDC is not configured", async () => {
    delete process.env.OIDC_CLIENT_ID;
    const url = await buildOidcLogoutUrl({
      idToken: "x",
      postLogoutRedirectUri: "https://kan.example.com/login",
      fetchImpl: discovery({ end_session_endpoint: "https://sso/logout" }),
    });
    expect(url).toBeNull();
  });

  it("returns null when discovery fails or has no end_session_endpoint", async () => {
    expect(
      await buildOidcLogoutUrl({
        idToken: "x",
        postLogoutRedirectUri: "https://kan.example.com/login",
        fetchImpl: discovery({}, false),
      }),
    ).toBeNull();
    expect(
      await buildOidcLogoutUrl({
        idToken: "x",
        postLogoutRedirectUri: "https://kan.example.com/login",
        fetchImpl: discovery({}),
      }),
    ).toBeNull();
  });
});
