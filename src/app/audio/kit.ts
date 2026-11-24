/**
 * The shared tools every sound layer is built from: noise that loops, the bubble
 * sounds, one-shot playback with a cap on how many play at once, and timers.
 */
import { MAX_VOICES } from "../../core/mix";
import type { Rng } from "../../core/rng";
import type { NoiseColor } from "../../core/settings";
import { bloop, bloopShapes, dropShape, noiseLoop } from "../../core/synth";

const NOISE_SECONDS = 4;
const NOISE_BLEND_SECONDS = 0.25;

/** The timer functions the audio code uses, so tests can supply their own. */
export type Timers = Pick<Window, "setTimeout" | "clearTimeout" | "setInterval" | "clearInterval">;

export interface Shot {
  readonly buffer: AudioBuffer;
  /** When to play, on the context's clock. */
  readonly at: number;
  /** Playback speed: 2 is an octave up. */
  readonly rate: number;
  readonly gain: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  readonly to: AudioNode;
}

export interface Tone {
  readonly hz: number;
  readonly at: number;
  readonly seconds: number;
  readonly gain: number;
  readonly pan: number;
  readonly to: AudioNode;
}

export interface SoundKit {
  readonly ctx: AudioContext;
  readonly rng: Rng;
  readonly timers: Timers;
  /** A looping noise buffer of the given colour, made the first time it is asked for. */
  readonly noise: (color: NoiseColor) => AudioBuffer;
  readonly bloops: readonly AudioBuffer[];
  readonly drop: AudioBuffer;
  /** Plays a buffer once, unless too many one-shots are already playing. */
  readonly playOnce: (shot: Shot) => void;
  /** Plays a soft bell-like tone once, under the same cap. */
  readonly playTone: (tone: Tone) => void;
}

function bufferOf(ctx: AudioContext, samples: Float32Array<ArrayBuffer>): AudioBuffer {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}

/** Sends a sound through a level and a left-right position to its destination. */
function route(ctx: AudioContext, gain: number, pan: number, to: AudioNode): GainNode {
  const level = ctx.createGain();
  level.gain.value = gain;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  level.connect(panner);
  panner.connect(to);
  return level;
}

export function createSoundKit(ctx: AudioContext, rng: Rng, timers: Timers): SoundKit {
  const noiseBuffers = new Map<NoiseColor, AudioBuffer>();
  let voices = 0;

  /** Counts a one-shot in, and out again when it ends. False when there is no room. */
  const claimVoice = (source: AudioScheduledSourceNode): boolean => {
    if (voices >= MAX_VOICES) return false;
    voices += 1;
    source.addEventListener("ended", () => {
      voices -= 1;
      source.disconnect();
    });
    return true;
  };

  return {
    ctx,
    rng,
    timers,
    noise(color) {
      const cached = noiseBuffers.get(color);
      if (cached) return cached;
      const length = Math.round(ctx.sampleRate * NOISE_SECONDS);
      const blend = Math.round(ctx.sampleRate * NOISE_BLEND_SECONDS);
      const made = bufferOf(ctx, noiseLoop(color, length, blend, rng) as Float32Array<ArrayBuffer>);
      noiseBuffers.set(color, made);
      return made;
    },
    bloops: bloopShapes(ctx.sampleRate).map((shape) =>
      bufferOf(ctx, bloop(shape) as Float32Array<ArrayBuffer>),
    ),
    drop: bufferOf(ctx, bloop(dropShape(ctx.sampleRate)) as Float32Array<ArrayBuffer>),
    playOnce(shot) {
      const source = ctx.createBufferSource();
      if (!claimVoice(source)) return;
      source.buffer = shot.buffer;
      source.playbackRate.value = shot.rate;
      source.connect(route(ctx, shot.gain, shot.pan, shot.to));
      source.start(shot.at);
    },
    playTone(tone) {
      const source = ctx.createOscillator();
      if (!claimVoice(source)) return;
      source.frequency.value = tone.hz;
      const level = route(ctx, 0, tone.pan, tone.to);
      // Struck softly, then ringing away.
      level.gain.setValueAtTime(0, tone.at);
      level.gain.linearRampToValueAtTime(tone.gain, tone.at + 0.03);
      level.gain.setTargetAtTime(0, tone.at + 0.03, tone.seconds / 5);
      source.connect(level);
      source.start(tone.at);
      source.stop(tone.at + tone.seconds);
    },
  };
}
