import { z } from "zod";
import { defineTool, type ToolRegistrar } from "../types.js";
import { getClient } from "../ue5client.js";

export const assetTools: ToolRegistrar[] = [
  defineTool({
    name: "assets_list",
    description:
      "List assets under a Content Browser path (e.g. '/Game' or '/Game/Blueprints'). Returns asset names, classes, and object paths.",
    inputSchema: {
      path: z
        .string()
        .default("/Game")
        .describe("Content browser path. '/Game' is the project's Content/ root."),
      recursive: z.boolean().default(false),
    },
    handler: async (args) => getClient().post("/assets/list", args),
  }),

  defineTool({
    name: "search_assets",
    description:
      "Search for assets by name (case-insensitive substring) under a content path. Combines `assets_list` with a recursive walk and a name filter — prefer this when you don't know the exact asset path.",
    inputSchema: {
      filter: z
        .string()
        .describe("Case-insensitive substring to match against asset names"),
      path: z.string().default("/Game"),
      recursive: z.boolean().default(true),
    },
    handler: async (args) =>
      getClient().post("/assets/list", {
        path: args.path,
        recursive: args.recursive,
        filter: args.filter,
      }),
  }),

  defineTool({
    name: "assets_create_blueprint",
    description:
      "Create a new Blueprint class asset. `parent_class` defaults to AActor; pass e.g. 'Pawn', 'Character', 'ActorComponent' or a full class path to derive from something else.",
    inputSchema: {
      name: z.string(),
      parent_class: z.string().default("Actor"),
      path: z.string().default("/Game/Blueprints"),
    },
    handler: async (args) => getClient().post("/assets/create_blueprint", args),
  }),

  defineTool({
    name: "assets_create_material",
    description: "Create a blank Material asset at the given content path.",
    inputSchema: {
      name: z.string(),
      path: z.string().default("/Game/Materials"),
    },
    handler: async (args) => getClient().post("/assets/create_material", args),
  }),

  defineTool({
    name: "assets_delete",
    description:
      "Delete an asset by its full object path (e.g. '/Game/Blueprints/BP_Foo.BP_Foo').",
    inputSchema: {
      asset_path: z.string(),
    },
    handler: async (args) => getClient().post("/assets/delete", args),
  }),
];
