import { authClient } from "@kan/auth/client";

interface LogoutResponse {
  redirectUrl?: string;
}

/**
 * Signs the user out of Kan and, when they signed in through SSO, out of the
 * identity provider as well. Falls back to a local sign-out if the server
 * endpoint is unreachable.
 */
export async function signOut(): Promise<void> {
  let redirectUrl = "/login";

  try {
    const response = await fetch("/api/session/logout", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error(`Logout failed: ${response.status}`);
    const data = (await response.json()) as LogoutResponse;
    if (data.redirectUrl) redirectUrl = data.redirectUrl;
  } catch {
    await authClient.signOut().catch(() => undefined);
  }

  // Full navigation: clears client state and lets the browser follow the
  // identity provider's end-session redirect.
  window.location.assign(redirectUrl);
}
