#!/usr/bin/env python3
"""Real puppy bark from Freesound, CC0.

Source: https://freesound.org/people/AntumDeluge/sounds/583142/
AntumDeluge, based on moffet. Public domain (CC0). No pitch shift.
"""

from __future__ import annotations

import subprocess
import urllib.request
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sfx"
FIXTURES = ROOT / "fixtures"
SRC_MP3 = FIXTURES / "puppy-bark-src.mp3"
SRC_URL = "https://cdn.freesound.org/previews/583/583142_3403708-hq.mp3"
SR = 44_100


def fetch_source() -> Path:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    if SRC_MP3.exists() and SRC_MP3.stat().st_size > 8_000:
        return SRC_MP3
    req = urllib.request.Request(SRC_URL, headers={"User-Agent": "TotoDemo/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res, SRC_MP3.open("wb") as f:
        f.write(res.read())
    return SRC_MP3


def load_mono() -> np.ndarray:
    wav = FIXTURES / "puppy-bark-src.wav"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(fetch_source()),
            "-ac",
            "1",
            "-ar",
            str(SR),
            str(wav),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    sr, data = wavfile.read(wav)
    if sr != SR:
        raise SystemExit(f"unexpected rate {sr}")
    mono = data.astype(np.float32)
    if mono.ndim > 1:
        mono = mono.mean(axis=1)
    peak = np.max(np.abs(mono)) or 1.0
    return mono / peak


def slice_clip(mono: np.ndarray, start: float, end: float) -> np.ndarray:
    a = int(start * SR)
    b = int(end * SR)
    clip = mono[a:b].copy()
    fade = min(int(0.012 * SR), len(clip) // 4)
    if fade:
        clip[:fade] *= np.linspace(0, 1, fade)
        clip[-fade:] *= np.linspace(1, 0, fade)
    return clip


def write(name: str, mono: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    peak = np.max(np.abs(mono)) or 1.0
    mono = mono / peak * 0.42
    stereo = np.column_stack([mono * 0.98, mono * 1.02])
    pcm = np.clip(stereo * 32767, -32767, 32767).astype(np.int16)
    wavfile.write(str(OUT / name), SR, pcm)
    print(f"  {name} dur={len(mono)/SR:.2f}s")


def main() -> None:
    src = load_mono()
    write("bark-hello.wav", slice_clip(src, 0.08, 0.28))
    write("bark-yes.wav", slice_clip(src, 0.58, 0.84))
    write("bark-good.wav", slice_clip(src, 0.08, 0.86))
    print(f"wrote CC0 puppy bark clips to {OUT}")


if __name__ == "__main__":
    main()
