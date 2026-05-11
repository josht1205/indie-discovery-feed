"""
AnimaCore.rig_builder

Procedural humanoid skeleton generation and linear-blend skin weight
computation. Operates on normalized mesh vertices (centered on X/Z, sitting
on Y=0, height = target_height).

Produces a skeleton compatible with both Unity Humanoid and Unreal Engine
SK_Mannequin conventions — bone names follow Mixamo / Unreal UE4 naming.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple

import numpy as np


# Bone positions are expressed as (x_frac, y_frac, z_frac) of the normalized
# mesh's bounding box, where y_frac=0 is the feet and y_frac=1 is the top of
# the head. Values derived from VRC / Mixamo humanoid proportions.
HUMANOID_TEMPLATE: List[Tuple[str, Optional[str], Tuple[float, float, float]]] = [
    # name,            parent,            (x_frac, y_frac, z_frac)
    ("Hips",           None,              ( 0.00, 0.55, 0.00)),
    ("Spine",          "Hips",            ( 0.00, 0.63, 0.00)),
    ("Spine1",         "Spine",           ( 0.00, 0.71, 0.00)),
    ("Spine2",         "Spine1",          ( 0.00, 0.79, 0.00)),
    ("Neck",           "Spine2",          ( 0.00, 0.87, 0.00)),
    ("Head",           "Neck",            ( 0.00, 0.93, 0.00)),
    ("HeadTop",        "Head",            ( 0.00, 1.00, 0.00)),

    ("LeftShoulder",   "Spine2",          ( 0.06, 0.85, 0.00)),
    ("LeftArm",        "LeftShoulder",    ( 0.12, 0.83, 0.00)),
    ("LeftForeArm",    "LeftArm",         ( 0.26, 0.79, 0.00)),
    ("LeftHand",       "LeftForeArm",     ( 0.40, 0.75, 0.00)),

    ("RightShoulder",  "Spine2",          (-0.06, 0.85, 0.00)),
    ("RightArm",       "RightShoulder",   (-0.12, 0.83, 0.00)),
    ("RightForeArm",   "RightArm",        (-0.26, 0.79, 0.00)),
    ("RightHand",      "RightForeArm",    (-0.40, 0.75, 0.00)),

    ("LeftUpLeg",      "Hips",            ( 0.05, 0.53, 0.00)),
    ("LeftLeg",        "LeftUpLeg",       ( 0.06, 0.28, 0.00)),
    ("LeftFoot",       "LeftLeg",         ( 0.07, 0.04, 0.03)),
    ("LeftToeBase",    "LeftFoot",        ( 0.07, 0.00, 0.10)),

    ("RightUpLeg",     "Hips",            (-0.05, 0.53, 0.00)),
    ("RightLeg",       "RightUpLeg",      (-0.06, 0.28, 0.00)),
    ("RightFoot",      "RightLeg",        (-0.07, 0.04, 0.03)),
    ("RightToeBase",   "RightFoot",       (-0.07, 0.00, 0.10)),
]


@dataclass
class Bone:
    name: str
    parent: Optional[str]
    head: List[float]                 # world-space position of bone origin
    index: int = -1
    parent_index: int = -1
    inverse_bind: List[List[float]] = field(default_factory=list)


@dataclass
class Skeleton:
    bones: List[Bone]
    target_engine: str

    def to_dict(self) -> Dict:
        return {
            "target_engine": self.target_engine,
            "bone_count": len(self.bones),
            "bones": [
                {
                    "name": b.name,
                    "index": b.index,
                    "parent": b.parent,
                    "parent_index": b.parent_index,
                    "head": b.head,
                    "inverse_bind_matrix": b.inverse_bind,
                }
                for b in self.bones
            ],
        }


def build_humanoid_skeleton(
    vertices: np.ndarray,
    target_engine: str = "unreal_engine",
) -> Skeleton:
    """Generate a humanoid skeleton positioned inside the mesh bbox.

    Args:
        vertices: Nx3 array of normalized mesh vertices.
        target_engine: 'unity' or 'unreal_engine' — controls naming/axis hints
            stored in the skeleton metadata. The bones themselves are produced
            in the source-space (Y-up); the orientation matrix is applied
            separately at export time.

    Returns:
        Skeleton with positioned bones and inverse-bind matrices computed.
    """
    bbox_min = vertices.min(axis=0)
    bbox_max = vertices.max(axis=0)
    extents = bbox_max - bbox_min
    height = float(extents[1])
    width = float(extents[0])
    depth = float(extents[2])

    # Reference span: height drives Y placement, width drives X (arms/legs),
    # depth drives Z (foot toe offset). We scale x_frac by width/height so a
    # narrow mesh doesn't get cartoonishly wide arm spans.
    width_scale = max(width / max(height, 1e-6), 0.18)
    depth_scale = max(depth / max(height, 1e-6), 0.18)

    bones: List[Bone] = []
    name_to_index: Dict[str, int] = {}

    for idx, (name, parent, (xf, yf, zf)) in enumerate(HUMANOID_TEMPLATE):
        head = [
            float(bbox_min[0] + (xf + 0.5) * width if False else (xf * height * width_scale)),
            float(bbox_min[1] + yf * height),
            float(zf * height * depth_scale),
        ]
        # X is centered on origin (we scaled by height because the template
        # uses fractions of height for limb spans).
        head[0] = float(xf * height * width_scale)

        parent_index = name_to_index[parent] if parent is not None else -1
        bone = Bone(
            name=name,
            parent=parent,
            head=head,
            index=idx,
            parent_index=parent_index,
        )
        bones.append(bone)
        name_to_index[name] = idx

    # Inverse bind = inverse of bone's world transform at rest.
    # Rest orientation is identity (T-pose, no rotation); translation = head.
    for b in bones:
        m = np.eye(4, dtype=np.float64)
        m[0:3, 3] = b.head
        inv = np.linalg.inv(m)
        b.inverse_bind = inv.tolist()

    return Skeleton(bones=bones, target_engine=target_engine)


def compute_skin_weights(
    vertices: np.ndarray,
    skeleton: Skeleton,
    max_influences: int = 4,
    falloff: float = 2.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute linear-blend skin weights via inverse-distance to bone segments.

    For each vertex, find the K closest bones (by distance to the line segment
    between the bone's head and the head of its child, falling back to head
    point for leaf bones), weight by ``1 / d**falloff``, then normalize.

    Args:
        vertices: Nx3 normalized mesh vertices.
        skeleton: skeleton from :func:`build_humanoid_skeleton`.
        max_influences: number of bones that can influence a single vertex.
        falloff: exponent applied to inverse distance. Higher = sharper.

    Returns:
        (joint_indices, weights) — both Nx``max_influences`` arrays. Weights
        sum to 1.0 per vertex.
    """
    n_verts = vertices.shape[0]
    n_bones = len(skeleton.bones)
    if n_bones == 0:
        raise ValueError("Skeleton has no bones")

    # Build bone segments: for each bone, segment = (head, head_of_first_child).
    # If no children, segment endpoint = head + small offset along parent axis.
    children: Dict[int, List[int]] = {i: [] for i in range(n_bones)}
    for b in skeleton.bones:
        if b.parent_index >= 0:
            children[b.parent_index].append(b.index)

    seg_a = np.zeros((n_bones, 3), dtype=np.float64)
    seg_b = np.zeros((n_bones, 3), dtype=np.float64)
    for b in skeleton.bones:
        seg_a[b.index] = b.head
        kids = children[b.index]
        if kids:
            # Use the first child's head as the segment tail.
            seg_b[b.index] = skeleton.bones[kids[0]].head
        else:
            # Leaf bone: extend a short distance along the vector from parent.
            if b.parent_index >= 0:
                direction = np.array(b.head) - np.array(skeleton.bones[b.parent_index].head)
                norm = np.linalg.norm(direction)
                if norm > 1e-6:
                    direction = direction / norm
                else:
                    direction = np.array([0.0, 1.0, 0.0])
                seg_b[b.index] = np.array(b.head) + direction * 0.05
            else:
                seg_b[b.index] = np.array(b.head) + np.array([0.0, 0.05, 0.0])

    # Distance from each vertex to each bone segment.
    distances = np.zeros((n_verts, n_bones), dtype=np.float64)
    for j in range(n_bones):
        a = seg_a[j]
        b = seg_b[j]
        ab = b - a
        ab_len_sq = float(np.dot(ab, ab))
        if ab_len_sq < 1e-12:
            d = np.linalg.norm(vertices - a, axis=1)
        else:
            t = np.einsum("ij,j->i", vertices - a, ab) / ab_len_sq
            t = np.clip(t, 0.0, 1.0)
            closest = a + np.outer(t, ab)
            d = np.linalg.norm(vertices - closest, axis=1)
        distances[:, j] = d

    # For each vertex, pick K nearest bones.
    k = min(max_influences, n_bones)
    nearest = np.argpartition(distances, kth=k - 1, axis=1)[:, :k]
    rows = np.arange(n_verts)[:, None]
    near_d = distances[rows, nearest]

    # Sort the K picks by distance ascending so column 0 is always the
    # primary influence.
    order = np.argsort(near_d, axis=1)
    joint_indices = np.take_along_axis(nearest, order, axis=1).astype(np.int32)
    near_d = np.take_along_axis(near_d, order, axis=1)

    eps = 1e-6
    inv = 1.0 / np.power(near_d + eps, falloff)
    weights = inv / inv.sum(axis=1, keepdims=True)
    return joint_indices, weights.astype(np.float32)


# ------------------------------------------------------------------
# Engine-specific axis correction.
# ------------------------------------------------------------------

def orientation_matrix(target_engine: str) -> np.ndarray:
    """Return a 4x4 transform that maps source-space (Y-up, Z-forward,
    right-handed) into the target engine's convention.

    - 'unity': Y-up, Z-forward, left-handed — flip Z to convert handedness.
    - 'unreal_engine': Z-up, X-forward, left-handed — full axis swap.
    """
    engine = target_engine.lower().strip()
    if engine in ("unity", "unity3d"):
        m = np.eye(4, dtype=np.float64)
        m[2, 2] = -1.0
        return m
    if engine in ("unreal_engine", "unreal", "ue4", "ue5", "epic"):
        m = np.zeros((4, 4), dtype=np.float64)
        # source X -> target -Y, source Y -> target Z, source Z -> target X
        m[1, 0] = -1.0
        m[2, 1] = 1.0
        m[0, 2] = 1.0
        m[3, 3] = 1.0
        return m
    # Unknown engine — return identity.
    return np.eye(4, dtype=np.float64)


def apply_transform(vertices: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Apply a 4x4 homogeneous transform to an Nx3 vertex array."""
    n = vertices.shape[0]
    homog = np.hstack([vertices, np.ones((n, 1), dtype=vertices.dtype)])
    transformed = homog @ matrix.T
    return transformed[:, :3]
