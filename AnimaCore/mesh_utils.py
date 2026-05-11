"""
AnimaCore.mesh_utils

Core mesh normalization math. Takes raw vertex/face data, centers the mesh
on the origin, and scales it so its Y-axis (height) equals a target value.

This is the only module that contains the actual normalization logic — all
file I/O lives in normalize_asset.py and the CLI / GUI sit on top of that.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Sequence, Union

import numpy as np

log = logging.getLogger(__name__)

VertexList = Union[Sequence[Sequence[float]], np.ndarray]
FaceList = Union[Sequence[Sequence[int]], np.ndarray]


def normalize_mesh(
    mesh_data: Dict[str, VertexList],
    target_height: float = 1.8,
) -> Dict[str, np.ndarray]:
    """Center a mesh on the origin and scale it to ``target_height`` metres.

    Args:
        mesh_data: dict with at least a ``vertices`` key (Nx3 array-like).
            ``faces`` is preserved unchanged if present.
        target_height: desired height along the Y axis, in metres.

    Returns:
        New dict with ``vertices`` (np.ndarray Nx3), ``faces`` (if provided),
        and a ``metadata`` block describing the transform that was applied.
    """
    if "vertices" not in mesh_data:
        raise ValueError("mesh_data must contain a 'vertices' key")

    vertices = np.asarray(mesh_data["vertices"], dtype=np.float64)
    if vertices.ndim != 2 or vertices.shape[1] != 3:
        raise ValueError(
            f"vertices must be an Nx3 array, got shape {vertices.shape}"
        )
    if vertices.shape[0] == 0:
        raise ValueError("vertices array is empty")
    if target_height <= 0:
        raise ValueError(f"target_height must be positive, got {target_height}")

    bbox_min = vertices.min(axis=0)
    bbox_max = vertices.max(axis=0)
    extents = bbox_max - bbox_min
    current_height = float(extents[1])

    if current_height <= 1e-9:
        raise ValueError(
            "Mesh has zero height along Y axis; cannot normalize."
        )

    scale = target_height / current_height
    center_xz = np.array([
        (bbox_min[0] + bbox_max[0]) * 0.5,
        bbox_min[1],
        (bbox_min[2] + bbox_max[2]) * 0.5,
    ], dtype=np.float64)

    normalized = (vertices - center_xz) * scale

    log.info(
        "Normalized mesh: %d verts, scale=%.4f, original height=%.4fm -> %.4fm",
        vertices.shape[0], scale, current_height, target_height,
    )

    result: Dict[str, np.ndarray] = {
        "vertices": normalized,
        "metadata": {
            "vertex_count": int(vertices.shape[0]),
            "original_extents": extents.tolist(),
            "scale_factor": scale,
            "target_height": target_height,
        },
    }
    if "faces" in mesh_data:
        result["faces"] = np.asarray(mesh_data["faces"])
    return result
