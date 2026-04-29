# UnrealMCP — Claude ↔ Unreal Engine 5 bridge

UnrealMCP gives Claude Code real-time awareness of, and control over, a running
UE5 editor instance. It is the Unreal counterpart to what tools like Bezi do for
Unity: Claude can read your scene, see what you have selected, create assets,
manipulate Blueprints, edit C++ source files, and trigger compiles — all
through conversation.

The system has two pieces:

- **`UE5Plugin/`** — a UE5 editor plugin that hosts a small JSON HTTP server on
  `localhost:9877`. All editor work happens here, on the game thread.
- **`MCPServer/`** — a Node.js / TypeScript MCP server that Claude Code talks to
  over stdio. It translates each MCP tool call into a request to the plugin.

```
Claude Code  ──stdio──▶  MCPServer (Node)  ──HTTP──▶  UE5Plugin (in-editor)
```

---

## 1. Install the UE5 plugin

1. Copy or symlink `UE5Plugin/` into your project's `Plugins/` directory and
   rename it to `UnrealMCP`:

   ```
   <YourProject>/Plugins/UnrealMCP/
       UnrealMCP.uplugin
       Source/...
   ```

2. Right-click your `.uproject` and choose **Generate Visual Studio project
   files** (Windows) / **Generate Xcode Project** (macOS), or run
   `UnrealBuildTool` to regenerate.
3. Open the project. UE will prompt to compile the new plugin module — accept.
4. Once the editor is running, confirm the bridge is up:

   ```bash
   curl http://127.0.0.1:9877/health
   # → {"success":true,"result":{"status":"ok"},"error":null}
   ```

The plugin loads at `PostEngineInit` and shuts the listener down cleanly on
editor exit (`FCoreDelegates::OnExit`). Tested against UE 5.4. For UE 5.7,
verify `FHttpServerModule` / `HTTPServer` are still present in your engine
build (they shipped stable in 5.1 and have remained so) — if a future engine
release renames the module, update `UnrealMCP.Build.cs`.

### What the plugin exposes

| Endpoint | Purpose |
| --- | --- |
| `GET /scene/actors` | All actors in the active level |
| `POST /scene/spawn` | Spawn an actor by class |
| `POST /scene/delete` | Delete by label/name |
| `POST /scene/set_transform` | Move/rotate/scale an actor |
| `GET /scene/selected` | Currently selected actors |
| `POST /assets/list` | List Content Browser assets at a path |
| `POST /assets/create_blueprint` | Create a Blueprint class |
| `POST /assets/create_material` | Create a blank Material |
| `POST /assets/delete` | Delete an asset by object path |
| `POST /blueprint/add_variable` | Add a member variable |
| `POST /blueprint/add_function` | Add a function graph |
| `POST /blueprint/compile` | Compile + return errors/warnings |
| `POST /blueprint/get_graph` | Dump nodes + connections |
| `POST /code/read` | Read a file under `Source/` |
| `POST /code/write` | Write a file under `Source/` |
| `POST /code/compile` | Trigger Live Coding compile |
| `GET  /project/info` | Engine version, active map, modules |
| `GET  /project/structure` | Source tree |
| `POST /project/log` | Last N lines of output log |
| `GET  /health` | Liveness probe |

All endpoints respond with `{ "success": bool, "result": any, "error": string|null }`.
Editor work is dispatched onto the Game Thread via `AsyncTask(ENamedThreads::GameThread, …)`.

---

## 2. Build and register the MCP server

Requires Node.js 18+.

```bash
cd MCPServer
npm install
npm run build
```

Then add the server to Claude Code's MCP configuration. Open
`~/.config/claude/claude_desktop_config.json` (or the equivalent for your
install) and merge in the snippet from
[`claude_mcp_config.json`](./claude_mcp_config.json), updating the absolute path:

```json
{
  "mcpServers": {
    "unreal": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/UnrealMCP/MCPServer/dist/index.js"],
      "env": {
        "UNREAL_MCP_URL": "http://127.0.0.1:9877"
      }
    }
  }
}
```

For the Claude Code CLI you can also register it with:

```bash
claude mcp add unreal node /ABSOLUTE/PATH/TO/UnrealMCP/MCPServer/dist/index.js
```

Restart Claude Code. The server will only fail loudly when a tool is *called*
without the editor running, so it's safe to keep enabled.

### Environment variables

| Var | Default | Description |
| --- | --- | --- |
| `UNREAL_MCP_URL` | `http://127.0.0.1:9877` | Base URL of the in-editor plugin |
| `UNREAL_MCP_TIMEOUT_MS` | `15000` | Per-request timeout |

---

## 3. The MCP tools Claude can call

Each tool's description was written so Claude can pick it autonomously.

- `get_editor_context` — combined snapshot of selected actors + project info +
  last 50 log lines. Call this first in any session for ambient awareness.
- `scene_list_actors`, `scene_spawn_actor`, `scene_delete_actor`,
  `scene_set_transform`, `scene_get_selected`
- `assets_list`, `search_assets`, `assets_create_blueprint`,
  `assets_create_material`, `assets_delete`
- `blueprint_add_variable`, `blueprint_add_function`, `blueprint_compile`,
  `blueprint_get_graph`
- `code_read`, `code_write`, `code_compile`
- `project_info`, `project_structure`, `project_log`

All tool inputs are validated with Zod; the server is fully strict-mode TS.

---

## 4. Example prompts

Once the editor is running and the MCP server is registered, try:

> "What's currently selected in my UE5 editor? Then describe everything in the
> level."

> "Create a Blueprint called `BP_Patrol` deriving from `Pawn` under
> `/Game/AI/`, add a `float PatrolSpeed` variable defaulting to `300.0`, then
> compile it and tell me if there were errors."

> "Spawn three `PointLight` actors in a triangle around the origin, 500 units
> apart, then list the actors so I can confirm."

> "Read `Source/MyGame/Public/MyCharacter.h`, add a `UFUNCTION(BlueprintCallable)
> void Dash();` declaration, and write the empty implementation in the matching
> .cpp. Then trigger Live Coding."

> "Show me the last 200 lines of the output log and call out any errors."

---

## 5. Caveats

- **Blueprint graph wiring** is the trickiest area. `blueprint_get_graph` and
  `blueprint_add_variable` / `blueprint_add_function` are stable, but `UK2Node`
  pin wiring is intentionally *not* exposed — it's brittle and varies between
  engine versions. If you need to script a specific graph, generate the source
  for a Blueprint Function Library in C++ and have Claude `code_write` that
  instead.
- **Hot reload** via HTTP triggers Live Coding when it's available. If Live
  Coding is disabled in your editor preferences, `code_compile` will report
  that nothing was triggered and you'll need to recompile manually. As a
  fallback, you can have Claude shut down the editor module via
  `FModuleManager::Get().UnloadOrAbandonModuleWithCallback` and relaunch — but
  that's heavier and not recommended for active editing sessions.
- **UE 5.7 module names**: `HTTPServer` has been stable since 5.1. If a future
  engine version renames or restructures it, update the public dependency in
  `UnrealMCP.Build.cs`.
- **Threading**: every editor call is dispatched onto the Game Thread. Never
  add a handler that touches `UObject` state from the HTTP thread.
- **Sandboxing**: `code_read` / `code_write` resolve and clamp paths to within
  the project's `Source/` directory.

---

## License

MIT.
