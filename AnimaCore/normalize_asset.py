"""
AnimaCore.normalize_asset

File I/O wrapper around :func:`mesh_utils.normalize_mesh`. Loads a mesh from
disk with trimesh, runs centering + uniform scaling, and writes the result
back out in the same (or a chosen) format.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np
import trimesh

from .blender_convert import (
    BlenderConvertContext,
    SUPPORTED_FORMATS as ALL_SUPPORTED,
    needs_blender,
)
from .mesh_utils import normalize_mesh

log = logging.getLogger(__name__)

# Formats trimesh can load directly. Everything else in ALL_SUPPORTED is
# routed through Blender for conversion to .glb first.
TRIMESH_NATIVE_FORMATS = {".obj", ".gltf", ".glb", ".ply", ".stl", ".off"}
SUPPORTED_FORMATS = ALL_SUPPORTED | TRIMESH_NATIVE_FORMATS


def normalize_asset(
    input_path: str,
    output_path: str,
    target_height: float = 1.8,
) -> dict:
    """Load a mesh, normalize it, and save the result.

    Args:
        input_path: path to the source mesh file.
        output_path: where to save the normalized mesh. Extension determines
            the format (defaults to .obj if unrecognised).
        target_height: desired height along Y in metres.

    Returns:
        The metadata dict produced by :func:`mesh_utils.normalize_mesh`.
    """
    full_input = os.path.abspath(input_path)
    if not os.path.exists(full_input):
        raise FileNotFoundError(f"Input mesh not found: {full_input}")

    in_ext = os.path.splitext(full_input)[1].lower()
    if in_ext not in SUPPORTED_FORMATS:
        log.warning("Unrecognised input extension %r; trimesh will guess.", in_ext)
    elif needs_blender(full_input):
        log.info("Routing %s through Blender for conversion to .glb", in_ext)

    log.info("Loading mesh: %s", full_input)
    with BlenderConvertContext(full_input) as load_path:
        loaded = trimesh.load(load_path, process=False, force="mesh")

    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            raise ValueError(f"No mesh geometry found in {full_input}")
        mesh = trimesh.util.concatenate(meshes)
    elif isinstance(loaded, trimesh.Trimesh):
        mesh = loaded
    else:
        raise ValueError(f"Unsupported geometry type loaded from {full_input}: {type(loaded)}")

    if mesh.vertices.shape[0] == 0:
        raise ValueError(f"Mesh contains no vertices: {full_input}")

    raw = {
        "vertices": mesh.vertices,
        "faces": mesh.faces,
    }

    result = normalize_mesh(raw, target_height=target_height)
    mesh.vertices = np.asarray(result["vertices"])

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

    log.info("Wrote normalized mesh: %s", output_path)
    return result["metadata"]
