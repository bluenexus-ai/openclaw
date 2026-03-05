/**
 * Types from the OpenClaw plugin API
 *
 * These types describe the API surface that OpenClaw provides to plugins
 * when they register providers and tools.
 */

import type { BlueNexusCredential } from "./types.js";

export type PluginLogger = {
  info?: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type OAuthRunContext = {
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
  prompter: {
    text: (opts: { message: string }) => Promise<string | symbol>;
    note: (message: string, title?: string) => Promise<void>;
    progress: (msg: string) => {
      update: (msg: string) => void;
      stop: (msg?: string) => void;
    };
  };
  runtime: { log: (msg: string) => void };
};

export type OAuthAuthMethod = {
  id: string;
  label: string;
  hint?: string;
  kind: "oauth";
  run: (ctx: OAuthRunContext) => Promise<{
    profiles: Array<{
      profileId: string;
      credential: BlueNexusCredential;
    }>;
    notes?: string[];
  }>;
};

export type ProviderRegistration = {
  id: string;
  label: string;
  docsPath?: string;
  aliases?: string[];
  auth: OAuthAuthMethod[];
  refreshOAuth?: (credential: BlueNexusCredential) => Promise<BlueNexusCredential>;
};

export type ToolResult = {
  content: Array<{ type: string; text: string }>;
  details?: unknown;
};

export type ToolRegistration = {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: unknown,
    ctx: unknown,
  ) => Promise<ToolResult>;
};

export type PluginApi = {
  pluginConfig: unknown;
  logger: PluginLogger;
  registerProvider: (provider: ProviderRegistration) => void;
  registerTool: (tool: ToolRegistration) => void;
};
