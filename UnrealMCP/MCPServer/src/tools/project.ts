import { z } from "zod";
import { defineTool, type ToolRegistrar } from "../types.js";
import { getClient } from "../ue5client.js";

export const projectTools: ToolRegistrar[] = [
  defineTool({
    name: "project_info",
    description:
      "Return high-level project metadata: project name, engine version, currently active map, and all loaded engine + game modules.",
    inputSchema: {},
    handler: async () => getClient().get("/project/info"),
  }),

  defineTool({
    name: "project_structure",
    description:
      "Return the project's Source/ directory tree as a flat list of relative file paths (.h and .cpp). Use this to understand the C++ side of the project before reading or editing files.",
    inputSchema: {},
    handler: async () => getClient().get("/project/structure"),
  }),

  defineTool({
    name: "project_log",
    description:
      "Return the most recent N lines of the editor's Output Log. Use this to diagnose runtime issues, see compile output, or follow up after triggering an action.",
    inputSchema: {
      lines: z.number().int().min(1).max(2000).default(100),
    },
    handler: async (args) => getClient().post("/project/log", args),
  }),

  defineTool({
    name: "get_editor_context",
    description:
      "Single-shot snapshot of the editor's current state — selected actors, project info (engine version, active map, loaded modules), and the last 50 lines of the output log. Call this at the START of any agentic session so you have ambient awareness of what the user is currently working on, then use the more specific tools as needed. This is the closest thing to 'looking over the user's shoulder' inside their editor.",
    inputSchema: {},
    handler: async () => {
      const client = getClient();
      const [selected, info, log] = await Promise.all([
        client.get("/scene/selected").catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        })),
        client.get("/project/info").catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        })),
        client.post("/project/log", { lines: 50 }).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        })),
      ]);
      return { selected, project: info, recent_log: log };
    },
  }),
];
