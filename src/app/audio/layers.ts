/**
 * The eight sound layers. Each is a small factory that builds its sound from the
 * kit, plays into the node it is given, and hands back how to stop it.
 */
import { bloopRate } from "../../core/mix";
import type { LayerId, Settings } from "../../core/settings";
import { CHIME_HZ } from "../../core/synth";
import type { SoundKit } from "./kit";

export interface Layer {
  readonly stop: () => void;
  /** Called when settings change, for layers that follow them. */
  readonly update: (settings: Settings) => void;
}

export type LayerFactory = (kit: SoundKit, out: AudioNode, settings: Settings) => Layer;

/** How far ahead of the clock one-shot sounds are lined up, and how often. */
const LOOKAHEAD_SECONDS = 0.3;
const SCHEDULE_MS = 100;

type Stop = () => void;
const ignore = (): void => undefined;

/** A noise buffer playing round and round at a level. */
function loop(kit: SoundKit, buffer: AudioBuffer, out: AudioNode, gain: number): Stop {
  const source = kit.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const level = kit.ctx.createGain();
  level.gain.value = gain;
  source.connect(level);
  level.connect(out);
  source.start();
  return () => {
    source.stop();
    level.disconnect();
  };
}

function filter(kit: SoundKit, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const node = kit.ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = hz;
  node.Q.value = q;
  return node;
}

/** A steady tone at a level. */
function tone(kit: SoundKit, type: OscillatorType, hz: number, gain: number, out: AudioNode): Stop {
  const source = kit.ctx.createOscillator();
  source.type = type;
  source.frequency.value = hz;
  const level = kit.ctx.createGain();
  level.gain.value = gain;
  source.connect(level);
  level.connect(out);
  source.start();
  return () => {
    source.stop();
    level.disconnect();
  };
}

/** A slow wave that moves another setting up and down by `depth`. */
function sway(kit: SoundKit, hz: number, depth: number, target: AudioParam): Stop {
  const source = kit.ctx.createOscillator();
  source.frequency.value = hz;
  const amount = kit.ctx.createGain();
  amount.gain.value = depth;
  source.connect(amount);
  amount.connect(target);
  source.start();
  return () => {
    source.stop();
    amount.disconnect();
  };
}

/** Calls `fire` at random moments, `rate()` times a second on average, slightly ahead of time. */
function scatter(kit: SoundKit, rate: () => number, fire: (at: number) => void): Stop {
  let owed = 0;
  let scheduledTo = kit.ctx.currentTime;
  const handle = kit.timers.setInterval(() => {
    const from = Math.max(scheduledTo, kit.ctx.currentTime);
    const to = kit.ctx.currentTime + LOOKAHEAD_SECONDS;
    if (to <= from) return;
    owed += rate() * (to - from);
    for (; owed >= 1; owed -= 1) fire(kit.rng.range(from, to));
    scheduledTo = to;
  }, SCHEDULE_MS);
  return () => {
    kit.timers.clearInterval(handle);
  };
}

const steady = (stops: readonly Stop[]): Layer => ({
  stop: () => {
    for (const stop of stops) stop();
  },
  update: ignore,
});

const bubbles: LayerFactory = (kit, out, settings) => {
  let current = settings;
  const gurgle = filter(kit, "bandpass", 420, 0.9);
  gurgle.connect(out);
  const stops = [
    loop(kit, kit.noise("brown"), gurgle, 0.5),
    scatter(
      kit,
      () => bloopRate(current),
      (at) => {
        const buffer = kit.bloops.at(Math.floor(kit.rng.range(0, kit.bloops.length)));
        if (!buffer) return;
        kit.playOnce({
          buffer,
          at,
          rate: kit.rng.range(0.8, 1.35),
          gain: kit.rng.range(0.05, 0.3),
          pan: kit.rng.range(-0.8, 0.8),
          to: out,
        });
      },
    ),
  ];
  return {
    ...steady(stops),
    update: (next) => {
      current = next;
    },
  };
};

const motor: LayerFactory = (kit, out) => {
  // A pump: mains hum with overtones (small speakers cannot play 60 Hz, but they
  // can play its overtones), two close tones that beat slowly, and a rumble under it.
  const body = kit.ctx.createGain();
  body.gain.value = 0.8;
  body.connect(out);
  const rumble = filter(kit, "lowpass", 220);
  rumble.connect(out);
  return steady([
    tone(kit, "sine", 60, 0.5, body),
    tone(kit, "sine", 59.4, 0.3, body),
    tone(kit, "sine", 120, 0.32, body),
    tone(kit, "triangle", 180, 0.1, body),
    tone(kit, "sine", 240, 0.06, body),
    tone(kit, "sine", 300, 0.03, body),
    sway(kit, 0.31, 0.12, body.gain),
    loop(kit, kit.noise("brown"), rumble, 0.5),
  ]);
};

const stream: LayerFactory = (kit, out) => {
  const water = filter(kit, "bandpass", 1300, 0.6);
  const trickle = filter(kit, "highpass", 2800);
  const level = kit.ctx.createGain();
  level.gain.value = 0.7;
  water.connect(level);
  trickle.connect(level);
  level.connect(out);
  return steady([
    loop(kit, kit.noise("pink"), water, 1),
    loop(kit, kit.noise("white"), trickle, 0.12),
    sway(kit, 0.7, 380, water.frequency),
    sway(kit, 2.3, 160, water.frequency),
    sway(kit, 0.43, 0.2, level.gain),
  ]);
};

const rain: LayerFactory = (kit, out) => {
  const hiss = filter(kit, "highpass", 2400);
  const patter = filter(kit, "bandpass", 900, 0.5);
  hiss.connect(out);
  patter.connect(out);
  return steady([
    loop(kit, kit.noise("white"), hiss, 0.22),
    loop(kit, kit.noise("pink"), patter, 0.5),
    scatter(
      kit,
      () => 9,
      (at) => {
        kit.playOnce({
          buffer: kit.drop,
          at,
          rate: kit.rng.range(0.7, 1.5),
          gain: kit.rng.range(0.03, 0.14),
          pan: kit.rng.range(-1, 1),
          to: out,
        });
      },
    ),
  ]);
};

const ocean: LayerFactory = (kit, out) => {
  const surf = filter(kit, "lowpass", 600);
  const swell = kit.ctx.createGain();
  swell.gain.value = 0.6;
  surf.connect(swell);
  swell.connect(out);
  return steady([
    loop(kit, kit.noise("brown"), surf, 1.4),
    loop(kit, kit.noise("pink"), surf, 0.25),
    // One wave about every ten seconds: louder and brighter as it comes in.
    sway(kit, 0.1, 0.4, swell.gain),
    sway(kit, 0.1, 320, surf.frequency),
  ]);
};

const deep: LayerFactory = (kit, out) => {
  const depths = filter(kit, "lowpass", 130);
  depths.connect(out);
  return steady([
    loop(kit, kit.noise("brown"), depths, 2.4),
    sway(kit, 0.05, 45, depths.frequency),
    tone(kit, "sine", 82, 0.12, out),
    tone(kit, "sine", 123.5, 0.05, out),
  ]);
};

const noise: LayerFactory = (kit, out, settings) => {
  let color = settings.noiseColor;
  let stop = loop(kit, kit.noise(color), out, 0.5);
  return {
    stop: () => {
      stop();
    },
    update: (next) => {
      if (next.noiseColor === color) return;
      color = next.noiseColor;
      stop();
      stop = loop(kit, kit.noise(color), out, 0.5);
    },
  };
};

const chimes: LayerFactory = (kit, out) =>
  steady([
    scatter(
      kit,
      () => 0.3,
      (at) => {
        const hz = CHIME_HZ.at(Math.floor(kit.rng.range(0, CHIME_HZ.length)));
        if (hz === undefined) return;
        const pan = kit.rng.range(-0.7, 0.7);
        kit.playTone({ hz, at, seconds: 4, gain: 0.22, pan, to: out });
        kit.playTone({ hz: hz * 2, at, seconds: 2.5, gain: 0.05, pan, to: out });
      },
    ),
  ]);

export const LAYER_FACTORIES: ReadonlyMap<LayerId, LayerFactory> = new Map([
  ["bubbles", bubbles],
  ["motor", motor],
  ["stream", stream],
  ["rain", rain],
  ["ocean", ocean],
  ["deep", deep],
  ["noise", noise],
  ["chimes", chimes],
]);
