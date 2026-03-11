import { describe, expect, it, vi } from "vitest"
import blueNexusPlugin from "../index.js"
import type {
  PluginApi,
  ProviderRegistration,
  ToolRegistration,
} from "../openclaw-types.js"

// Mock credential loading so tests don't depend on local filesystem state
vi.mock("../credentials.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../credentials.js")>()
  return {
    ...actual,
    loadCredentialFromAuthProfiles: vi.fn().mockResolvedValue(undefined),
  }
})

function createMockApi(): PluginApi & {
  providers: ProviderRegistration[]
  tools: ToolRegistration[]
} {
  const providers: ProviderRegistration[] = []
  const tools: ToolRegistration[] = []

  return {
    pluginConfig: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registerProvider: (provider) => {
      providers.push(provider)
    },
    registerTool: (tool) => {
      tools.push(tool)
    },
    providers,
    tools,
  }
}

describe("blueNexusPlugin", () => {
  it("has correct id", () => {
    expect(blueNexusPlugin.id).toBe("bluenexus-openclaw-plugin")
  })

  it("has correct name", () => {
    expect(blueNexusPlugin.name).toBe("BlueNexus")
  })

  it("has a description", () => {
    expect(blueNexusPlugin.description).toBeDefined()
    expect(blueNexusPlugin.description.length).toBeGreaterThan(0)
  })

  it("has a config schema with parse and uiHints", () => {
    expect(blueNexusPlugin.configSchema).toBeDefined()
    expect(blueNexusPlugin.configSchema.parse).toBeInstanceOf(Function)
    expect(blueNexusPlugin.configSchema.uiHints).toBeDefined()
  })

  describe("register", () => {
    it("registers one OAuth provider", () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      expect(api.providers).toHaveLength(1)
      expect(api.providers[0].id).toBe("bluenexus-openclaw-plugin")
      expect(api.providers[0].label).toBe("BlueNexus")
      expect(api.providers[0].aliases).toContain("bluenexus")
      expect(api.providers[0].aliases).toContain("bn")
    })

    it("registers two tools", () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      expect(api.tools).toHaveLength(2)
      const toolNames = api.tools.map((t) => t.name)
      expect(toolNames).toContain("list-connections")
      expect(toolNames).toContain("use-agent")
    })

    it("registered provider has OAuth auth method", () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      const provider = api.providers[0]
      expect(provider.auth).toHaveLength(1)
      expect(provider.auth[0].kind).toBe("oauth")
      expect(provider.auth[0].id).toBe("oauth")
    })

    it("registered provider has refreshOAuth", () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      expect(api.providers[0].refreshOAuth).toBeInstanceOf(Function)
    })

    it("logs registration message", () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      expect(api.logger.info).toHaveBeenCalledWith(
        "BlueNexus plugin registered"
      )
    })

    it("list-connections tool returns auth error when not authenticated", async () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      const listConnections = api.tools.find(
        (t) => t.name === "list-connections"
      )
      expect(listConnections).toBeDefined()

      const result = await listConnections?.execute("test-call-id", {}, {})
      expect(result.content[0].text).toContain("Not authenticated")
    })

    it("use-agent tool returns auth error when not authenticated", async () => {
      const api = createMockApi()
      blueNexusPlugin.register(api)

      const useAgent = api.tools.find((t) => t.name === "use-agent")
      expect(useAgent).toBeDefined()

      const result = await useAgent?.execute(
        "test-call-id",
        { prompt: "test" },
        {}
      )
      expect(result.content[0].text).toContain("Not authenticated")
    })
  })
})
