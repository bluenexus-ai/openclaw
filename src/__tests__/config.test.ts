import { describe, it, expect } from "vitest";
import { parseConfig, getMcpEndpoint, getOAuthWellKnownUrl } from "../config.js";

describe("parseConfig", () => {
  it("returns defaults when given empty object", () => {
    const config = parseConfig({});
    expect(config.serverUrl).toBe("https://api.bluenexus.ai");
    expect(config.clientId).toBe("");
    expect(config.redirectPort).toBe(51122);
  });

  it("returns defaults when given null", () => {
    const config = parseConfig(null);
    expect(config.serverUrl).toBe("https://api.bluenexus.ai");
  });

  it("returns defaults when given undefined", () => {
    const config = parseConfig(undefined);
    expect(config.serverUrl).toBe("https://api.bluenexus.ai");
  });

  it("accepts custom serverUrl", () => {
    const config = parseConfig({ serverUrl: "https://custom.example.com" });
    expect(config.serverUrl).toBe("https://custom.example.com");
  });

  it("accepts custom clientId", () => {
    const config = parseConfig({ clientId: "my-client-id" });
    expect(config.clientId).toBe("my-client-id");
  });

  it("accepts custom redirectPort", () => {
    const config = parseConfig({ redirectPort: 8080 });
    expect(config.redirectPort).toBe(8080);
  });

  it("rejects invalid serverUrl", () => {
    expect(() => parseConfig({ serverUrl: "not-a-url" })).toThrow();
  });

  it("rejects redirectPort below 1024", () => {
    expect(() => parseConfig({ redirectPort: 80 })).toThrow();
  });

  it("rejects redirectPort above 65535", () => {
    expect(() => parseConfig({ redirectPort: 70000 })).toThrow();
  });
});

describe("getMcpEndpoint", () => {
  it("appends /mcp to server URL", () => {
    expect(getMcpEndpoint("https://api.bluenexus.ai")).toBe(
      "https://api.bluenexus.ai/mcp"
    );
  });

  it("strips trailing slash before appending", () => {
    expect(getMcpEndpoint("https://api.bluenexus.ai/")).toBe(
      "https://api.bluenexus.ai/mcp"
    );
  });
});

describe("getOAuthWellKnownUrl", () => {
  it("appends well-known path to server URL", () => {
    expect(getOAuthWellKnownUrl("https://api.bluenexus.ai")).toBe(
      "https://api.bluenexus.ai/.well-known/oauth-authorization-server"
    );
  });

  it("strips trailing slash before appending", () => {
    expect(getOAuthWellKnownUrl("https://api.bluenexus.ai/")).toBe(
      "https://api.bluenexus.ai/.well-known/oauth-authorization-server"
    );
  });
});
