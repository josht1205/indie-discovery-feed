# PyInstaller spec for the AnimaCore command-line interface.
# Build:  pyinstaller AnimaCoreCLI.spec
# Output: dist/AnimaCoreCLI/AnimaCoreCLI.exe

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

hidden = []
hidden += collect_submodules("trimesh")
hidden += collect_submodules("numpy")

datas = []
datas += collect_data_files("trimesh", include_py_files=False)
datas += [("default_rig_config.json", ".")]

a = Analysis(
    ["animacore_cli.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tensorflow", "torch", "matplotlib", "tkinter",
        "PyQt5", "PyQt6", "PySide2", "PySide6",
    ],
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AnimaCoreCLI",
    debug=False,
    strip=False,
    upx=True,
    console=True,
)
coll = COLLECT(
    exe, a.binaries, a.zipfiles, a.datas,
    strip=False, upx=True, name="AnimaCoreCLI",
)
