// Toto's signature sound design. Built entirely with Web Audio synthesis —
// no asset downloads, no bundle cost, works offline.
//
// Design language:
//   * "found" plays a 3-note major-triad arpeggio (C5 → E5 → G5) with a
//     soft sine timbre and a short tail. Reads as a small "yes."
//   * "off-list" plays a single muted tone — heard but not celebrated.
//   * "added" plays a quick two-note rising blip (E5 → G5) for when a
//     swipe-add lands.
//   * "complete" plays a fuller four-note arpeggio + soft sustained
//     chord, for the wrap-up screen.
//
// All synths share the same envelope shape (fast attack, exponential
// decay) so they feel like one instrument with different phrases.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  return ctx;
}

function note(freq: number, startAt: number, durSec = 0.22, gain = 0.12): void {
  const a = getCtx();
  if (!a) return;
  const osc = a.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(gain, startAt + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + durSec);
  osc.connect(g).connect(a.destination);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.02);
}

// Frequencies of notes in equal temperament (A4 = 440Hz reference).
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5;

/** "Found it" — a 3-note major arpeggio. The Toto signature. */
export function playFound(): void {
  const a = getCtx(); if (!a) return;
  const t = a.currentTime;
  note(C5, t + 0.00, 0.20);
  note(E5, t + 0.07, 0.22);
  note(G5, t + 0.14, 0.30);
}

/** "Off the list" — single soft tone, brief, low. */
export function playOff(): void {
  const a = getCtx(); if (!a) return;
  note(D5, a.currentTime, 0.16, 0.08);
}

/** "Added to list" — quick two-note rise. */
export function playAdded(): void {
  const a = getCtx(); if (!a) return;
  const t = a.currentTime;
  note(E5, t + 0.00, 0.14, 0.10);
  note(G5, t + 0.06, 0.20, 0.10);
}

/** "Complete" — full arpeggio + sustained chord. For done-screen all-found. */
export function playComplete(): void {
  const a = getCtx(); if (!a) return;
  const t = a.currentTime;
  note(C5, t + 0.00, 0.18, 0.10);
  note(E5, t + 0.08, 0.18, 0.10);
  note(G5, t + 0.16, 0.18, 0.10);
  note(C6, t + 0.24, 0.34, 0.12);
  // Sustained background chord — adds richness.
  note(C5, t + 0.30, 0.6, 0.05);
  note(E5, t + 0.30, 0.6, 0.04);
  note(G5, t + 0.30, 0.6, 0.04);
}

/** Soft warning chirp — for "didn't catch that" / errors. */
export function playOops(): void {
  const a = getCtx(); if (!a) return;
  const t = a.currentTime;
  note(A5, t + 0.00, 0.10, 0.07);
  note(D5, t + 0.10, 0.16, 0.07);
}
