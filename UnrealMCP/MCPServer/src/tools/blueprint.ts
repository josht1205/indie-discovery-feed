import { z } from "zod";
import { defineTool, type ToolRegistrar } from "../types.js";
import { getClient } from "../ue5client.js";

export const blueprintTools: ToolRegistrar[] = [
  defineTool({
    name: "blueprint_add_variable",
    description:
      "Add a member variable to a Blueprint. `type` accepts simple names: bool, int, float, string, name, text, vector, rotator, transform, or any UClass name for an object reference.",
    inputSchema: {
      blueprint_path: z
        .string()
        .describe("Object path of the Blueprint, e.g. '/Game/BP_Foo.BP_Foo'"),
      name: z.string(),
      type: z.string().default("float"),
      default_value: z.string().optional().default(""),
    },
    handler: async (args) => getClient().post("/blueprint/add_variable", args),
  }),

  defineTool({
    name: "blueprint_add_function",
    description:
      "Add a new (empty) user-defined function graph to a Blueprint. Returns the created function name.",
    inputSchema: {
      blueprint_path: z.string(),
      function_name: z.string(),
    },
    handler: async (args) => getClient().post("/blueprint/add_function", args),
  }),

  defineTool({
    name: "blueprint_compile",
    description:
      "Compile a Blueprint and return any errors and warnings emitted by the compiler.",
    inputSchema: {
      blueprint_path: z.string(),
    },
    handler: async (args) => getClient().post("/blueprint/compile", args),
  }),

  defineTool({
    name: "blueprint_get_graph",
    description:
      "Return all graphs of a Blueprint as JSON: nodes (with class, title, position, pins) and the connections between output pins and downstream input pins. Useful for inspecting Blueprint logic.",
    inputSchema: {
      blueprint_path: z.string(),
    },
    handler: async (args) => getClient().post("/blueprint/get_graph", args),
  }),
];
