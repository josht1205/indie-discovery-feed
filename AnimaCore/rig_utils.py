"""
AnimaCore.rig_utils

Real auto-rigging pipeline. No external Blender subprocess and no API-key
gating — this module loads a normalized mesh, generates a humanoid skeleton
sized to the mesh's bounding box, computes linear-blend skin weights, applies
the target engine's axis convention, and writes the rigged result to disk as
a mesh file (OBJ / glTF) plus a ``.rig.json`` sidecar containing the
skeleton and skin data.

The sidecar format is engine-agnostic — Unity, Unreal, Godot, and Blender
importers can all consume it.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Dict, Optional

import numpy as np
import trimesh

from .rig_builder import (
    apply_transform,
    build_humanoid_skeleton,
    compute_skin_weights,
    orientation_matrix,
)

log = logging.getLogger(__name__)

DEFAULT_CONFIG: Dict = {
    "rigging_config": {
        "target_skeleton_type": "humanoid_ue4",
        "bone_cleanup_passes": 3,
        "enforce_t_pose": True,
        "collision_geometry_generation": "minimal_bounding_box",
        "target_game_engine": "unreal_engine",
        "up_axis": "Z",
        "forward_axis": "X",
    },
    "optimization_settings": {
        "polygon_limit": 50000,
        "lod_levels": [0.5, 0.25],
        "auto_uv_generation": False,
    },
}


def _load_config(path: Optional[str]) -> Dict:
    if path and os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_CONFIG


def _decimate_if_needed(mesh: trimesh.Trimesh, polygon_limit: int) -> trimesh.Trimesh:
    if polygon_limit <= 0 or mesh.faces.shape[0] <= polygon_limit:
        return mesh
    try:
        ratio = polygon_limit / float(mesh.faces.shape[0])
        simplified = mesh.simplify_quadric_decimation(int(polygon_limit))
        if simplified is not None and simplified.faces.shape[0] > 0:
            log.info(
                "Decimated mesh %d -> %d faces (ratio %.3f)",
                mesh.faces.shape[0], simplified.faces.shape[0], ratio,
            )
            return simplified
    except Exception as exc:
        log.warning("Quadric decimation unavailable (%s); keeping original.", exc)
    return mesh


def rig_asset(
    input_path: str,
    output_path: str,
    config_path: Optional[str] = None,
    target_engine: Optional[str] = None,
    progress_cb=None,
) -> Dict:
    """Run the full rigging pipeline on a normalized mesh.

    Args:
        input_path: path to a normalized mesh file.
        output_path: where to write the rigged mesh. A sibling ``.rig.json``
            file is written alongside containing the skeleton + skin data.
        config_path: optional rig config JSON (defaults to built-in).
        target_engine: override the engine from the config ('unity' or
            'unreal_engine'). If None, uses config.
        progress_cb: optional callable(stage: str, fraction: float) for UI.

    Returns:
        A dict summarising what was produced (paths, bone count, etc.).
    """
    def report(stage: str, frac: float) -> None:
        if progress_cb is not None:
            try:
                progress_cb(stage, frac)
            except Exception:
                pass
        log.info("[rig %3d%%] %s", int(frac * 100), stage)

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input mesh not found: {input_path}")

    config = _load_config(config_path)
    rig_cfg = config.get("rigging_config", {})
    opt_cfg = config.get("optimization_settings", {})
    engine = (target_engine or rig_cfg.get("target_game_engine", "unreal_engine")).lower()
    poly_limit = int(opt_cfg.get("polygon_limit", 0))

    report("Loading mesh", 0.05)
    loaded = trimesh.load(input_path, process=False, force="mesh")
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            raise ValueError(f"No mesh geometry in {input_path}")
        mesh = trimesh.util.concatenate(meshes)
    else:
        mesh = loaded
    if not isinstance(mesh, trimesh.Trimesh) or mesh.vertices.shape[0] == 0:
        raise ValueError(f"Could not load a valid mesh from {input_path}")

    report("Decimating", 0.15)
    mesh = _decimate_if_needed(mesh, poly_limit)

    report("Building humanoid skeleton", 0.30)
    skeleton = build_humanoid_skeleton(mesh.vertices, target_engine=engine)

    report("Computing skin weights", 0.50)
    joint_indices, weights = compute_skin_weights(
        mesh.vertices, skeleton, max_influences=4, falloff=2.0,
    )

    report("Applying engine orientation", 0.75)
    om = orientation_matrix(engine)
    mesh.vertices = apply_transform(mesh.vertices, om)
    # Also transform bone heads so the rig stays aligned with the mesh.
    for bone in skeleton.bones:
        head = np.array(bone.head + [1.0])
        bone.head = (om @ head)[:3].tolist()
        bind = np.array(bone.inverse_bind)
        bone.inverse_bind = (bind @ np.linalg.inv(om)).tolist()

    report("Exporting mesh", 0.85)
    out_dir = os.path.dirname(os.path.abspath(output_path))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    out_ext = os.path.splitext(output_path)[1].lower().lstrip(".")
    if out_ext in ("gltf", "glb"):
        mesh.export(output_path, file_type=out_ext)
    elif out_ext == "ply":
        mesh.export(output_path, file_type="ply")
    elif out_ext == "stl":
        mesh.export(output_path, file_type="stl")
    else:
        mesh.export(output_path, file_type="obj")

    report("Writing rig sidecar", 0.95)
    sidecar_path = os.path.splitext(output_path)[0] + ".rig.json"
    sidecar = {
        "format": "AnimaCore.rig/1.0",
        "source_mesh": os.path.basename(output_path),
        "target_engine": engine,
        "orientation_matrix": om.tolist(),
        "vertex_count": int(mesh.vertices.shape[0]),
        "face_count": int(mesh.faces.shape[0]),
        "skeleton": skeleton.to_dict(),
        "skin": {
            "max_influences": int(joint_indices.shape[1]),
            "joint_indices": joint_indices.tolist(),
            "weights": weights.tolist(),
        },
        "config_used": config,
    }
    with open(sidecar_path, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)

    report("Done", 1.0)
    return {
        "mesh_path": os.path.abspath(output_path),
        "rig_path": os.path.abspath(sidecar_path),
        "bone_count": len(skeleton.bones),
        "vertex_count": int(mesh.vertices.shape[0]),
        "face_count": int(mesh.faces.shape[0]),
        "target_engine": engine,
    }
