// Shared constants for the WebGL piano roll

// MIDI range: 21 (A0) through 108 (C8) = 88 keys
export const MIN_PITCH = 21;
export const MAX_PITCH = 108;
export const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1; // 88

// How many seconds of notes are visible falling
export const VISIBLE_SECONDS = 6;

// The fraction of the viewport height reserved for the keyboard
export const KEYBOARD_HEIGHT_FRACTION = 0.2;

// Pre-computed black key lookup
export const IS_BLACK = new Uint8Array(128);
for (let p = 0; p < 128; p++) {
  const cls = p % 12;
  IS_BLACK[p] =
    cls === 1 || cls === 3 || cls === 6 || cls === 8 || cls === 10 ? 1 : 0;
}
