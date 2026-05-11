"""AnimaCore — 3D asset normalization and rigging pipeline."""

from .blender_convert import (
    BlenderConversionError,
    BlenderNotFoundError,
    SUPPORTED_FORMATS,
    convert_to_glb,
    find_blender,
    needs_blender,
)
from .mesh_utils import normalize_mesh
from .normalize_asset import normalize_asset
from .rig_utils import rig_asset

__all__ = [
    "normalize_mesh",
    "normalize_asset",
    "rig_asset",
    "find_blender",
    "needs_blender",
    "convert_to_glb",
    "SUPPORTED_FORMATS",
    "BlenderNotFoundError",
    "BlenderConversionError",
]
__version__ = "1.1.0"
