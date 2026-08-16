#!/usr/bin/env python3
"""Build and render the live Toto plates in Blender 5.2 VSE.

Shot list matches the Omni brief: empty room first, calm human,
real app stills full-frame, VO only over those stills.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import bpy

ROOT = Path("/home/shiwani/a/code/toto/demo_build")
REFS = ROOT / "blender" / "refs"
OUT_DIR = ROOT / "blender" / "out"
BLEND = ROOT / "blender" / "toto-live.blend"
FPS = 30
W, H = 1920, 1080


def frames(seconds: float) -> int:
    return int(round(seconds * FPS))


def fit_scale(path: Path, mode: str) -> float:
    img = bpy.data.images.load(str(path), check_existing=True)
    iw, ih = max(img.size[0], 1), max(img.size[1], 1)
    if mode == "contain":
        return min(W / iw, H / ih) * 0.92
    return max(W / iw, H / ih) * 1.02


def ken_burns(strip, scale0: float, scale1: float, start: int, length: int) -> None:
    t = strip.transform
    t.scale_x = scale0
    t.scale_y = scale0
    t.keyframe_insert("scale_x", frame=start)
    t.keyframe_insert("scale_y", frame=start)
    t.scale_x = scale1
    t.scale_y = scale1
    t.keyframe_insert("scale_x", frame=start + length - 1)
    t.keyframe_insert("scale_y", frame=start + length - 1)


def add_image(se, name: str, path: Path, channel: int, start: int, length: int, mode="cover"):
    strip = se.strips.new_image(name, str(path), channel, start)
    strip.frame_final_duration = length
    base = fit_scale(path, mode)
    if mode == "cover":
        ken_burns(strip, base, base * 1.05, start, length)
    else:
        strip.transform.scale_x = base
        strip.transform.scale_y = base
    return strip


def add_sound(se, name: str, path: Path, channel: int, start: int, volume: float = 1.0):
    strip = se.strips.new_sound(name, str(path), channel, start)
    if hasattr(strip, "volume"):
        strip.volume = volume
    return strip


def configure_render(scene, dest: Path, end: int) -> Path:
    frames_dir = dest.parent / "frames"
    if frames_dir.exists():
        for p in frames_dir.glob("*.png"):
            p.unlink()
    frames_dir.mkdir(parents=True, exist_ok=True)
    scene.render.resolution_x = W
    scene.render.resolution_y = H
    scene.render.fps = FPS
    scene.render.fps_base = 1
    scene.frame_start = 1
    scene.frame_end = end
    scene.render.filepath = str(frames_dir / "f")
    scene.render.image_settings.file_format = "PNG"
    scene.render.use_file_extension = True
    return frames_dir


def build() -> int:
    scene = bpy.context.scene
    se = scene.sequence_editor_create()
    for strip in list(se.strips):
        se.strips.remove(strip)

    shots = [
        ("mountain", REFS / "outing.jpg", 3.0, "cover"),
        ("empty", REFS / "empty-rack.jpg", 3.0, "cover"),
        ("shopper", REFS / "shopper.jpg", 4.0, "cover"),
        ("list", REFS / "plan-swipe.png", 3.5, "contain"),
        ("scan", REFS / "scan-aisle.png", 3.5, "contain"),
        ("shopper2", REFS / "shopper.jpg", 2.0, "cover"),
        ("boutique", REFS / "boutique.jpg", 3.0, "cover"),
        ("after", REFS / "after-hours.jpg", 3.0, "cover"),
        ("dash", REFS / "dashboard-owner.png", 4.0, "contain"),
        ("qr", REFS / "dashboard-qr.png", 3.0, "contain"),
    ]

    total = frames(sum(s[2] for s in shots))
    bg = se.strips.new_effect("paper", "COLOR", 1, 1, length=total)
    bg.color = (0.937, 0.902, 0.839)

    cursor = 1
    for name, path, seconds, mode in shots:
        length = frames(seconds)
        add_image(se, name, path, 2, cursor, length, mode=mode)
        cursor += length

    end = cursor - 1

    vo_trip = ROOT / "public" / "voice" / "v4-03-trip.wav"
    vo_owner = ROOT / "public" / "voice" / "v4-08-owner.wav"
    score = ROOT / "public" / "score.wav"
    # VO only over the real screens (list+scan, then dash)
    list_start = 1 + frames(3 + 3 + 4)
    dash_start = 1 + frames(3 + 3 + 4 + 3.5 + 3.5 + 2 + 3 + 3)
    add_sound(se, "vo-trip", vo_trip, 3, list_start, 1.0)
    add_sound(se, "vo-owner", vo_owner, 4, dash_start, 1.0)
    if score.exists():
        add_sound(se, "score", score, 5, 1, 0.12)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / "toto-live.mp4"
    frames_dir = configure_render(scene, dest, end)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.render.render(animation=True)

    vo_trip_at = (list_start - 1) / FPS
    vo_owner_at = (dash_start - 1) / FPS
    dur = end / FPS
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-start_number",
            "1",
            "-i",
            str(frames_dir / "f%04d.png"),
            "-itsoffset",
            f"{vo_trip_at:.3f}",
            "-i",
            str(vo_trip),
            "-itsoffset",
            f"{vo_owner_at:.3f}",
            "-i",
            str(vo_owner),
            "-i",
            str(score),
            "-filter_complex",
            f"[1:a]volume=1[v1];[2:a]volume=1[v2];[3:a]volume=0.10,atrim=0:{dur:.2f},asetpts=PTS-STARTPTS[sc];[v1][v2][sc]amix=inputs=3:duration=longest:dropout_transition=2,apad=pad_dur={dur:.2f}[a]",
            "-map",
            "0:v",
            "-map",
            "[a]",
            "-t",
            f"{dur:.2f}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-c:a",
            "aac",
            str(dest),
        ]
    )
    print(f"Wrote {dest} frames=1..{end} ({dur:.1f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(build())
