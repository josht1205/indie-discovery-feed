# Blueprint / AnimBP / Enhanced Input Integration

This is the wiring layer. The C++ module in `Source/ParkourSystem/` is engine
code; the assets below live in your project content and connect that engine
code to GASP's animation graph and the Enhanced Input system.

---

## 1. Enhanced Input

### Input Actions to create

`Content/Input/Actions/`

| Asset            | Value Type | Notes                                  |
|------------------|------------|----------------------------------------|
| `IA_Move`        | Axis2D     | GASP already ships this — reuse.       |
| `IA_Look`        | Axis2D     | GASP already ships this — reuse.       |
| `IA_Jump`        | Digital    | GASP already ships this — reuse.       |
| `IA_Sprint`      | Digital    | GASP already ships this — reuse.       |
| `IA_Crouch`      | Digital    | GASP already ships this — reuse.       |
| `IA_Mantle`      | Digital    | New. Bind to Spacebar (double-tap) or to a separate key like `Q`. |

### Input Mapping Context

Create `IMC_Parkour` (`Content/Input/IMC_Parkour`). Add it to the player
controller via `EnhancedInputLocalPlayerSubsystem::AddMappingContext` with
priority above the default GASP context (so `IA_Mantle` doesn't get masked).

### Action handlers

Hook the actions on the GASP character BP (or a thin BP subclass of it). The
component exposes BlueprintCallable entry points for each intent — handlers
should be one node deep:

| Action              | Triggered    | Call on `MoverParkourComponent`         |
|---------------------|--------------|------------------------------------------|
| `IA_Jump`           | Started      | `RequestJump()`                          |
| `IA_Jump`           | Completed    | `ReleaseJump()`                          |
| `IA_Sprint`         | Started      | `SetSprintHeld(true)`                    |
| `IA_Sprint`         | Completed    | `SetSprintHeld(false)`                   |
| `IA_Crouch`         | Started      | `SetCrouchHeld(true)`                    |
| `IA_Crouch`         | Completed    | `SetCrouchHeld(false)`                   |
| `IA_Mantle`         | Started      | `RequestMantle()`                        |

`IA_Move` and `IA_Look` continue to feed GASP's existing pipeline — the
parkour component reads input via Mover's input cmd, not directly from these
actions.

---

## 2. Animation Blueprint

The GASP `ABP_SandboxCharacter` (or whatever the 5.7 GASP variant calls it)
needs three small additions. None of these touch motion matching or the
chooser tables; they sit in the *override* layer GASP already uses.

### a. Cache the parkour component

In the AnimBP's `BlueprintUpdateAnimation` (or thread-safe `Update Animation`
function):

1. Get the owning pawn.
2. `Get Component By Class → MoverParkourComponent`.
3. Save into a transient AnimBP variable `ParkourComp`.

### b. Read the state tag

Each frame, set an AnimBP variable `ParkourState` (`FGameplayTag`) from
`ParkourComp.GetParkourState()`. Add a parallel `bIsWallRunning` /
`bIsHanging` cached bool for fast state-machine transitions.

### c. State machine branches

Inside the existing GASP locomotion state machine, add three states:

- **WallRun**: entered when `bIsWallRunning == true`. Transitions:
  - Out → ground locomotion when `bIsWallRunning == false`.
  - Plays a wall-run pose blendspace; `Side` (-1/+1) drives mirror.
- **LedgeHang**: entered when `bIsHanging == true`. Transitions:
  - Out → ground locomotion on `bIsHanging == false`.
  - Inside the state, route shimmy axis (read from `MoverParkourComponent`)
    into a 1D blendspace.
- **Mantle**: entered when `ParkourState` matches any
  `Parkour.State.Mantle.*` tag. Plays the corresponding montage from
  `UParkourParameters` (Vault / PullUp / Mount).

### d. Chooser hook (optional)

If your project uses the GASP chooser tables, add a `ParkourState` tag input
column to the chooser asset and let the existing chooser fall through to
default GASP rows when the tag is unset. This keeps motion matching active
during normal locomotion and only overrides during parkour states.

---

## 3. Motion Warping (mantle alignment)

The mantle layered move drives the capsule along an eased path; Motion
Warping aligns the visual mesh to the same target. Setup:

1. Add a `MotionWarpingComponent` to the GASP character (sibling to
   `MoverComponent`).
2. Author the mantle montages with a **Motion Warping** notify state across
   the foot-plant section. Set the warp target name to match
   `UParkourParameters::MantleWarpTargetName` (default `MantleTarget`).
3. From C++ or BP, add the warp target on mantle entry:
   ```cpp
   FMotionWarpingTarget Target;
   Target.Name     = Parameters->MantleWarpTargetName;
   Target.Location = MantleHit.LandLocation;
   Target.Rotation = (-MantleHit.WallNormal).Rotation();
   MotionWarpingComp->AddOrUpdateWarpTarget(Target);
   ```
   The cleanest place to hook this is in a BP listener bound to
   `OnParkourStateChanged` — when the new tag matches a mantle tag, push the
   warp target.

---

## 4. Hand IK (recommended, project-specific)

GASP exposes a Control Rig for the upper body. For wall-run and ledge-hang
the cleanest approach is:

- Wall-run: per-frame, raycast from each hand bone toward `WallNormal` and
  feed the hit to a Two-Bone IK on the AnimBP. Drive blend weight by the
  `bIsWallRunning` cached bool.
- Ledge-hang: place hand IK targets at `LedgeLocation ± WallTangent * shoulderWidth`
  and lerp full-on while `bIsHanging` is true.

Specific bone names depend on the GASP skeleton you ship; once the project is
chosen they should be plumbed through a `Parkour_HandIK_Config` data asset
(not included in the scaffold — add per-project).

---

## 5. UI / Audio hooks

`UMoverParkourComponent::OnParkourStateChanged` is a multicast delegate
broadcasting the new state tag. Bind to it in:

- HUD widget — for parkour-state debug overlays.
- Audio component — for wall-touch / shimmy / mantle one-shots.
- Camera shake or post-process tween — for cinematic accents.

This keeps presentation concerns out of the movement layer.
