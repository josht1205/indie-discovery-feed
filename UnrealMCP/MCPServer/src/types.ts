import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolHandler<S extends z.ZodRawShape> = (
  args: { [K in keyof S]: z.infer<S[K]> },
) => Promise<unknown> | unknown;

export interface ToolDef<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  inputSchema: S;
  handler: ToolHandler<S>;
}

export type ToolRegistrar = (server: McpServer) => void;

/**
 * Convert any handler return value into a CallToolResult.
 */
function toToolResult(value: unknown, isError = false) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    isError,
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Returns a function that registers a tool on the given McpServer using the
 * recommended `registerTool` API (the older `tool()` overloads are deprecated).
 */
export function defineTool<S extends z.ZodRawShape>(
  def: ToolDef<S>,
): ToolRegistrar {
  return (server: McpServer) => {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
      },
      // The SDK types resolve `args` based on the Zod shape; cast at the boundary
      // because our generic ToolHandler maps the shape one extra layer.
      (async (args: { [K in keyof S]: z.infer<S[K]> }) => {
        try {
          const result = await def.handler(args);
          return toToolResult(result, false);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return toToolResult(`Error: ${message}`, true);
        }
      }) as Parameters<typeof server.registerTool>[2],
    );
  };
}
