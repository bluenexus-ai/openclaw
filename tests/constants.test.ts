import { describe, it, expect } from "vitest";
import { PLUGIN_ID, PLUGIN_NAME, PROVIDER_ID, PROVIDER_ALIASES } from "../src/constants.js";

describe("constants", () => {
  it("has correct plugin id", () => {
    expect(PLUGIN_ID).toBe("bluenexus-openclaw-plugin");
  });

  it("has correct plugin name", () => {
    expect(PLUGIN_NAME).toBe("BlueNexus");
  });

  it("has correct provider id", () => {
    expect(PROVIDER_ID).toBe("bluenexus-openclaw-plugin");
  });

  it("has provider aliases including bluenexus and bn", () => {
    expect(PROVIDER_ALIASES).toContain("bluenexus");
    expect(PROVIDER_ALIASES).toContain("bn");
  });
});
