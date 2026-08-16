#!/usr/bin/env python3
"""Bouncy shop-walk bed: major, 122 BPM, kick/clap/ukulele. Fun, not a funeral."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from scipy.io import wavfile


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--duration", type=float, default=100.0)
    parser.add_argument("--sample-rate", type=int, default=44_100)
    parser.add_argument("--bpm", type=float, default=128.0)
    return parser.parse_args()


def env_fade(n: int, sr: int, duration: float) -> np.ndarray:
    t = np.arange(n) / sr
    fade_in = np.clip(t / 0.45, 0, 1)
    fade_out = np.clip((duration - t) / 1.8, 0, 1)
    return np.minimum(fade_in, fade_out)


def add_at(out: np.ndarray, sig: np.ndarray, i0: int) -> None:
    if i0 >= len(out) or i0 < 0:
        return
    length = min(len(sig), len(out) - i0)
    out[i0 : i0 + length] += sig[:length]


def pluck(sr: int, freq: float, amp: float, decay: float = 9.0, length_s: float = 0.45) -> np.ndarray:
    length = int(length_s * sr)
    tt = np.arange(length) / sr
    sig = (
        np.sin(2 * np.pi * freq * tt)
        + 0.22 * np.sin(2 * np.pi * freq * 2.004 * tt)
        + 0.10 * np.sin(2 * np.pi * freq * 3.01 * tt)
    )
    attack = np.minimum(tt / 0.004, 1.0)
    # Ukulele-ish short decay
    sig *= attack * np.exp(-decay * tt) * amp
    return sig


def kick(sr: int, amp: float = 0.32) -> np.ndarray:
    length = int(0.18 * sr)
    tt = np.arange(length) / sr
    freq = 140 * np.exp(-28 * tt) + 48
    click = np.exp(-120 * tt) * 0.22
    body = np.sin(2 * np.pi * freq * tt) * np.exp(-14 * tt)
    return (body + click) * amp


def clap(sr: int, amp: float, rng: np.random.Generator) -> np.ndarray:
    length = int(0.14 * sr)
    noise = rng.uniform(-1, 1, length)
    high = np.diff(noise, prepend=noise[0])
    tt = np.arange(length) / sr
    env = np.zeros(length)
    for delay, a in ((0.0, 1.0), (0.011, 0.65), (0.022, 0.4)):
        i = int(delay * sr)
        remain = length - i
        if remain <= 0:
            continue
        t2 = np.arange(remain) / sr
        env[i:] += a * np.exp(-52 * t2)
    return high * env * amp


def hat(sr: int, amp: float, rng: np.random.Generator, open_hat: bool = False) -> np.ndarray:
    length = int((0.09 if open_hat else 0.04) * sr)
    noise = rng.uniform(-1, 1, length)
    bright = np.diff(noise, prepend=noise[0])
    tt = np.arange(length) / sr
    decay = 38 if open_hat else 90
    return bright * np.exp(-decay * tt) * amp


def render(output: Path, duration: float, sample_rate: int, bpm: float) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    n = int(sample_rate * duration)
    beat = 60.0 / bpm
    rng = np.random.default_rng(4)
    mix = np.zeros(n, dtype=np.float64)

    # C G Am F: sunny loop
    roots = [130.81, 196.00, 220.00, 174.61]
    chords = [
        (261.63, 329.63, 392.00, 523.25),  # C
        (196.00, 246.94, 293.66, 392.00),  # G
        (220.00, 261.63, 329.63, 440.00),  # Am
        (174.61, 220.00, 261.63, 349.23),  # F
    ]
    hook = [523.25, 587.33, 659.25, 523.25, 698.46, 659.25, 587.33, 523.25]

    bar = beat * 4
    t = 0.0
    bar_i = 0
    while t < duration + bar:
        chord = chords[bar_i % 4]
        root = roots[bar_i % 4]
        bounce = 0.55 if t < 5.0 else 1.0
        extra = 0.0 if t < 18.0 else min(1.0, (t - 18.0) / 8.0)
        swing = beat * 0.04

        # Four-on-the-floor light kick
        for k in range(4):
            add_at(mix, kick(sample_rate, (0.20 + 0.06 * extra) * bounce), int((t + beat * k) * sample_rate))

        # Clap 2 and 4
        add_at(mix, clap(sample_rate, 0.14 + 0.08 * extra, rng), int((t + beat) * sample_rate))
        add_at(mix, clap(sample_rate, 0.14 + 0.08 * extra, rng), int((t + beat * 3) * sample_rate))

        # Bass on 1 and the 'and' of 2
        add_at(mix, pluck(sample_rate, root, 0.18 * bounce, decay=4.2, length_s=0.55), int(t * sample_rate))
        add_at(
            mix,
            pluck(sample_rate, root * 1.125, 0.10 * bounce, decay=5.5, length_s=0.28),
            int((t + beat * 1.5) * sample_rate),
        )

        # Ukulele chucks: muted offbeats, ringing downs
        chuck = [0, 1, 2, 1, 0, 2, 1, 3]
        for step, idx in enumerate(chuck):
            delay = step * (beat / 2) + (swing if step % 2 else 0)
            muted = step % 2 == 1
            add_at(
                mix,
                pluck(
                    sample_rate,
                    chord[idx],
                    (0.07 if muted else 0.11) * bounce + 0.03 * extra,
                    decay=14.0 if muted else 8.0,
                    length_s=0.22 if muted else 0.4,
                ),
                int((t + delay) * sample_rate),
            )

        # Hats 16ths, open on the last 'and'
        for s in range(8):
            delay = s * (beat / 2) + (swing if s % 2 else 0)
            open_hat = s == 7
            amp = (0.028 + 0.02 * extra) * (1.2 if s % 2 == 0 else 0.75)
            add_at(mix, hat(sample_rate, amp, rng, open_hat), int((t + delay) * sample_rate))

        # Whistle-high hook, always on so the bed feels like a tune
        note = hook[bar_i % len(hook)]
        add_at(
            mix,
            pluck(sample_rate, note, 0.13 + 0.05 * extra, decay=5.4, length_s=0.62),
            int((t + beat * 0.5) * sample_rate),
        )
        add_at(
            mix,
            pluck(sample_rate, note * 1.5, 0.08 + 0.04 * extra, decay=6.2, length_s=0.4),
            int((t + beat * 2.5 + swing) * sample_rate),
        )
        # Answer phrase an octave up on the last beat
        add_at(
            mix,
            pluck(sample_rate, hook[(bar_i + 3) % len(hook)] * 2, 0.06 + 0.03 * extra, decay=8.0, length_s=0.28),
            int((t + beat * 3.5) * sample_rate),
        )

        t += bar
        bar_i += 1

    mix *= env_fade(n, sample_rate, duration)
    # Brighten the whole bed so it isn't muddy
    high = np.diff(mix, prepend=mix[0])
    mix = mix * 0.88 + high * 0.14
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * 0.88
    stereo = np.column_stack([mix * 0.96, mix * 1.04])
    pcm = np.clip(stereo * 32767, -32767, 32767).astype(np.int16)
    wavfile.write(str(output), sample_rate, pcm)


def main() -> None:
    args = parse_args()
    if args.duration <= 0 or args.sample_rate <= 0 or args.bpm <= 0:
        raise SystemExit("duration, sample rate, and BPM must be positive")
    render(args.output, args.duration, args.sample_rate, args.bpm)
    print(f"generated {args.output} ({args.duration:.2f}s @ {args.bpm} bpm)")


if __name__ == "__main__":
    main()
