/**
 * Every level change in the app goes through here, so no sound ever starts, stops
 * or jumps abruptly. The level glides to its target instead.
 */
export function rampTo(param: AudioParam, target: number, now: number, seconds = 0.5): void {
  param.cancelScheduledValues(now);
  // Pin the glide's starting point to where the level is at this moment.
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(target, now, seconds / 3);
}
