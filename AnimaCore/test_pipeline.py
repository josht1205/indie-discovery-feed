"""
Smoke test for the AnimaCore pipeline.

Generates a synthetic humanoid-ish mesh, normalizes it, runs the rigger, and
asserts the outputs look sane. Designed to run in a clean environment with
only the runtime dependencies installed (numpy, scipy, trimesh).

Run:  python test_pipeline.py
"""

from __future__ import annotations

import json
import os
import sys
import tempfile

import numpy as np
import trimesh

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_here))

from AnimaCore.normalize_asset import normalize_asset
from AnimaCore.rig_utils import rig_asset


def make_test_mesh(path: str) -> None:
    """Build a tall capsule-ish mesh roughly the shape of a human."""
    parts = [
        trimesh.creation.cylinder(radius=0.18, height=0.9, sections=24),         # torso
        trimesh.creation.icosphere(radius=0.13, subdivisions=2),                  # head
        trimesh.creation.cylinder(radius=0.07, height=0.7, sections=16),         # leg L
        trimesh.creation.cylinder(radius=0.07, height=0.7, sections=16),         # leg R
        trimesh.creation.cylinder(radius=0.05, height=0.6, sections=16),         # arm L
        trimesh.creation.cylinder(radius=0.05, height=0.6, sections=16),         # arm R
    ]
    parts[1].apply_translation([0, 0.65, 0])
    parts[2].apply_translation([-0.08, -0.8, 0])
    parts[3].apply_translation([ 0.08, -0.8, 0])
    parts[4].apply_translation([-0.30, 0.15, 0])
    parts[4].apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    parts[5].apply_translation([ 0.30, 0.15, 0])
    parts[5].apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    combined = trimesh.util.concatenate(parts)
    combined.export(path)


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "humanoid.obj")
        norm = os.path.join(tmp, "humanoid_norm.obj")
        rigged = os.path.join(tmp, "humanoid_rigged.glb")
        make_test_mesh(src)

        print(">>> normalize_asset")
        meta = normalize_asset(src, norm, target_height=1.8)
        assert meta["vertex_count"] > 0
        m = trimesh.load(norm, process=False, force="mesh")
        h = float(m.extents[1])
        assert abs(h - 1.8) < 0.01, f"normalized height {h} != 1.8"
        print(f"    height after normalize: {h:.4f}m (OK)")

        print(">>> rig_asset (Unreal)")
        result = rig_asset(norm, rigged, target_engine="unreal_engine")
        assert os.path.exists(result["mesh_path"])
        assert os.path.exists(result["rig_path"])
        with open(result["rig_path"], encoding="utf-8") as f:
            rig = json.load(f)
        assert rig["skeleton"]["bone_count"] == result["bone_count"]
        assert rig["skin"]["max_influences"] == 4
        n_verts = result["vertex_count"]
        assert len(rig["skin"]["weights"]) == n_verts
        weights = np.array(rig["skin"]["weights"])
        sums = weights.sum(axis=1)
        assert np.allclose(sums, 1.0, atol=1e-4), f"weight sums not normalized: {sums.min()}..{sums.max()}"
        print(f"    bones={result['bone_count']} verts={n_verts} faces={result['face_count']} (OK)")

        print(">>> rig_asset (Unity)")
        rigged2 = os.path.join(tmp, "humanoid_unity.glb")
        result2 = rig_asset(norm, rigged2, target_engine="unity")
        assert result2["target_engine"] == "unity"
        print(f"    Unity output OK")

    print("\nAll tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
