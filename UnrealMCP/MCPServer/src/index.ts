#!/usr/bin/env node
/**
 * UnrealMCP — MCP server bridging Claude Code to a running UE5 editor.
 *
 * This process speaks MCP over stdio (Claude Code transport) and forwards each
 * tool call to the UnrealMCP plugin's HTTP server (default http://127.0.0.1:9877).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { sceneTools } from "./tools/scene.js";
import { assetTools } from "./tools/assets.js";
import { blueprintTools } from "./tools/blueprint.js";
import { codeTools } from "./tools/code.js";
import { projectTools } from "./tools/project.js";
import type { ToolRegistrar } from "./types.js";

const SERVER_NAME = "unreal-mcp";
const SERVER_VERSION = "0.1.0";

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const allTools: ToolRegistrar[] = [
    ...projectTools, // get_editor_context first so it shows up early in tool lists
    ...sceneTools,
    ...assetTools,
    ...blueprintTools,
    ...codeTools,
  ];
  for (const register of allTools) register(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Helpful diagnostic on stderr — stdout is reserved for MCP protocol traffic.
  process.stderr.write(
    `[${SERVER_NAME}] connected over stdio (target: ${process.env.UNREAL_MCP_URL ?? "http://127.0.0.1:9877"})\n`,
  );
}

main().catch((err) => {
  process.stderr.write(
    `[${SERVER_NAME}] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
