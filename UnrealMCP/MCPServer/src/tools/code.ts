import { z } from "zod";
import { defineTool, type ToolRegistrar } from "../types.js";
import { getClient } from "../ue5client.js";

export const codeTools: ToolRegistrar[] = [
  defineTool({
    name: "code_read",
    description:
      "Read a C++ source file from the project's Source/ directory. Path is relative to Source/ (e.g. 'MyGame/Public/MyActor.h'). The plugin sandboxes reads to within Source/.",
    inputSchema: {
      relative_path: z.string(),
    },
    handler: async (args) => getClient().post("/code/read", args),
  }),

  defineTool({
    name: "code_write",
    description:
      "Write or overwrite a C++ source file under Source/. Use this to add new classes, edit existing ones, or stage code that will be picked up by the next compile. Path is relative to Source/.",
    inputSchema: {
      relative_path: z.string(),
      content: z.string(),
    },
    handler: async (args) => getClient().post("/code/write", args),
  }),

  defineTool({
    name: "code_compile",
    description:
      "Trigger a Live Coding compile for the project's C++ modules. Returns whether a compile was triggered. Live Coding must be enabled in the editor for this to do anything; otherwise the user needs to recompile manually.",
    inputSchema: {},
    handler: async () => getClient().post("/code/compile", {}),
  }),
];
