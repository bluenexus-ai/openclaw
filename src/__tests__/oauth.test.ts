import { describe, it, expect } from "vitest";
import {
  generatePkce,
  shouldUseManualOAuthFlow,
  buildAuthUrl,
  parseCallbackInput,
} from "../oauth.js";
import type { OAuthMetadata } from "../types.js";

describe("generatePkce", () => {
  it("returns verifier and challenge", () => {
    const pkce = generatePkce();
    expect(pkce.verifier).toBeDefined();
    expect(pkce.challenge).toBeDefined();
    expect(pkce.verifier.length).toBeGreaterThan(0);
    expect(pkce.challenge.length).toBeGreaterThan(0);
  });

  it("generates unique values each time", () => {
    const a = generatePkce();
    const b = generatePkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });

  it("challenge is base64url encoded", () => {
    const pkce = generatePkce();
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("shouldUseManualOAuthFlow", () => {
  it("returns true when remote", () => {
    expect(shouldUseManualOAuthFlow(true)).toBe(true);
  });

  it("returns false when not remote on non-WSL", () => {
    expect(shouldUseManualOAuthFlow(false)).toBe(false);
  });
});

describe("buildAuthUrl", () => {
  const metadata: OAuthMetadata = {
    issuer: "https://api.bluenexus.ai",
    authorization_endpoint: "https://api.bluenexus.ai/oauth/authorize",
    token_endpoint: "https://api.bluenexus.ai/oauth/token",
  };

  it("builds correct authorization URL with all params", () => {
    const url = buildAuthUrl({
      metadata,
      clientId: "test-client",
      redirectUri: "http://localhost:51122/oauth-callback",
      challenge: "test-challenge",
      state: "test-state",
      scope: "openid profile",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.bluenexus.ai/oauth/authorize"
    );
    expect(parsed.searchParams.get("client_id")).toBe("test-client");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:51122/oauth-callback"
    );
    expect(parsed.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("test-state");
    expect(parsed.searchParams.get("scope")).toBe("openid profile");
  });

  it("omits scope if not provided", () => {
    const url = buildAuthUrl({
      metadata,
      clientId: "test-client",
      redirectUri: "http://localhost:51122/oauth-callback",
      challenge: "test-challenge",
      state: "test-state",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.has("scope")).toBe(false);
  });
});

describe("parseCallbackInput", () => {
  it("parses valid callback URL with code and state", () => {
    const result = parseCallbackInput(
      "http://localhost:51122/oauth-callback?code=abc123&state=xyz789"
    );
    expect(result).toEqual({ code: "abc123", state: "xyz789" });
  });

  it("returns error for empty input", () => {
    const result = parseCallbackInput("");
    expect(result).toEqual({ error: "No input provided" });
  });

  it("returns error for whitespace-only input", () => {
    const result = parseCallbackInput("   ");
    expect(result).toEqual({ error: "No input provided" });
  });

  it("returns error when code is missing", () => {
    const result = parseCallbackInput(
      "http://localhost:51122/oauth-callback?state=xyz789"
    );
    expect(result).toEqual({ error: "Missing 'code' parameter in URL" });
  });

  it("returns error when state is missing", () => {
    const result = parseCallbackInput(
      "http://localhost:51122/oauth-callback?code=abc123"
    );
    expect(result).toEqual({ error: "Missing 'state' parameter in URL" });
  });

  it("returns error from OAuth error response", () => {
    const result = parseCallbackInput(
      "http://localhost:51122/oauth-callback?error=access_denied&error_description=User+denied"
    );
    expect(result).toEqual({ error: "User denied" });
  });

  it("returns error for invalid URL", () => {
    const result = parseCallbackInput("not-a-url");
    expect(result).toEqual({
      error: "Paste the full redirect URL (not just the code).",
    });
  });
});
