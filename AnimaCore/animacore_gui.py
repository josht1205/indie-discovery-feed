"""
AnimaCore desktop GUI (PyQt6).

A production-quality dark-themed UI exposing the full pipeline:
    - Browse / drag-and-drop input mesh
    - Choose target height, engine, polygon limit, rigging mode
    - Live progress bar + streaming log
    - Output path picker with auto-suffix
    - Stats panel showing bone count / vertices / faces after rigging
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass
from typing import Optional

# Ensure package is importable whether run from source or frozen.
_here = os.path.dirname(os.path.abspath(__file__))
_parent = os.path.dirname(_here)
for p in (_parent, _here):
    if p and p not in sys.path:
        sys.path.insert(0, p)

from PyQt6.QtCore import Qt, QThread, pyqtSignal, QObject
from PyQt6.QtGui import QFont, QIcon, QPalette, QColor, QAction
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QFileDialog, QComboBox, QSpinBox,
    QDoubleSpinBox, QTextEdit, QProgressBar, QGroupBox, QStatusBar,
    QMessageBox, QCheckBox, QFrame, QSplitter,
)

try:
    from AnimaCore.blender_convert import (
        BlenderNotFoundError, find_blender, needs_blender,
    )
    from AnimaCore.normalize_asset import normalize_asset
    from AnimaCore.rig_utils import rig_asset
except ImportError:
    from blender_convert import (  # type: ignore
        BlenderNotFoundError, find_blender, needs_blender,
    )
    from normalize_asset import normalize_asset  # type: ignore
    from rig_utils import rig_asset  # type: ignore


MESH_EXTENSIONS = [
    ".obj", ".glb", ".gltf", ".ply", ".stl",
    ".fbx", ".blend", ".dae", ".3ds", ".x3d",
    ".abc", ".usd", ".usda", ".usdc", ".usdz",
]
MESH_FILTER = (
    "All supported meshes ("
    + " ".join(f"*{e}" for e in MESH_EXTENSIONS)
    + ");;Native (trimesh) (*.obj *.glb *.gltf *.ply *.stl)"
    ";;Blender-routed (*.fbx *.blend *.dae *.3ds *.x3d *.abc *.usd *.usda *.usdc *.usdz)"
    ";;All files (*.*)"
)


APP_NAME = "AnimaCore"
APP_VERSION = "1.0.0"


# ---------------------------------------------------------------------------
# Logging bridge — pipe Python logs into a Qt signal.
# ---------------------------------------------------------------------------

class QtLogHandler(logging.Handler, QObject):
    log_message = pyqtSignal(str, int)

    def __init__(self):
        logging.Handler.__init__(self)
        QObject.__init__(self)
        self.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s", "%H:%M:%S"))

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            self.log_message.emit(msg, record.levelno)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Worker thread — runs the pipeline off the UI thread.
# ---------------------------------------------------------------------------

@dataclass
class JobSpec:
    input_path: str
    output_path: str
    target_height: float
    engine: str
    polygon_limit: int
    mode: str  # "normalize" or "rig"


class PipelineWorker(QThread):
    progress = pyqtSignal(str, float)
    finished_ok = pyqtSignal(dict)
    failed = pyqtSignal(str)

    def __init__(self, job: JobSpec):
        super().__init__()
        self.job = job

    def _progress_cb(self, stage: str, frac: float) -> None:
        self.progress.emit(stage, frac)

    def run(self) -> None:
        try:
            job = self.job
            if job.mode == "normalize":
                self._progress_cb("Normalizing", 0.1)
                meta = normalize_asset(job.input_path, job.output_path, target_height=job.target_height)
                self._progress_cb("Done", 1.0)
                self.finished_ok.emit({
                    "mode": "normalize",
                    "output": os.path.abspath(job.output_path),
                    "vertex_count": meta["vertex_count"],
                    "scale_factor": meta["scale_factor"],
                })
                return

            # Full rig pipeline.
            with tempfile.TemporaryDirectory(prefix="animacore_") as tmp:
                in_ext = os.path.splitext(job.input_path)[1] or ".obj"
                normalized = os.path.join(tmp, "normalized" + in_ext)
                self._progress_cb("Normalizing mesh", 0.05)
                normalize_asset(job.input_path, normalized, target_height=job.target_height)

                # Build a config with the user's poly limit applied.
                cfg = {
                    "rigging_config": {
                        "target_game_engine": job.engine,
                    },
                    "optimization_settings": {
                        "polygon_limit": job.polygon_limit,
                    },
                }
                cfg_path = os.path.join(tmp, "rig_config.json")
                import json
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(cfg, f)

                result = rig_asset(
                    normalized,
                    job.output_path,
                    config_path=cfg_path,
                    target_engine=job.engine,
                    progress_cb=self._progress_cb,
                )
                result["mode"] = "rig"
                self.finished_ok.emit(result)
        except Exception as e:
            tb = traceback.format_exc()
            self.failed.emit(f"{e}\n\n{tb}")


# ---------------------------------------------------------------------------
# Main window.
# ---------------------------------------------------------------------------

PALETTE = {
    "bg":        "#0f172a",
    "panel":     "#1e293b",
    "panel2":    "#334155",
    "text":      "#f1f5f9",
    "muted":     "#94a3b8",
    "accent":    "#0ea5e9",
    "accent_h":  "#38bdf8",
    "ok":        "#22c55e",
    "warn":      "#fbbf24",
    "err":       "#ef4444",
    "border":    "#475569",
}

STYLESHEET = f"""
QMainWindow, QWidget {{
    background: {PALETTE['bg']};
    color: {PALETTE['text']};
    font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
    font-size: 10pt;
}}
QGroupBox {{
    background: {PALETTE['panel']};
    border: 1px solid {PALETTE['border']};
    border-radius: 8px;
    margin-top: 14px;
    padding: 16px 12px 12px 12px;
    font-weight: 600;
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 12px;
    padding: 0 6px;
    color: {PALETTE['accent_h']};
    background: {PALETTE['bg']};
}}
QLabel {{ color: {PALETTE['text']}; }}
QLabel#muted {{ color: {PALETTE['muted']}; }}
QLabel#header {{
    font-size: 18pt; font-weight: 700; color: {PALETTE['text']};
    padding: 8px 0;
}}
QLabel#subheader {{ color: {PALETTE['muted']}; font-size: 9pt; }}

QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QTextEdit {{
    background: {PALETTE['panel2']};
    color: {PALETTE['text']};
    border: 1px solid {PALETTE['border']};
    border-radius: 6px;
    padding: 6px 8px;
    selection-background-color: {PALETTE['accent']};
}}
QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus, QTextEdit:focus {{
    border: 1px solid {PALETTE['accent']};
}}
QLineEdit[readOnly="true"] {{
    background: #283449;
    color: {PALETTE['muted']};
}}
QComboBox::drop-down {{ border: none; width: 24px; }}
QComboBox QAbstractItemView {{
    background: {PALETTE['panel2']};
    border: 1px solid {PALETTE['border']};
    selection-background-color: {PALETTE['accent']};
    color: {PALETTE['text']};
}}

QPushButton {{
    background: {PALETTE['panel2']};
    color: {PALETTE['text']};
    border: 1px solid {PALETTE['border']};
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 600;
}}
QPushButton:hover {{
    background: {PALETTE['border']};
    border: 1px solid {PALETTE['accent']};
}}
QPushButton:pressed {{ background: {PALETTE['panel']}; }}
QPushButton:disabled {{ color: {PALETTE['muted']}; background: {PALETTE['panel']}; }}
QPushButton#primary {{
    background: {PALETTE['accent']};
    color: white;
    border: 1px solid {PALETTE['accent']};
}}
QPushButton#primary:hover {{ background: {PALETTE['accent_h']}; border: 1px solid {PALETTE['accent_h']}; }}
QPushButton#primary:disabled {{ background: #1e3a5f; color: {PALETTE['muted']}; }}

QProgressBar {{
    background: {PALETTE['panel2']};
    border: 1px solid {PALETTE['border']};
    border-radius: 6px;
    text-align: center;
    color: {PALETTE['text']};
    height: 22px;
}}
QProgressBar::chunk {{
    background-color: {PALETTE['accent']};
    border-radius: 5px;
}}

QTextEdit#log {{
    background: #0b1220;
    color: {PALETTE['text']};
    font-family: 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
    font-size: 9pt;
}}
QStatusBar {{
    background: {PALETTE['panel']};
    color: {PALETTE['muted']};
    border-top: 1px solid {PALETTE['border']};
}}
QSplitter::handle {{ background: {PALETTE['border']}; }}
QFrame#divider {{ background: {PALETTE['border']}; max-height: 1px; }}
"""


class AnimaCoreWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(f"{APP_NAME} — Auto-Rig Pipeline v{APP_VERSION}")
        self.setMinimumSize(960, 720)
        self.worker: Optional[PipelineWorker] = None
        self._build_ui()
        self._wire_logging()
        self.setAcceptDrops(True)

    # ---- layout ------------------------------------------------------------
    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(20, 16, 20, 12)
        root.setSpacing(12)

        # Header
        header_box = QVBoxLayout()
        header_box.setSpacing(2)
        title = QLabel(f"{APP_NAME}")
        title.setObjectName("header")
        sub = QLabel("3D asset normalization & humanoid auto-rigging for Unity / Unreal Engine")
        sub.setObjectName("subheader")
        header_box.addWidget(title)
        header_box.addWidget(sub)
        root.addLayout(header_box)

        # Splitter: controls on left, log on right
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(6)

        controls = QWidget()
        controls_layout = QVBoxLayout(controls)
        controls_layout.setContentsMargins(0, 0, 0, 0)
        controls_layout.setSpacing(10)

        controls_layout.addWidget(self._build_input_group())
        controls_layout.addWidget(self._build_options_group())
        controls_layout.addWidget(self._build_output_group())
        controls_layout.addWidget(self._build_action_row())
        controls_layout.addWidget(self._build_stats_group(), stretch=1)

        splitter.addWidget(controls)
        splitter.addWidget(self._build_log_panel())
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 2)
        splitter.setSizes([560, 380])
        root.addWidget(splitter, stretch=1)

        # Status bar
        self.status = QStatusBar()
        self.setStatusBar(self.status)
        self.status.showMessage(f"Ready — {APP_NAME} v{APP_VERSION}")

        self.setStyleSheet(STYLESHEET)

    def _build_input_group(self) -> QGroupBox:
        box = QGroupBox("1. Input asset")
        grid = QGridLayout(box)
        grid.setColumnStretch(1, 1)
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(8)

        grid.addWidget(QLabel("Mesh file"), 0, 0)
        self.input_edit = QLineEdit()
        self.input_edit.setPlaceholderText(
            "Drop any mesh here (.obj .glb .gltf .fbx .blend .dae .3ds .ply .stl .usd .abc …), "
            "or click Browse"
        )
        self.input_edit.setReadOnly(True)
        grid.addWidget(self.input_edit, 0, 1)
        browse = QPushButton("Browse…")
        browse.clicked.connect(self._on_browse_input)
        grid.addWidget(browse, 0, 2)

        hint = QLabel(
            "Native: .obj .glb .gltf .ply .stl   •   Blender-routed: "
            ".fbx .blend .dae .3ds .x3d .abc .usd .usda .usdc .usdz"
        )
        hint.setObjectName("muted")
        hint.setWordWrap(True)
        grid.addWidget(hint, 1, 1, 1, 2)

        self.blender_label = QLabel()
        self.blender_label.setObjectName("muted")
        self.blender_label.setWordWrap(True)
        grid.addWidget(self.blender_label, 2, 1, 1, 2)
        self._refresh_blender_status()
        return box

    def _build_options_group(self) -> QGroupBox:
        box = QGroupBox("2. Pipeline options")
        grid = QGridLayout(box)
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(8)
        grid.setColumnStretch(1, 1)
        grid.setColumnStretch(3, 1)

        # Mode
        grid.addWidget(QLabel("Mode"), 0, 0)
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(["Normalize + Rig (full)", "Normalize only"])
        self.mode_combo.currentIndexChanged.connect(self._on_mode_changed)
        grid.addWidget(self.mode_combo, 0, 1)

        # Target engine
        grid.addWidget(QLabel("Target engine"), 0, 2)
        self.engine_combo = QComboBox()
        self.engine_combo.addItem("Unreal Engine (Z-up, X-fwd)", "unreal_engine")
        self.engine_combo.addItem("Unity (Y-up, Z-fwd)", "unity")
        grid.addWidget(self.engine_combo, 0, 3)

        # Target height
        grid.addWidget(QLabel("Target height (m)"), 1, 0)
        self.height_spin = QDoubleSpinBox()
        self.height_spin.setRange(0.10, 100.0)
        self.height_spin.setDecimals(2)
        self.height_spin.setSingleStep(0.05)
        self.height_spin.setValue(1.80)
        grid.addWidget(self.height_spin, 1, 1)

        # Poly limit
        grid.addWidget(QLabel("Polygon limit"), 1, 2)
        self.poly_spin = QSpinBox()
        self.poly_spin.setRange(0, 5_000_000)
        self.poly_spin.setSingleStep(5000)
        self.poly_spin.setValue(50_000)
        self.poly_spin.setSpecialValueText("Unlimited")
        grid.addWidget(self.poly_spin, 1, 3)

        return box

    def _build_output_group(self) -> QGroupBox:
        box = QGroupBox("3. Output")
        grid = QGridLayout(box)
        grid.setColumnStretch(1, 1)
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(8)

        grid.addWidget(QLabel("Output file"), 0, 0)
        self.output_edit = QLineEdit()
        self.output_edit.setPlaceholderText("Auto-generated from input filename")
        grid.addWidget(self.output_edit, 0, 1)
        out_btn = QPushButton("Save as…")
        out_btn.clicked.connect(self._on_browse_output)
        grid.addWidget(out_btn, 0, 2)

        self.format_combo = QComboBox()
        self.format_combo.addItems([".glb", ".gltf", ".obj", ".ply", ".stl"])
        self.format_combo.currentTextChanged.connect(self._on_format_changed)
        grid.addWidget(QLabel("Format"), 1, 0)
        grid.addWidget(self.format_combo, 1, 1)

        self.open_when_done = QCheckBox("Open output folder when finished")
        self.open_when_done.setChecked(True)
        grid.addWidget(self.open_when_done, 1, 2)
        return box

    def _build_action_row(self) -> QWidget:
        row = QWidget()
        layout = QHBoxLayout(row)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        self.progress.setFormat("%p%  —  idle")
        layout.addWidget(self.progress, stretch=1)

        self.run_btn = QPushButton("Run pipeline")
        self.run_btn.setObjectName("primary")
        self.run_btn.setMinimumWidth(150)
        self.run_btn.clicked.connect(self._on_run)
        layout.addWidget(self.run_btn)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self._on_cancel)
        layout.addWidget(self.cancel_btn)
        return row

    def _build_stats_group(self) -> QGroupBox:
        box = QGroupBox("Results")
        layout = QVBoxLayout(box)
        layout.setSpacing(4)
        self.stats_label = QLabel("Run the pipeline to see output stats.")
        self.stats_label.setObjectName("muted")
        self.stats_label.setWordWrap(True)
        self.stats_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        layout.addWidget(self.stats_label)
        return box

    def _build_log_panel(self) -> QWidget:
        wrap = QWidget()
        layout = QVBoxLayout(wrap)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)
        header = QLabel("Live log")
        header.setObjectName("header")
        header.setStyleSheet("font-size: 12pt; font-weight: 600;")
        layout.addWidget(header)
        self.log = QTextEdit()
        self.log.setObjectName("log")
        self.log.setReadOnly(True)
        layout.addWidget(self.log, stretch=1)
        btns = QHBoxLayout()
        clear = QPushButton("Clear")
        clear.clicked.connect(lambda: self.log.clear())
        btns.addStretch(1)
        btns.addWidget(clear)
        layout.addLayout(btns)
        return wrap

    # ---- logging -----------------------------------------------------------
    def _wire_logging(self) -> None:
        handler = QtLogHandler()
        handler.log_message.connect(self._append_log)
        logging.getLogger().addHandler(handler)
        logging.getLogger().setLevel(logging.INFO)
        self._log_handler = handler

    def _append_log(self, msg: str, level: int) -> None:
        color = PALETTE["text"]
        if level >= logging.ERROR:
            color = PALETTE["err"]
        elif level >= logging.WARNING:
            color = PALETTE["warn"]
        elif "[rig 100%]" in msg or "Done" in msg:
            color = PALETTE["ok"]
        self.log.append(f'<span style="color:{color}">{msg}</span>')

    # ---- handlers ----------------------------------------------------------
    def _refresh_blender_status(self) -> None:
        path = find_blender()
        if path:
            self.blender_label.setText(
                f"<span style='color:{PALETTE['ok']}'>● Blender detected:</span> "
                f"<code>{path}</code>"
            )
        else:
            self.blender_label.setText(
                f"<span style='color:{PALETTE['warn']}'>● Blender not detected.</span> "
                "Native formats (.obj .glb .gltf .ply .stl) will still work. "
                "Install Blender from blender.org to enable .fbx / .blend / .dae / .3ds / .usd / .abc."
            )

    def _on_browse_input(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Select input mesh", "", MESH_FILTER,
        )
        if path:
            self._set_input(path)

    def _on_browse_output(self) -> None:
        suggested = self.output_edit.text() or "output" + self.format_combo.currentText()
        path, _ = QFileDialog.getSaveFileName(
            self, "Save output mesh as", suggested,
            "3D meshes (*.glb *.gltf *.obj *.ply *.stl);;All files (*.*)",
        )
        if path:
            self.output_edit.setText(path)
            ext = os.path.splitext(path)[1].lower()
            idx = self.format_combo.findText(ext)
            if idx >= 0:
                self.format_combo.setCurrentIndex(idx)

    def _on_format_changed(self, new_ext: str) -> None:
        cur = self.output_edit.text()
        if cur:
            base, _ = os.path.splitext(cur)
            self.output_edit.setText(base + new_ext)

    def _on_mode_changed(self, idx: int) -> None:
        is_rig = (idx == 0)
        self.engine_combo.setEnabled(is_rig)
        self.poly_spin.setEnabled(is_rig)

    def _set_input(self, path: str) -> None:
        self.input_edit.setText(path)
        base, _ = os.path.splitext(path)
        suffix = "_rigged" if self.mode_combo.currentIndex() == 0 else "_normalized"
        ext = self.format_combo.currentText()
        self.output_edit.setText(base + suffix + ext)
        self.status.showMessage(f"Loaded: {os.path.basename(path)}")
        logging.info("Input selected: %s", path)
        # Warn early if Blender will be needed but isn't installed.
        if needs_blender(path) and not find_blender():
            QMessageBox.warning(
                self,
                "Blender required",
                f"{os.path.basename(path)} uses a format that requires Blender "
                f"to import (.fbx / .blend / .dae / .3ds / .x3d / .abc / .usd*).\n\n"
                "Install Blender from https://www.blender.org/download/ and "
                "AnimaCore will auto-detect it, or set the ANIMACORE_BLENDER "
                "environment variable to the full path of blender.exe.",
            )

    # Drag & drop
    def dragEnterEvent(self, event) -> None:
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event) -> None:
        urls = event.mimeData().urls()
        if urls:
            path = urls[0].toLocalFile()
            if path and os.path.isfile(path):
                self._set_input(path)

    # ---- run ---------------------------------------------------------------
    def _on_run(self) -> None:
        input_path = self.input_edit.text().strip()
        if not input_path or not os.path.exists(input_path):
            QMessageBox.warning(self, "No input", "Please select a valid input mesh first.")
            return
        output_path = self.output_edit.text().strip()
        if not output_path:
            base, _ = os.path.splitext(input_path)
            output_path = base + "_rigged" + self.format_combo.currentText()
            self.output_edit.setText(output_path)

        job = JobSpec(
            input_path=input_path,
            output_path=output_path,
            target_height=self.height_spin.value(),
            engine=self.engine_combo.currentData() or "unreal_engine",
            polygon_limit=self.poly_spin.value(),
            mode="rig" if self.mode_combo.currentIndex() == 0 else "normalize",
        )

        self.worker = PipelineWorker(job)
        self.worker.progress.connect(self._on_progress)
        self.worker.finished_ok.connect(self._on_finished)
        self.worker.failed.connect(self._on_failed)
        self.worker.finished.connect(self._on_worker_done)

        self.run_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress.setValue(0)
        self.progress.setFormat("%p%  —  starting…")
        self.status.showMessage("Running pipeline…")
        logging.info("=== Starting %s pipeline ===", job.mode)
        self.worker.start()

    def _on_cancel(self) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.worker.wait(2000)
            logging.warning("Pipeline cancelled by user.")
            self.status.showMessage("Cancelled.")

    def _on_progress(self, stage: str, frac: float) -> None:
        self.progress.setValue(int(frac * 100))
        self.progress.setFormat(f"%p%  —  {stage}")

    def _on_finished(self, result: dict) -> None:
        mode = result.get("mode", "rig")
        if mode == "normalize":
            stats = (
                f"<b>Normalization complete</b><br>"
                f"Output: <code>{result['output']}</code><br>"
                f"Vertices: {result['vertex_count']:,} &nbsp;|&nbsp; "
                f"Scale factor: {result['scale_factor']:.4f}"
            )
        else:
            stats = (
                f"<b>Auto-rig complete</b><br>"
                f"Mesh: <code>{result['mesh_path']}</code><br>"
                f"Rig sidecar: <code>{result['rig_path']}</code><br>"
                f"Bones: <b>{result['bone_count']}</b> &nbsp;|&nbsp; "
                f"Vertices: {result['vertex_count']:,} &nbsp;|&nbsp; "
                f"Faces: {result['face_count']:,}<br>"
                f"Target engine: <b>{result['target_engine']}</b>"
            )
        self.stats_label.setText(stats)
        self.status.showMessage("Pipeline finished successfully.", 8000)
        self.progress.setFormat("100%  —  done")
        if self.open_when_done.isChecked():
            out = result.get("mesh_path") or result.get("output")
            if out:
                self._open_folder(os.path.dirname(out))

    def _on_failed(self, msg: str) -> None:
        logging.error("Pipeline failed:\n%s", msg)
        if "BlenderNotFoundError" in msg or "Blender executable not found" in msg:
            QMessageBox.critical(
                self,
                "Blender required",
                "This file format needs Blender to import.\n\n"
                "Install Blender from https://www.blender.org/download/ "
                "(default install path is auto-detected) or set the "
                "ANIMACORE_BLENDER environment variable to the full path of "
                "blender.exe.",
            )
        else:
            QMessageBox.critical(self, "Pipeline failed", msg)
        self.progress.setFormat("failed")

    def _on_worker_done(self) -> None:
        self.run_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

    @staticmethod
    def _open_folder(path: str) -> None:
        try:
            if sys.platform.startswith("win"):
                os.startfile(path)  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                import subprocess
                subprocess.Popen(["open", path])
            else:
                import subprocess
                subprocess.Popen(["xdg-open", path])
        except Exception:
            pass


def apply_dark_palette(app: QApplication) -> None:
    app.setStyle("Fusion")
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor(PALETTE["bg"]))
    palette.setColor(QPalette.ColorRole.WindowText, QColor(PALETTE["text"]))
    palette.setColor(QPalette.ColorRole.Base, QColor(PALETTE["panel2"]))
    palette.setColor(QPalette.ColorRole.AlternateBase, QColor(PALETTE["panel"]))
    palette.setColor(QPalette.ColorRole.ToolTipBase, QColor(PALETTE["panel"]))
    palette.setColor(QPalette.ColorRole.ToolTipText, QColor(PALETTE["text"]))
    palette.setColor(QPalette.ColorRole.Text, QColor(PALETTE["text"]))
    palette.setColor(QPalette.ColorRole.Button, QColor(PALETTE["panel2"]))
    palette.setColor(QPalette.ColorRole.ButtonText, QColor(PALETTE["text"]))
    palette.setColor(QPalette.ColorRole.Highlight, QColor(PALETTE["accent"]))
    palette.setColor(QPalette.ColorRole.HighlightedText, QColor("#ffffff"))
    app.setPalette(palette)


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    apply_dark_palette(app)
    win = AnimaCoreWindow()
    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
