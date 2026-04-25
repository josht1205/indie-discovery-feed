# Parkour System Scaffold (UE 5.7 / GASP / Mover 2.0)

> **This is a scaffold, not a finished AAA system.** It targets UE 5.7 + the
> Game Animation Sample Project (GASP) + the Mover 2.0 plugin. The structural
> design (component, layered moves, data asset, traces, gameplay tags) is
> engine-version-agnostic. The exact Mover symbol names and override
> signatures are version-sensitive — every spot that touches Mover internals
> is marked with an `API BINDING POINT` comment in the .cpp. Plan to spend
> ~30–60 min wiring those seams against your installed engine before the
> module compiles end-to-end.

This folder is intentionally isolated from the surrounding repository — it is
not part of the React app at the repo root and contains no JS/TS code. To use
it, copy `Source/ParkourSystem/` into a real UE 5.7 project's `Source/`
directory.

---

## Folder layout

```
unreal-parkour-scaffold/
├── README.md                                    (this file)
├── Source/ParkourSystem/
│   ├── ParkourSystem.Build.cs                   module deps
│   ├── Public/
│   │   ├── ParkourSystem.h                      module interface
│   │   ├── ParkourTypes.h                       FWallRunHit / FLedgeHit / FMantleHit / tags
│   │   ├── ParkourParameters.h                  UPrimaryDataAsset of all designer values
│   │   ├── MoverParkourComponent.h              sidecar component
│   │   ├── LayeredMove_WallRun.h
│   │   ├── LayeredMove_LedgeHang.h
│   │   └── LayeredMove_Mantle.h
│   └── Private/
│       └── (matching .cpp files)
└── Docs/
    └── BlueprintIntegration.md                  ABP / IMC / motion-warping setup
```

---

## Setup

1. **Create a UE 5.7 project from the GASP sample.**
   - Epic Games Launcher → Samples → *Game Animation Sample* → Create Project.
2. **Enable plugins** in the project's `.uproject`:
   - `Mover` (experimental)
   - `EnhancedInput`
   - `MotionWarping`
   - `GameplayTags` (built-in)
3. **Drop in this module.** Copy `Source/ParkourSystem/` into your project's
   `Source/` directory.
4. **Edit `<YourProject>.uproject`** so the `Modules` array includes:
   ```json
   { "Name": "ParkourSystem", "Type": "Runtime", "LoadingPhase": "Default" }
   ```
5. **Right-click `.uproject` → Generate Project Files**, then build the editor target.
6. **Resolve API binding seams.** Open the .cpp files and search for
   `API BINDING POINT`. There are four:
   - `MoverParkourComponent.cpp` — `EnqueueLayeredMove`
   - `MoverParkourComponent.cpp` — `IsGrounded`
   - `LayeredMove_WallRun.cpp` — sync state read inside `GenerateMove`
   - `LayeredMove_LedgeHang.cpp` — input cmd read inside `GenerateMove`
   Each has a comment listing the candidate accessor names; pick the one
   exported by your installed Mover module and delete the others.
7. **Author a `UParkourParameters` data asset** in-editor:
   `Content Browser → Add → Miscellaneous → Data Asset → ParkourParameters`.
   Tune values per the comments in `ParkourParameters.h`.
8. **Add the component to the GASP character.** Open `BP_SandboxCharacter` (or
   the GASP Mover-based character your project ships with), Add Component →
   `MoverParkourComponent`. Assign the data asset you just created to the
   `Parameters` slot.
9. **Wire Enhanced Input** (see `Docs/BlueprintIntegration.md`).

---

## What's verified vs. what to validate

| Layer                                     | Status                                                          |
|-------------------------------------------|-----------------------------------------------------------------|
| Component lifecycle, traces, math, tags   | Engine-version-agnostic; should compile cleanly.                |
| Trace-based detection (wall/ledge/mantle) | Pure `LineTraceSingleByChannel` — stable API.                   |
| Layered-move math (wall-run, ledge, mantle ease) | Pure math; not engine-specific.                          |
| `FLayeredMoveBase` override signatures    | Likely-correct for UE 5.7 Mover 2.0; **verify against installed engine.** |
| `FMoverDefaultSyncState` accessors        | Names have shifted between Mover versions; binding seam.        |
| `FCharacterDefaultInputs` field names     | Same — verify or swap to your project's input struct.           |
| Layered-move queueing entry point         | Binding seam — see `EnqueueLayeredMove`.                        |
| Replication                               | Mover handles client prediction; the scaffold only adds `NetSerialize` for the layered-move payload. **No `DOREPLIFETIME` is appropriate on the component.** |

If a seam cannot be resolved, the fallback path in `EnqueueLayeredMove` uses
a UFunction lookup via `ProcessEvent` so the module still links and you get
a clear runtime warning instead of a build failure.

---

## Replication notes

- Mover 2.0 owns the prediction pipeline. Per-frame movement state belongs
  inside `FMoverDefaultSyncState` (or a custom sync-state extension), not on
  `UActorComponent` properties.
- This scaffold deliberately does **not** declare any `UPROPERTY(Replicated)`
  on `UMoverParkourComponent`. The fields it holds (cooldown anchors, input
  intent flags) are local-only and are regenerated when the simulation rolls
  back.
- Layered-move structs implement `NetSerialize`. Add fields to it any time
  you add a new state field that needs to survive prediction replay.

---

## Performance notes

- Detection runs in `TG_PostPhysics` and only when no parkour state is
  active. While a layered move owns the frame, no traces fire.
- Three line traces per frame in the worst case (wall L, wall R, ledge
  forward). All use `bTraceComplex=false` and a single owning-actor ignore.
- The mantle motion uses a discrete-derivative velocity rather than direct
  position authority, so it composes cleanly with Mover's collision/penetration
  resolution instead of fighting it.
- No GC allocations per frame; the layered-move structs are constructed on
  state entry and held by Mover's collection.

---

## Testing gym

Build a small map containing:

1. **Wall-run lane.** Two parallel walls 250 cm apart, each 600 cm long, one
   side painted with a project material. Sprint → jump diagonally → wall-run.
2. **Wall-run zigzag.** Four staggered short walls so the player must wall-jump
   from one to the next.
3. **Ledge gallery.** A pair of ledges 110 cm, 180 cm, and 240 cm above
   ground (around `LedgeMinHeight`/`MaxHeight` boundaries).
4. **Mantle/vault gauntlet.** Crates 80, 100, 120, 180, 220 cm tall and
   60, 90, 120 cm deep — exercises every `FMantleHit` classification branch.
5. **Slope slide ramp.** 20°, 28°, 35°, 45° ramps to verify the
   `SlideMinSlopeAngle` threshold.
6. **Net-test variant.** Same map with a `Listen Server + 1 Client` PIE
   config to verify rollback. Toggle `parkour.DebugDraw 1` to visualize.

---

## Console aids

| CVar                  | Effect                                           |
|-----------------------|--------------------------------------------------|
| `parkour.DebugDraw 1` | Draws the wall/ledge/mantle traces inline.       |

---

## What this scaffold deliberately omits

- Hand IK on wall-run / ledge hang (project-specific bone names).
- Stamina / fall-damage gameplay rules (gameplay-systems territory).
- Specific GASP chooser-table edits (varies by GASP minor version; see
  `Docs/BlueprintIntegration.md` for the integration points).
- Animation montages — fields exist on `UParkourParameters`; you assign your
  own.

If you need any of those filled in, point me at the actual UE project and I'll
extend against the real AnimBP/chooser assets.
