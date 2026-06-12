"""Drag-select a screen region, then press ENTER to snap it — over and over.

Built for fast card capturing: define the region once (over the card display),
then for each card press ENTER to save a PNG. Files are named the Obsidian way
(file-<timestamp>.png) so they drop straight into a content card folder.

    uv run tools/snip.py                                   # save to ./captures
    uv run tools/snip.py -o "content/post/系統/AR卡篇/2星AR卡"

Keys (global — work while the game window is focused):
    ENTER  capture the region and save
    R      re-select the region
    ESC/Q  quit

Windows only (uses screen grab + global key hook + DPI metrics).
"""

import argparse
import ctypes
import sys
from datetime import datetime
from pathlib import Path
from types import ModuleType

from PIL import ImageGrab

winsound: ModuleType | None
try:
    import winsound as _winsound  # Windows stdlib: capture feedback beep

    winsound = _winsound
except ImportError:  # pragma: no cover - non-Windows
    winsound = None


# --------------------------------------------------------------------------- #
# Windows helpers
# --------------------------------------------------------------------------- #
def enable_dpi_awareness() -> None:
    """So tkinter coords and ImageGrab pixels line up under display scaling."""
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # per-monitor v2
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def virtual_screen() -> tuple[int, int, int, int]:
    """(origin_x, origin_y, width, height) of the whole virtual desktop, in px."""
    u = ctypes.windll.user32
    return (
        u.GetSystemMetrics(76),
        u.GetSystemMetrics(77),  # SM_X/Y VIRTUALSCREEN
        u.GetSystemMetrics(78),
        u.GetSystemMetrics(79),
    )  # SM_CX/CY VIRTUALSCREEN


def beep() -> None:
    if winsound is not None:
        try:
            winsound.Beep(880, 70)
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# Region selection (transparent fullscreen overlay)
# --------------------------------------------------------------------------- #
def select_region() -> tuple[int, int, int, int] | None:
    """Drag a rectangle on a dimmed overlay. Returns screen bbox or None (Esc)."""
    import tkinter as tk

    vx, vy, cx, cy = virtual_screen()
    root = tk.Tk()
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    try:
        root.attributes("-alpha", 0.30)
    except tk.TclError:
        pass
    root.geometry(f"{cx}x{cy}+{vx}+{vy}")
    root.configure(bg="black")

    canvas = tk.Canvas(root, cursor="cross", bg="black", highlightthickness=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_text(
        cx // 2,
        28,
        fill="#cfe8ff",
        font=("Segoe UI", 15),
        text="拖曳選取截圖範圍　·　Esc 取消",
    )

    st: dict = {"x0": None, "y0": None, "rect": None, "region": None}

    def on_press(e: "tk.Event") -> None:
        st["x0"], st["y0"] = e.x, e.y
        st["rect"] = canvas.create_rectangle(
            e.x, e.y, e.x, e.y, outline="#3de8ff", width=2
        )

    def on_drag(e: "tk.Event") -> None:
        if st["rect"] is not None:
            canvas.coords(st["rect"], st["x0"], st["y0"], e.x, e.y)

    def on_release(e: "tk.Event") -> None:
        if st["x0"] is None:
            return
        left, right = sorted((st["x0"], e.x))
        top, bottom = sorted((st["y0"], e.y))
        if right - left < 5 or bottom - top < 5:  # accidental click: reset, try again
            if st["rect"] is not None:
                canvas.delete(st["rect"])
            st["x0"] = st["y0"] = st["rect"] = None
            return
        st["region"] = (vx + left, vy + top, vx + right, vy + bottom)
        root.destroy()

    def cancel(_e=None) -> None:
        st["region"] = None
        root.destroy()

    canvas.bind("<ButtonPress-1>", on_press)
    canvas.bind("<B1-Motion>", on_drag)
    canvas.bind("<ButtonRelease-1>", on_release)
    root.bind("<Escape>", cancel)
    root.focus_force()
    root.mainloop()
    return st["region"]


# --------------------------------------------------------------------------- #
# Capture
# --------------------------------------------------------------------------- #
def obsidian_name() -> str:
    now = datetime.now()
    return f"file-{now:%Y%m%d%H%M%S}{now.microsecond // 1000:03d}.png"


def save_region(region: tuple[int, int, int, int], outdir: Path) -> Path:
    img = ImageGrab.grab(bbox=region, all_screens=True)
    outdir.mkdir(parents=True, exist_ok=True)
    name = obsidian_name()
    path = outdir / name
    i = 1
    while path.exists():  # ms collision on very fast presses
        path = outdir / name.replace(".png", f"-{i}.png")
        i += 1
    img.save(path, "PNG")
    return path


def capture_loop(region: tuple[int, int, int, int], outdir: Path, do_beep: bool) -> str:
    """Listen globally: ENTER saves, R re-selects, ESC/Q quits. Returns the action."""
    from pynput import keyboard

    action = "quit"
    n = 0

    def on_press(key) -> bool | None:
        nonlocal action, n
        if key == keyboard.Key.enter:
            path = save_region(region, outdir)
            n += 1
            print(f"  [{n}] saved {path.name}")
            if do_beep:
                beep()
            return None
        if key == keyboard.Key.esc:
            action = "quit"
            return False
        ch = getattr(key, "char", None)
        if ch and ch.lower() == "r":
            action = "reselect"
            return False
        if ch and ch.lower() == "q":
            action = "quit"
            return False
        return None

    print(f"範圍已設定 {region}.  ENTER=截圖 · R=重選 · ESC/Q=結束")
    with keyboard.Listener(on_press=on_press) as listener:
        listener.join()
    return action


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Drag-select a region, then press ENTER to snap it repeatedly."
    )
    ap.add_argument(
        "-o",
        "--output",
        default="./captures",
        help="Folder to save into (default: ./captures).",
    )
    ap.add_argument(
        "--no-beep", action="store_true", help="Don't beep on each capture."
    )
    args = ap.parse_args(argv)

    if sys.platform != "win32":
        print("error: this tool is Windows-only.", file=sys.stderr)
        return 1

    enable_dpi_awareness()
    outdir = Path(args.output)
    print(f"輸出資料夾: {outdir.resolve()}")

    while True:
        print("請拖曳選取截圖範圍…")
        region = select_region()
        if region is None:
            print("已取消，結束。")
            return 0
        action = capture_loop(region, outdir, do_beep=not args.no_beep)
        if action == "quit":
            print("結束。")
            return 0
        # action == "reselect" -> loop back to select a new region


if __name__ == "__main__":
    raise SystemExit(main())
