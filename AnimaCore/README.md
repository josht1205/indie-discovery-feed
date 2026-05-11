# AnimaCore — Auto-Rig Pipeline

3D asset normalization and humanoid auto-rigging for Unity and Unreal Engine.

The pipeline:

1. **Load** — read OBJ / glTF / GLB / PLY / STL via trimesh.
2. **Normalize** — center the mesh on the X/Z plane, sit it on Y=0, scale uniformly so its height equals a target (default 1.8 m).
3. **Decimate** — optional quadric edge-collapse to a polygon budget.
4. **Rig** — build a 23-bone humanoid skeleton positioned inside the mesh's bounding box, compute linear-blend skin weights (4 influences per vertex, inverse-distance falloff, normalized).
5. **Orient** — apply the target engine's axis convention (Y-up / Z-fwd for Unity, Z-up / X-fwd for Unreal).
6. **Export** — write the rigged mesh (GLB / glTF / OBJ / PLY / STL) plus a `.rig.json` sidecar with the full skeleton hierarchy, inverse-bind matrices, and per-vertex skin weights. Any engine can consume the sidecar.

## Project layout

```
AnimaCore/
├── __init__.py              # package
├── mesh_utils.py            # normalization math
├── rig_builder.py           # humanoid skeleton + skin-weight computation
├── normalize_asset.py       # file I/O wrapper for normalization
├── rig_utils.py             # full rig pipeline
├── animacore_cli.py         # command-line interface
├── animacore_gui.py         # PyQt6 desktop GUI
├── default_rig_config.json  # default rig config
├── test_pipeline.py         # smoke test
├── AnimaCore.spec           # PyInstaller spec for GUI
├── AnimaCoreCLI.spec        # PyInstaller spec for CLI
├── build_exe.py             # one-shot build script
├── requirements.txt
└── README.md
```

## Quick start (development)

```bash
# 1. Create env (Python 3.10+ recommended)
conda create -n animacore python=3.11 -y
conda activate animacore

# 2. Install dependencies
pip install -r requirements.txt

# 3. Smoke test
python test_pipeline.py

# 4. Launch the GUI
python animacore_gui.py

# 5. Or use the CLI
python animacore_cli.py rig my_character.obj --output rigged.glb --engine unreal_engine --height 1.8
python animacore_cli.py normalize my_character.obj --output normalized.obj --height 1.8
```

## CLI reference

```
animacore normalize <input> [--output PATH] [--height METRES]
animacore rig       <input> [--output PATH] [--height METRES]
                            [--engine {unity,unreal_engine}]
                            [--config rig_config.json]
```

The CLI exits with non-zero codes on failure (`2` = file not found, `3` = bad input, `1` = unexpected).

## GUI features

- Dark theme, drag-and-drop input, threaded processing (UI never freezes).
- Live progress bar fed by the rigger's stage reports.
- Streaming log panel mirrors all Python logging output, color-coded by severity.
- Mode selector for **Normalize-only** or **Normalize + Rig**.
- Engine, target height, polygon limit, and output format are all editable per-run.
- Results panel shows bone count, vertex / face count, and the resolved output paths.
- "Open output folder when finished" convenience option.

## Building the Windows .exe

PyInstaller is used to produce a one-folder distribution (faster startup than `--onefile`).

```bash
# From inside the AnimaCore folder, with the env activated:
pip install pyinstaller
python build_exe.py            # builds both GUI and CLI
python build_exe.py --gui      # GUI only
python build_exe.py --cli      # CLI only
```

Outputs:
- `dist/AnimaCore/AnimaCore.exe` — the desktop GUI.
- `dist/AnimaCoreCLI/AnimaCoreCLI.exe` — the command-line binary.

Each folder bundles Python, numpy, scipy, trimesh, PyQt6 (GUI only), and all DLLs.
Distribute the entire `dist/AnimaCore/` folder — it is self-contained.

### Notes on the build

- `tensorflow`, `torch`, `matplotlib`, and `tkinter` are explicitly excluded from the bundle — they were listed in the original README but are not used by the pipeline. Dropping them saves ~1.5 GB.
- The default rig config is bundled as a data file; the runtime falls back to an in-code default if it's missing.
- Build on the same Windows version you intend to ship to. PyInstaller does not cross-compile.

## How the rigging works

`rig_builder.py` contains the real implementation:

- `HUMANOID_TEMPLATE` defines 23 bones (UE4 / Mixamo naming) as fractional positions inside the mesh's bounding box. Heights are y-fractions of the mesh height; X / Z offsets are scaled by the mesh's actual width/depth ratio so a narrow asset doesn't get implausibly wide arm spans.
- `build_humanoid_skeleton(vertices, target_engine)` positions every bone, sets parent indices, and computes each bone's inverse-bind matrix (T-pose: identity rotation, translation = bone head).
- `compute_skin_weights(vertices, skeleton, max_influences=4, falloff=2.0)`:
  1. For each bone, build a line segment from head to first-child-head (or a short extrapolation for leaf bones).
  2. Compute every vertex's distance to every bone segment.
  3. Keep the K closest bones per vertex (default 4).
  4. Weight each by `1 / (d + eps)^falloff` and normalize to sum to 1.
- `orientation_matrix(engine)` returns a 4×4 axis-swap matrix; `apply_transform` applies it to vertices and bone positions before export.

## The rig sidecar format

For every rigged mesh `foo.glb` the pipeline writes `foo.rig.json`:

```json
{
  "format": "AnimaCore.rig/1.0",
  "source_mesh": "foo.glb",
  "target_engine": "unreal_engine",
  "orientation_matrix": [[...], [...], [...], [...]],
  "vertex_count": 12345,
  "face_count": 24576,
  "skeleton": {
    "target_engine": "unreal_engine",
    "bone_count": 23,
    "bones": [
      {"name": "Hips", "index": 0, "parent": null, "parent_index": -1,
       "head": [0.0, 0.99, 0.0], "inverse_bind_matrix": [[...], ...]},
      ...
    ]
  },
  "skin": {
    "max_influences": 4,
    "joint_indices": [[0,1,2,16], [0,1,16,2], ...],
    "weights":       [[0.61,0.20,0.12,0.07], ...]
  },
  "config_used": { ... }
}
```

The sidecar is engine-agnostic and is the simplest path for downstream import: a 30-line Unity or Unreal importer can read it and attach a SkinnedMeshRenderer / USkeletalMeshComponent.

## What was removed from the original code

The uploaded source contained several placeholder paths that have been replaced with real implementations:

| Original placeholder                                | Replacement                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `mesh_utils.normalize_mesh` — parses OBJ, no math   | Real centering + uniform scale to target height with bbox computation           |
| `rig_utils.rig_asset` — launches external Blender   | Native Python: humanoid skeleton + linear-blend skin weights + glTF/OBJ export  |
| `animacore_cli.rig_asset_placeholder` — fakes file  | Removed; CLI calls the real `rig_asset`                                         |
| `"ANIMACORE-USER-"` API key prefix check            | Removed; auth was never connected to anything                                   |
| GUI "Simulated security fail" success branch        | Removed; pipeline either succeeds or surfaces the real error                    |
| 3 incompatible `normalize_mesh` call signatures     | Single signature: `(dict, target_height=) -> dict`                              |
| Nested `AnimaCore/AnimaCore/` package layout        | Flat single-package layout, importable from source or PyInstaller bundle        |
| `tensorflow` listed as dependency                   | Removed; never imported, never used                                             |
| GUI passes `--config` flag CLI doesn't accept       | GUI writes a temp config and CLI accepts `--config`                             |
| `shell=True` subprocess with quoted paths           | GUI calls Python functions directly in a worker thread — no subprocess          |

## Assumptions made

- Source meshes are Y-up, Z-forward, right-handed (standard for OBJ / glTF). The orientation matrices map from that convention to each target engine.
- "Auto-rig" means a procedural humanoid skeleton sized to the mesh, not a learned pose-detector. A real ML rigger is out of scope for an offline desktop tool of this size, and the original code only stubbed it anyway.
- Sidecar JSON is preferred over embedding skin data in glTF because trimesh's glTF writer does not currently support skinning. A future version could swap to pygltflib.
- Tested on Python 3.11 + numpy 2.x + trimesh 4.x. Should also work on Python 3.9 – 3.13.
