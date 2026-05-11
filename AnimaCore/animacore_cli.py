"""
AnimaCore CLI entry point.

Two subcommands:
    normalize  — load a mesh, center + scale to a target height, write result.
    rig        — run the full normalize + auto-rig pipeline.

Usage:
    python animacore_cli.py normalize input.obj --output norm.obj --height 1.8
    python animacore_cli.py rig input.obj --output rigged.glb --engine unreal_engine
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import tempfile
import time

# When frozen by PyInstaller the package files sit beside the executable, so
# ensure the parent dir of this file is on sys.path before we try to import.
_here = os.path.dirname(os.path.abspath(__file__))
_parent = os.path.dirname(_here)
for p in (_parent, _here):
    if p and p not in sys.path:
        sys.path.insert(0, p)

try:
    from AnimaCore.normalize_asset import normalize_asset
    from AnimaCore.rig_utils import rig_asset
except ImportError:
    # Fallback for flat-package frozen builds.
    from normalize_asset import normalize_asset  # type: ignore
    from rig_utils import rig_asset  # type: ignore


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _resolve_output(input_path: str, output: str | None, suffix: str, ext: str) -> str:
    if output:
        return os.path.abspath(output)
    base, _ = os.path.splitext(os.path.abspath(input_path))
    return f"{base}{suffix}{ext}"


def cmd_normalize(args: argparse.Namespace) -> int:
    output = _resolve_output(args.input, args.output, "_normalized", os.path.splitext(args.input)[1] or ".obj")
    print(f"[normalize] input:  {args.input}")
    print(f"[normalize] output: {output}")
    print(f"[normalize] target height: {args.height:.3f}m")
    t0 = time.time()
    meta = normalize_asset(args.input, output, target_height=args.height)
    print(
        f"[normalize] done in {time.time() - t0:.2f}s  "
        f"verts={meta['vertex_count']} scale={meta['scale_factor']:.4f}"
    )
    return 0


def cmd_rig(args: argparse.Namespace) -> int:
    in_ext = os.path.splitext(args.input)[1] or ".obj"
    out_ext = os.path.splitext(args.output)[1] if args.output else ".glb"
    final_output = _resolve_output(args.input, args.output, "_rigged", out_ext)

    with tempfile.TemporaryDirectory(prefix="animacore_") as tmp:
        normalized = os.path.join(tmp, "normalized" + in_ext)
        print(f"[rig] input:  {args.input}")
        print(f"[rig] output: {final_output}")
        print(f"[rig] engine: {args.engine}")
        print(f"[rig] target height: {args.height:.3f}m")

        t0 = time.time()
        normalize_asset(args.input, normalized, target_height=args.height)
        print(f"[rig] normalization done ({time.time() - t0:.2f}s)")

        def progress(stage: str, frac: float) -> None:
            bar_len = 30
            filled = int(bar_len * frac)
            bar = "#" * filled + "-" * (bar_len - filled)
            sys.stdout.write(f"\r[rig] [{bar}] {int(frac * 100):3d}% {stage:<32}")
            sys.stdout.flush()
            if frac >= 1.0:
                sys.stdout.write("\n")

        result = rig_asset(
            normalized,
            final_output,
            config_path=args.config,
            target_engine=args.engine,
            progress_cb=progress,
        )
        elapsed = time.time() - t0
        print(f"[rig] complete in {elapsed:.2f}s")
        print(f"[rig] mesh: {result['mesh_path']}")
        print(f"[rig] rig:  {result['rig_path']}")
        print(f"[rig] bones={result['bone_count']} verts={result['vertex_count']} faces={result['face_count']}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="animacore",
        description="AnimaCore — 3D asset normalization and auto-rigging pipeline.",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="enable debug logging")
    sub = p.add_subparsers(dest="command", required=True)

    norm = sub.add_parser("normalize", help="center + scale a mesh to a target height")
    norm.add_argument("input", help="path to input mesh (.obj, .gltf, .glb, .ply, .stl)")
    norm.add_argument("--output", "-o", help="output path (default: <input>_normalized.<ext>)")
    norm.add_argument("--height", type=float, default=1.8, help="target height in metres (default 1.8)")
    norm.set_defaults(func=cmd_normalize)

    rig = sub.add_parser("rig", help="normalize + auto-rig with humanoid skeleton")
    rig.add_argument("input", help="path to input mesh")
    rig.add_argument("--output", "-o", help="output path (default: <input>_rigged.glb)")
    rig.add_argument("--height", type=float, default=1.8, help="target height in metres (default 1.8)")
    rig.add_argument(
        "--engine",
        choices=["unity", "unreal_engine"],
        default="unreal_engine",
        help="target game engine (controls axis orientation)",
    )
    rig.add_argument("--config", help="optional rig config JSON path")
    rig.set_defaults(func=cmd_rig)
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    _setup_logging(args.verbose)
    try:
        return args.func(args)
    except FileNotFoundError as e:
        print(f"[error] file not found: {e}", file=sys.stderr)
        return 2
    except ValueError as e:
        print(f"[error] {e}", file=sys.stderr)
        return 3
    except Exception as e:
        logging.exception("Unhandled error")
        print(f"[error] {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
