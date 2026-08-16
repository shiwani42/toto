#!/usr/bin/env python3
"""Walk-in plate: Toto on the app parchment so the canvas is invisible."""

from __future__ import annotations

import subprocess
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "A_cinematic_slow_motion_shot.mp4"
FRAMES = Path("/tmp/toto-v3")
OUT = ROOT / "public" / "toto"
FILM = ROOT / "demo_build" / "public" / "toto"
CROP_W = 620
FPS = 12
ENTER_START = 4.45
ENTER_END = 7.15
# Studio cream from the clip, so leftover pixels vanish into the plate.
PAPER = (228, 222, 213)
CANVAS = (780, 440)


def extract() -> list[Path]:
    FRAMES.mkdir(parents=True, exist_ok=True)
    existing = sorted(FRAMES.glob("f*.png"))
    if len(existing) >= 20:
        return existing
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-ss", str(ENTER_START), "-i", str(SRC),
            "-t", str(ENTER_END - ENTER_START), "-vf", f"fps={FPS}",
            str(FRAMES / "f%03d.png"),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return sorted(FRAMES.glob("f*.png"))


def flood_bg(rgb: np.ndarray) -> np.ndarray:
    img = rgb[:, :CROP_W]
    h, w = img.shape[:2]
    bg = img[12, w - 12].astype(np.float32)
    diff = np.linalg.norm(img.astype(np.float32) - bg, axis=2)
    similar = diff < 42
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if similar[y, x]:
                q.append((y, x)); visited[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if similar[y, x] and not visited[y, x]:
                q.append((y, x)); visited[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and similar[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    alpha = ((~visited).astype(np.float32) * 255.0)
    a = np.array(Image.fromarray(alpha.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.8)))
    a = np.where(a < 40, 0, np.where(a < 90, (a - 40) * (255 / 50), a))
    return np.clip(a, 0, 255).astype(np.uint8)


def cut(path: Path) -> Image.Image:
    rgb = np.array(Image.open(path).convert("RGB"))
    a = flood_bg(rgb)
    return Image.fromarray(np.dstack([rgb[:, : a.shape[1]], a]), "RGBA")


def tight(im: Image.Image, pad: int = 8) -> Image.Image:
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 24)
    if len(xs) == 0:
        return im
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(im.width, int(xs.max()) + pad + 1),
        min(im.height, int(ys.max()) + pad + 1),
    )
    return im.crop(box)


def plate(dog: Image.Image, x: int) -> Image.Image:
    paper = Image.new("RGB", CANVAS, PAPER)
    y = CANVAS[1] - dog.height - 8
    paper.paste(dog, (max(0, x), max(0, y)), dog)
    arr = np.array(paper).astype(np.float32)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    bright = (r + g + b) / 3 > 175
    is_cream = (chroma < 40) & bright
    arr[is_cream] = np.array(PAPER, dtype=np.float32)
    return Image.fromarray(arr.astype(np.uint8))


def face_crop(im: Image.Image, size: int) -> Image.Image:
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 40)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    head_h = int((y1 - y0) * 0.58)
    head = im.crop((max(0, x0 - 10), max(0, y0 - 10), min(im.width, x1 + 10), min(im.height, y0 + head_h + 10)))
    side = max(head.width, head.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(head, ((side - head.width) // 2, (side - head.height) // 2), head)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def main() -> int:
    paths = extract()
    cuts = [cut(p) for p in paths]
    usable = []
    for im in cuts:
        if (np.array(im.split()[-1]) > 40).sum() > 2500:
            usable.append(im)
    dogs = [tight(im) for im in usable]
    # Scale dogs to a shared height so the walk doesn't bounce.
    target_h = 400
    scaled = []
    for d in dogs:
        nh = target_h
        nw = max(1, int(d.width * nh / d.height))
        scaled.append(d.resize((nw, nh), Image.Resampling.LANCZOS))

    x0s = []
    for im in usable:
        found = np.where(np.array(im.split()[-1]) > 24)[1]
        x0s.append(int(found.min()) if len(found) else 0)
    origin = int(x0s[0] * (CANVAS[0] / CROP_W))
    walked = [max(0, int(x0 * (CANVAS[0] / CROP_W)) - origin) for x0 in x0s]
    sit_w = scaled[-1].width
    target_left = (CANVAS[0] - sit_w) // 2
    extra = target_left - walked[-1]
    n = max(len(scaled) - 1, 1)
    plates = []
    for i, (d, x) in enumerate(zip(scaled, walked)):
        t = i / n
        t = t * t * (3 - 2 * t)
        plates.append(plate(d, max(0, x + int(extra * t))))

    seq = Path("/tmp/toto-v3/plate")
    seq.mkdir(exist_ok=True)
    for i, im in enumerate(plates, 1):
        im.save(seq / f"p{i:03d}.png")

    OUT.mkdir(parents=True, exist_ok=True)
    FILM.mkdir(parents=True, exist_ok=True)

    last = plates[-1]
    last.save(OUT / "sit-plate.png", optimize=True)
    tight(usable[-1]).resize((400, int(400 * tight(usable[-1]).height / tight(usable[-1]).width)), Image.Resampling.LANCZOS).save(OUT / "sit.png")
    wink_src = Path("/tmp/toto-cine")
    fulls = sorted(wink_src.glob("full*.png"))
    wink_cut = tight(cut(fulls[min(40, len(fulls) - 1)]))
    wink_cut.resize((400, int(400 * wink_cut.height / wink_cut.width)), Image.Resampling.LANCZOS).save(OUT / "wink.png")
    face_crop(usable[-1], 192).save(OUT / "face.png", optimize=True)

    webm = OUT / "enter.webm"
    mp4 = OUT / "enter.mp4"
    subprocess.check_call([
        "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(seq / "p%03d.png"),
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "28",
        "-an", str(webm),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.check_call([
        "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(seq / "p%03d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-an",
        "-movflags", "+faststart", str(mp4),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    plates[0].save(
        OUT / "enter.webp",
        save_all=True,
        append_images=plates[1:],
        duration=int(1000 / FPS),
        loop=1,
        quality=82,
        method=4,
    )

    for name in ("sit.png", "wink.png", "face.png", "sit-plate.png", "enter.webm", "enter.mp4", "enter.webp"):
        src = OUT / name
        if src.exists():
            (FILM / name).write_bytes(src.read_bytes())
            print(name, src.stat().st_size)
    print(f"frames={len(plates)} canvas={CANVAS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
