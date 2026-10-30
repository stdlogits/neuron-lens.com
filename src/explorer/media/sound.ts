// Sound for the media tiles. Everything plays through playOnly (lib/media.ts), so one sound plays at
// a time across the page; the optimised frame is turned into a short WAV for it.
import { frameSamples, playOnly } from "../../lib/media";

const RATE = 16000;
/** The model heard the optimised 40 ms frame in each of its 64 audio slots: 2.56 s. */
export const FRAME_REPEATS = 64;

/** The optimised frame tiled as the model heard it, quietened and faded at the ends, as a WAV blob URL. */
export function frameWav(wave: string): { url: string; seconds: number } {
  const frame = frameSamples(wave);
  const count = frame.length * FRAME_REPEATS;
  const samples = new Float32Array(count);
  for (let i = 0; i < FRAME_REPEATS; i += 1) samples.set(frame, i * frame.length);
  // Fade the ends so it starts and stops without a click; keep it quiet.
  const fade = Math.min(400, count >> 2);
  for (let i = 0; i < fade; i += 1) { samples[i] *= i / fade; samples[count - 1 - i] *= i / fade; }
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (at: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(at + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i += 1) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * 0.35)) * 32767, true);
  return { url: URL.createObjectURL(new Blob([buffer], { type: "audio/wav" })), seconds: count / RATE };
}

/** One period of the frame as an SVG path across a width × height box. */
export function framePath(wave: string, width = 160, height = 40, points = 160): string {
  const frame = frameSamples(wave);
  let peak = 1e-6;
  for (const v of frame) peak = Math.max(peak, Math.abs(v));
  const mid = height / 2;
  let d = "";
  for (let i = 0; i < points; i += 1) {
    const v = frame[Math.floor((i / points) * frame.length)] / peak;
    d += `${i ? "L" : "M"}${((i / (points - 1)) * width).toFixed(1)} ${(mid - v * mid * 0.9).toFixed(1)}`;
  }
  return d;
}

/** A clip's length in seconds, read from its metadata. */
export function clipSeconds(url: string): Promise<number> {
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
    probe.onerror = () => resolve(0);
    probe.src = url;
  });
}

/**
 * Plays a sound, stopping any other on the page. `onstart` gets its length once known (for a calm
 * progress fill); `onstop` runs when it ends, is stopped, or another sound starts.
 */
export function play(url: string, seconds: number | Promise<number>, onstart: (seconds: number) => void, onstop: () => void): () => void {
  let stopped = false;
  const stop = playOnly(url, () => { stopped = true; onstop(); });
  void Promise.resolve(seconds).then((s) => { if (!stopped) onstart(s); });
  return stop;
}
