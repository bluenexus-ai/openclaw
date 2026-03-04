import { describe, it, expect } from "vitest";
import { PLUGIN_ID, PLUGIN_NAME, PROVIDER_ID, PROVIDER_ALIASES } from "../constants.js";

describe("constants", () => {
  it("has correct plugin id", () => {
    expect(PLUGIN_ID).toBe("bluenexus");
  });

  it("has correct plugin name", () => {
    expect(PLUGIN_NAME).toBe("BlueNexus");
  });

  it("has correct provider id", () => {
    expect(PROVIDER_ID).toBe("bluenexus");
  });

  it("has provider aliases", () => {
    expect(PROVIDER_ALIASES).toContain("bn");
  });
});
