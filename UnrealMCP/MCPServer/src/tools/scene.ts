import { z } from "zod";
import { defineTool, type ToolRegistrar } from "../types.js";
import { getClient } from "../ue5client.js";

const Vec3 = z
  .array(z.number())
  .length(3)
  .describe("[x, y, z] for vectors, [pitch, yaw, roll] for rotators");

export const sceneTools: ToolRegistrar[] = [
  defineTool({
    name: "scene_list_actors",
    description:
      "List every actor in the currently loaded UE5 editor level. Returns each actor's display label, internal name, class, transform, and tags. Use this to understand what's in the scene before making changes.",
    inputSchema: {},
    handler: async () => getClient().get("/scene/actors"),
  }),

  defineTool({
    name: "scene_spawn_actor",
    description:
      "Spawn a new actor in the current editor level. `class` may be a short class name (e.g. 'StaticMeshActor', 'PointLight') or a full class path. Returns the spawned actor.",
    inputSchema: {
      class: z.string().describe("Actor class name or full class path"),
      name: z
        .string()
        .optional()
        .describe("Optional display label for the new actor"),
      location: Vec3.optional().default([0, 0, 0]),
      rotation: Vec3.optional().default([0, 0, 0]),
      scale: Vec3.optional().default([1, 1, 1]),
    },
    handler: async (args) =>
      getClient().post("/scene/spawn", {
        class: args.class,
        name: args.name,
        location: args.location,
        rotation: args.rotation,
        scale: args.scale,
      }),
  }),

  defineTool({
    name: "scene_delete_actor",
    description:
      "Delete an actor from the editor level by display label or internal name.",
    inputSchema: {
      name: z.string().describe("Actor label or internal name"),
    },
    handler: async (args) => getClient().post("/scene/delete", args),
  }),

  defineTool({
    name: "scene_set_transform",
    description:
      "Update an actor's location, rotation, and/or scale. Any field omitted is left unchanged.",
    inputSchema: {
      name: z.string().describe("Actor label or internal name"),
      location: Vec3.optional(),
      rotation: Vec3.optional(),
      scale: Vec3.optional(),
    },
    handler: async (args) => getClient().post("/scene/set_transform", args),
  }),

  defineTool({
    name: "scene_get_selected",
    description:
      "Return the actor(s) currently selected in the editor viewport. Useful for understanding what the user is currently looking at or working on.",
    inputSchema: {},
    handler: async () => getClient().get("/scene/selected"),
  }),
];
