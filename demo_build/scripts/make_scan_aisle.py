#!/usr/bin/env python3
"""Composite sample-barcodes.pdf into the scan viewfinder (replace fake green camera)."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "sample-barcodes.pdf"
SCAN = ROOT / "screenshots" / "scan.png"
OUT = ROOT / "screenshots" / "scan-aisle.png"


def rasterize_pages(pdf: Path, dest: Path) -> list[Path]:
    dest.mkdir(parents=True, exist_ok=True)
    prefix = dest / "page"
    subprocess.check_call(
        ["pdftoppm", "-png", "-r", "140", str(pdf), str(prefix)]
    )
    pages = sorted(dest.glob("page-*.png"))
    if not pages:
        raise SystemExit("pdftoppm produced no pages")
    return pages


def shelf_from_pages(pages: list[Path], target_w: int) -> Image.Image:
    images: list[Image.Image] = []
    for path in pages:
        im = Image.open(path).convert("RGB")
        # Drop the demo-book footer strip so the phone shows product + barcodes.
        crop_h = int(im.height * 0.90)
        im = im.crop((0, 0, im.width, crop_h))
        scale = target_w / im.width
        im = im.resize((target_w, max(1, int(im.height * scale))), Image.LANCZOS)
        images.append(im)
    gap = 18
    pad = 16
    height = pad * 2 + sum(im.height for im in images) + gap * (len(images) - 1)
    shelf = Image.new("RGB", (target_w, height), (52, 44, 38))
    y = pad
    for im in images:
        shelf.paste(im, (0, y))
        y += im.height + gap
    return shelf


def composite(scan_path: Path, shelf: Image.Image, out_path: Path) -> None:
    scan = Image.open(scan_path).convert("RGBA")
    arr = np.array(scan)
    rgb = arr[:, :, :3].astype(np.int16)
    fill = (np.abs(rgb[:, :, 0] - 0) <= 8) & (np.abs(rgb[:, :, 1] - 135) <= 12) & (
        np.abs(rgb[:, :, 2] - 0) <= 8
    )
    # Frozen scan-sweep wedge looks like a broken green screen. Punch it too.
    radar = (rgb[:, :, 1] > 200) & (rgb[:, :, 0] < 140) & (rgb[:, :, 2] < 80)
    fill = fill | radar
    ys, xs = np.where(fill)
    if len(ys) < 1000:
        raise SystemExit("could not find fake camera green in scan.png")
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    vw, vh = x1 - x0 + 1, y1 - y0 + 1

    scale = max(vw / shelf.width, vh / shelf.height) * 1.08
    sw, sh = max(vw, int(shelf.width * scale)), max(vh, int(shelf.height * scale))
    fitted = shelf.resize((sw, sh), Image.LANCZOS)
    cx = max(0, (sw - vw) // 2)
    cy = max(0, int((sh - vh) * 0.18))
    crop = fitted.crop((cx, cy, cx + vw, cy + vh)).convert("RGBA")
    crop_a = np.array(crop)

    region = arr[y0 : y1 + 1, x0 : x1 + 1]
    mask = fill[y0 : y1 + 1, x0 : x1 + 1]
    region[mask] = crop_a[mask]
    arr[y0 : y1 + 1, x0 : x1 + 1] = region
    Image.fromarray(arr).save(out_path, "PNG")
    print(f"Wrote {out_path} viewfinder {vw}x{vh}")


def main() -> int:
    if not PDF.exists():
        raise SystemExit(f"missing {PDF}")
    if not SCAN.exists():
        raise SystemExit(f"missing {SCAN}")
    with tempfile.TemporaryDirectory() as tmp:
        pages = rasterize_pages(PDF, Path(tmp))
        shelf = shelf_from_pages(pages, target_w=1400)
        composite(SCAN, shelf, OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
