# PyInstaller spec for the AnimaCore desktop GUI.
# Build:  pyinstaller AnimaCore.spec
# Output: dist/AnimaCore/AnimaCore.exe  (one-folder distribution)

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

hidden = []
hidden += collect_submodules("trimesh")
hidden += collect_submodules("numpy")
hidden += [
    "scipy.optimize._tr_interior_point",
    "scipy.special._ufuncs_cxx",
]

datas = []
datas += collect_data_files("trimesh", include_py_files=False)
datas += [("default_rig_config.json", ".")]


a = Analysis(
    ["animacore_gui.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tensorflow", "torch", "matplotlib", "tkinter",
        "PyQt5", "PySide2", "PySide6",
        "IPython", "notebook", "jupyter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AnimaCore",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,                  # GUI app — hide the console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="AnimaCore",
)
