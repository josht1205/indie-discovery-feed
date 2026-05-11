"""
AnimaCore.blender_convert

Headless Blender bridge — converts any common 3D format that trimesh can't
load natively (.fbx, .blend, .dae, .3ds, .x3d, .abc, .usd*) into a .glb that
trimesh can then process.

Blender is auto-detected from:
    1. The ``ANIMACORE_BLENDER`` environment variable (full path to blender.exe)
    2. Standard Windows install path ``C:/Program Files/Blender Foundation/Blender*``
    3. Steam install path ``C:/Program Files (x86)/Steam/steamapps/common/Blender``
    4. ``shutil.which("blender")`` (PATH lookup — works on macOS / Linux too)

If none of those resolve, :class:`BlenderNotFoundError` is raised with a
human-readable hint telling the user where to install Blender.
"""

from __future__ import annotations

import glob
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from typing import List, Optional

log = logging.getLogger(__name__)


# Extensions that need to be routed through Blender for conversion to .glb.
# .obj, .gltf, .glb, .ply, .stl are NOT in here — trimesh handles them natively.
BLENDER_FORMATS = {
    ".fbx", ".blend", ".dae", ".3ds", ".x3d", ".abc",
    ".usd", ".usda", ".usdc", ".usdz",
}

# All formats the GUI/CLI will offer to the user.
SUPPORTED_FORMATS = {
    ".obj", ".gltf", ".glb", ".ply", ".stl",
} | BLENDER_FORMATS


class BlenderNotFoundError(RuntimeError):
    """Raised when no Blender installation could be located."""


class BlenderConversionError(RuntimeError):
    """Raised when Blender ran but failed to convert the file."""


def needs_blender(path: str) -> bool:
    """Return True if ``path``'s extension requires the Blender pipeline."""
    return os.path.splitext(path)[1].lower() in BLENDER_FORMATS


def find_blender() -> Optional[str]:
    """Locate a Blender executable. Returns its absolute path or None."""
    env = os.environ.get("ANIMACORE_BLENDER")
    if env and os.path.isfile(env):
        log.debug("Using Blender from ANIMACORE_BLENDER: %s", env)
        return env

    candidates: List[str] = []
    if sys.platform.startswith("win"):
        patterns = [
            r"C:\Program Files\Blender Foundation\Blender*\blender.exe",
            r"C:\Program Files (x86)\Blender Foundation\Blender*\blender.exe",
            r"C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe",
            r"D:\Program Files\Blender Foundation\Blender*\blender.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Blender Foundation\Blender*\blender.exe"),
        ]
        for pat in patterns:
            candidates.extend(glob.glob(pat))
    elif sys.platform == "darwin":
        candidates.extend(glob.glob("/Applications/Blender.app/Contents/MacOS/Blender"))
        candidates.extend(glob.glob("/Applications/Blender*/Blender.app/Contents/MacOS/Blender"))
    else:
        candidates.extend(glob.glob("/usr/bin/blender"))
        candidates.extend(glob.glob("/usr/local/bin/blender"))
        candidates.extend(glob.glob("/snap/bin/blender"))
        candidates.extend(glob.glob("/opt/blender*/blender"))

    # Sort so the highest version-number directory wins.
    candidates = sorted({c for c in candidates if os.path.isfile(c)}, reverse=True)
    if candidates:
        log.debug("Auto-detected Blender: %s", candidates[0])
        return candidates[0]

    which = shutil.which("blender")
    if which:
        log.debug("Blender found on PATH: %s", which)
        return which
    return None


def require_blender() -> str:
    """Return Blender path or raise :class:`BlenderNotFoundError`."""
    path = find_blender()
    if not path:
        raise BlenderNotFoundError(
            "Blender executable not found. AnimaCore needs Blender to import "
            ".fbx, .blend, .dae, .3ds, .x3d, .abc, and .usd* files.\n\n"
            "Install Blender from https://www.blender.org/download/ "
            "(default install path is auto-detected), or set the "
            "ANIMACORE_BLENDER environment variable to the full path of "
            "blender.exe."
        )
    return path


# ---------------------------------------------------------------------------
# Inline Blender script.
#
# Written to disk in a temp dir and executed via ``blender --background --python``.
# Receives ``-- <input_path> <output_glb>`` after the operator separator.
# ---------------------------------------------------------------------------

_BLENDER_SCRIPT = r'''"""AnimaCore Blender conversion stub — DO NOT EDIT in place."""
import sys, os, traceback

try:
    import bpy
except ImportError:
    print("ANIMACORE_ERROR: bpy not available; this script must run inside Blender.", file=sys.stderr)
    sys.exit(2)

try:
    argv = sys.argv[sys.argv.index("--") + 1:]
except ValueError:
    print("ANIMACORE_ERROR: missing '--' separator and arguments.", file=sys.stderr)
    sys.exit(2)

if len(argv) < 2:
    print("ANIMACORE_ERROR: expected <input> <output_glb>.", file=sys.stderr)
    sys.exit(2)

input_path, output_path = argv[0], argv[1]
ext = os.path.splitext(input_path)[1].lower()

def _try(*ops):
    """Call the first operator that exists. ops is a list of (operator_path, kwargs)."""
    last_err = None
    for op_path, kwargs in ops:
        parts = op_path.split(".")
        node = bpy.ops
        for p in parts:
            node = getattr(node, p, None)
            if node is None:
                break
        if node is None:
            last_err = f"operator {op_path} not available in this Blender build"
            continue
        try:
            node(**kwargs)
            return True
        except Exception as e:
            last_err = f"{op_path} failed: {e}"
            continue
    raise RuntimeError(last_err or "no importer found")

try:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    if ext == ".fbx":
        _try(("import_scene.fbx", {"filepath": input_path}))
    elif ext == ".blend":
        with bpy.data.libraries.load(input_path, link=False) as (src, dst):
            dst.objects = list(src.objects)
            dst.collections = list(src.collections)
        for obj in dst.objects:
            if obj is not None:
                bpy.context.collection.objects.link(obj)
    elif ext == ".dae":
        _try(("wm.collada_import", {"filepath": input_path}))
    elif ext == ".3ds":
        # Blender 4.x: add-on. Operator may not exist; fall through.
        _try(
            ("import_scene.autodesk_3ds", {"filepath": input_path}),
            ("import_scene.max3ds", {"filepath": input_path}),
        )
    elif ext == ".x3d":
        _try(("import_scene.x3d", {"filepath": input_path}))
    elif ext == ".abc":
        _try(("wm.alembic_import", {"filepath": input_path}))
    elif ext in (".usd", ".usda", ".usdc", ".usdz"):
        _try(("wm.usd_import", {"filepath": input_path}))
    elif ext == ".obj":
        # Both old and new OBJ importers, in case user routes obj through Blender.
        _try(
            ("wm.obj_import", {"filepath": input_path}),
            ("import_scene.obj", {"filepath": input_path}),
        )
    elif ext in (".gltf", ".glb"):
        _try(("import_scene.gltf", {"filepath": input_path}))
    else:
        print(f"ANIMACORE_ERROR: unsupported extension {ext!r}", file=sys.stderr)
        sys.exit(3)

    # Ensure something actually imported.
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not mesh_objs:
        print("ANIMACORE_ERROR: no mesh objects found after import.", file=sys.stderr)
        sys.exit(4)

    # Select all meshes so the glTF exporter writes everything.
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]

    out_dir = os.path.dirname(output_path) or "."
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )

    if not os.path.exists(output_path):
        print("ANIMACORE_ERROR: glTF exporter ran but produced no file.", file=sys.stderr)
        sys.exit(5)

    print(f"ANIMACORE_OK: wrote {output_path}")
except SystemExit:
    raise
except Exception as exc:
    traceback.print_exc()
    print(f"ANIMACORE_ERROR: {exc}", file=sys.stderr)
    sys.exit(1)
'''


def _write_script(dir_: str) -> str:
    path = os.path.join(dir_, "_animacore_blender_export.py")
    with open(path, "w", encoding="utf-8") as f:
        f.write(_BLENDER_SCRIPT)
    return path


def convert_to_glb(
    input_path: str,
    timeout: int = 300,
    blender_path: Optional[str] = None,
) -> str:
    """Convert ``input_path`` to a .glb in the system temp dir.

    The caller is responsible for deleting the returned file (or using
    :class:`BlenderConvertContext` which cleans up automatically).

    Args:
        input_path: source file in one of :data:`BLENDER_FORMATS`.
        timeout: seconds before the Blender process is killed.
        blender_path: override auto-detection.

    Returns:
        Absolute path to the converted .glb.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(input_path)

    blender = blender_path or require_blender()

    tmp_dir = tempfile.mkdtemp(prefix="animacore_blender_")
    script_path = _write_script(tmp_dir)
    out_glb = os.path.join(
        tmp_dir,
        os.path.splitext(os.path.basename(input_path))[0] + ".glb",
    )

    cmd = [
        blender,
        "--background",
        "--factory-startup",
        "--python-exit-code", "1",
        "--python", script_path,
        "--",
        os.path.abspath(input_path),
        os.path.abspath(out_glb),
    ]
    log.info("Running Blender to convert %s -> .glb", os.path.basename(input_path))
    log.debug("Blender cmd: %s", " ".join(cmd))

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise BlenderConversionError(
            f"Blender conversion timed out after {timeout}s for {input_path}"
        ) from e
    except FileNotFoundError as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise BlenderNotFoundError(
            f"Failed to launch Blender at {blender!r}: {e}"
        ) from e

    stderr = (proc.stderr or "").strip()
    stdout = (proc.stdout or "").strip()
    if proc.returncode != 0 or not os.path.exists(out_glb):
        shutil.rmtree(tmp_dir, ignore_errors=True)
        # Pull the ANIMACORE_ERROR line out of stderr if present.
        err_line = next(
            (ln for ln in stderr.splitlines() if "ANIMACORE_ERROR" in ln),
            stderr.splitlines()[-1] if stderr else "(no stderr)",
        )
        raise BlenderConversionError(
            f"Blender failed to convert {os.path.basename(input_path)} "
            f"(exit={proc.returncode}): {err_line}"
        )

    log.info("Blender conversion succeeded: %s", out_glb)
    return out_glb


class BlenderConvertContext:
    """Context manager that converts (if needed) and cleans up the temp file.

    Usage::

        with BlenderConvertContext(input_path) as path_for_trimesh:
            mesh = trimesh.load(path_for_trimesh, ...)
    """

    def __init__(self, input_path: str, blender_path: Optional[str] = None):
        self.input_path = input_path
        self.blender_path = blender_path
        self._tmp_dir: Optional[str] = None
        self._converted: Optional[str] = None

    def __enter__(self) -> str:
        if not needs_blender(self.input_path):
            return self.input_path
        glb = convert_to_glb(self.input_path, blender_path=self.blender_path)
        self._converted = glb
        self._tmp_dir = os.path.dirname(glb)
        return glb

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._tmp_dir and os.path.isdir(self._tmp_dir):
            shutil.rmtree(self._tmp_dir, ignore_errors=True)
