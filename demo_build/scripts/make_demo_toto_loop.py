#!/usr/bin/env python3
"""Last 2s of the cloud-free Toto clip, studio washed to #F6F3EE, cropped on the dog."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import (
    binary_dilation,
    binary_fill_holes,
    binary_propagation,
    gaussian_filter,
)

SRC = Path("/home/shiwani/a/code/toto/demo_build/public/remove_the_text_cloud_above_th.mp4")
OUT = Path("/home/shiwani/a/code/toto/demo_build/public/toto")
FRAMES = Path("/tmp/toto-anim/loop-src")
CLEAN = Path("/tmp/toto-anim/loop-cream")
FPS = 12
TARGET = np.array([0xF6, 0xF3, 0xEE], dtype=np.float32)
# Keep tail + paws; trim empty space toward the talk bubble (right).
CROP = (348, 168, 968, 720)  # x0,y0,x1,y1 -> 620x552


def cream_studio(src: np.ndarray) -> np.ndarray:
    h, w, _ = src.shape
    r, g, b = src[:, :, 0], src[:, :, 1], src[:, :, 2]
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    fur = (chroma > 62) & (r > b + 18)
    dark = luma < 78
    body = binary_fill_holes(binary_dilation(fur | dark, iterations=1))
    protected = body | fur | dark
    beige = np.median(src[20:90, 20:90].reshape(-1, 3), axis=0)
    dist = np.linalg.norm(src - beige, axis=2)
    near = (dist < 70) & ~protected
    border = np.zeros((h, w), dtype=bool)
    border[0, :] = True
    border[-1, :] = True
    border[:, 0] = True
    border[:, -1] = True
    studio = binary_propagation(border & near, mask=near)
    studio |= ((chroma < 52) & (luma > 120) & ~protected)
    bottom = np.zeros((h, w), dtype=bool)
    bottom[int(h * 0.72) :, :] = True
    studio |= bottom & ~protected
    halo = binary_dilation(protected, iterations=8) & ~protected & (chroma < 52)
    studio |= halo
    studio &= ~protected

    alpha = gaussian_filter(studio.astype(np.float32), sigma=0.7)
    alpha = np.clip(np.where(protected, 0, alpha), 0, 1)[..., None]
    out = src * (1 - alpha) + TARGET * alpha

    ys, xs = np.where(protected)
    if len(xs):
        cx = float(np.median(xs))
        y_bot = float(np.percentile(ys, 97))
        rx = max(50.0, (int(xs.max()) - int(xs.min())) * 0.26)
        ry = 14.0
        yy, xx = np.ogrid[:h, :w]
        ell = ((xx - cx) / rx) ** 2 + ((yy - (y_bot + 3)) / ry) ** 2
        sh = gaussian_filter(np.clip(1.0 - ell, 0, 1), sigma=5) * 0.05
        sh = sh * (1.0 - protected.astype(np.float32))
        out = out * (1 - sh[..., None]) + (TARGET * 0.96) * sh[..., None]

    x0, y0, x1, y1 = CROP
    plate = np.clip(out, 0, 255)[y0:y1, x0:x1]
    body_c = protected[y0:y1, x0:x1]
    pr, pg, pb = plate[:, :, 0], plate[:, :, 1], plate[:, :, 2]
    pc = np.maximum(np.maximum(pr, pg), pb) - np.minimum(np.minimum(pr, pg), pb)
    pl = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb
    snap = (pc < 40) & (pl > 125) & ~body_c
    plate = plate.copy()
    plate[snap] = TARGET
    return np.clip(plate, 0, 255).astype(np.uint8)


def main() -> int:
    FRAMES.mkdir(parents=True, exist_ok=True)
    CLEAN.mkdir(parents=True, exist_ok=True)
    for p in FRAMES.glob("*.png"):
        p.unlink()
    for p in CLEAN.glob("*.png"):
        p.unlink()
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-i", str(SRC), "-ss", "8.00", "-t", "2.00",
            "-vf", f"fps={FPS}", str(FRAMES / "n%03d.png"),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    paths = sorted(FRAMES.glob("n*.png"))
    if not paths:
        raise SystemExit("no frames extracted")
    for i, p in enumerate(paths, 1):
        im = np.array(Image.open(p).convert("RGB"), dtype=np.float32)
        Image.fromarray(cream_studio(im)).save(CLEAN / f"c{i:03d}.png")

    OUT.mkdir(parents=True, exist_ok=True)
    loop_dir = OUT / "loop"
    if loop_dir.exists():
        shutil.rmtree(loop_dir)
    loop_dir.mkdir()
    for p in sorted(CLEAN.glob("c*.png")):
        shutil.copy2(p, loop_dir / p.name)
    shutil.copy2(CLEAN / "c001.png", OUT / "demo-still.png")
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(CLEAN / "c%03d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-an",
            "-movflags", "+faststart", str(OUT / "demo-loop.mp4"),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    still = Image.open(OUT / "demo-still.png")
    print("wrote", loop_dir, "and", OUT / "demo-loop.mp4", "frames", len(paths), "size", still.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
