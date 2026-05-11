"""
One-shot build script.

Runs PyInstaller against both AnimaCore.spec (GUI) and AnimaCoreCLI.spec (CLI),
producing two distributable folders under ``dist/``.

Usage (from inside the AnimaCore folder, with the tf-rigging conda env active):

    python build_exe.py            # builds both GUI and CLI
    python build_exe.py --gui      # builds only the GUI
    python build_exe.py --cli      # builds only the CLI
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys


HERE = os.path.dirname(os.path.abspath(__file__))


def ensure_pyinstaller() -> None:
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("PyInstaller not installed. Run:  pip install pyinstaller")
        sys.exit(1)


def clean() -> None:
    for d in ("build", "dist"):
        p = os.path.join(HERE, d)
        if os.path.exists(p):
            print(f"  removing {p}")
            shutil.rmtree(p, ignore_errors=True)


def run_spec(spec_name: str) -> None:
    spec = os.path.join(HERE, spec_name)
    if not os.path.exists(spec):
        print(f"!! spec not found: {spec}")
        sys.exit(1)
    print(f"\n>>> Building {spec_name}")
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", spec]
    res = subprocess.run(cmd, cwd=HERE)
    if res.returncode != 0:
        print(f"!! PyInstaller failed for {spec_name} (code {res.returncode})")
        sys.exit(res.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build AnimaCore Windows executables.")
    parser.add_argument("--gui", action="store_true", help="build only the GUI")
    parser.add_argument("--cli", action="store_true", help="build only the CLI")
    parser.add_argument("--no-clean", action="store_true", help="skip wiping build/ and dist/")
    args = parser.parse_args()

    ensure_pyinstaller()
    if not args.no_clean:
        print(">>> Cleaning previous build artifacts")
        clean()

    build_gui = args.gui or not (args.gui or args.cli)
    build_cli = args.cli or not (args.gui or args.cli)

    if build_gui:
        run_spec("AnimaCore.spec")
    if build_cli:
        run_spec("AnimaCoreCLI.spec")

    print("\n=== Build complete ===")
    dist = os.path.join(HERE, "dist")
    if os.path.exists(dist):
        for entry in os.listdir(dist):
            print(f"  dist/{entry}")


if __name__ == "__main__":
    main()
