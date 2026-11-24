import type { Pen } from "../../../src/app/wall/sprites";

export interface PenCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

export interface RecordingPen {
  readonly pen: Pen;
  /** Every method call, in order. */
  readonly calls: PenCall[];
  /** Every property that was set, in order. */
  readonly sets: PenCall[];
  readonly named: (name: string) => PenCall[];
  /** Makes the named method throw from now on; pass null to make everything work again. */
  readonly breakOn: (name: string | null) => void;
}

/** A stand-in for the 2D canvas context that writes down everything asked of it. */
export function recordingPen(): RecordingPen {
  const calls: PenCall[] = [];
  const sets: PenCall[] = [];
  const values = new Map<string, unknown>();
  let broken: string | null = null;
  const gradient = {
    addColorStop: (...args: unknown[]) => {
      calls.push({ name: "addColorStop", args });
    },
  };
  const pen = new Proxy(
    {},
    {
      get: (_target, property) => {
        const name = String(property);
        if (values.has(name)) return values.get(name);
        return (...args: unknown[]) => {
          if (name === broken) throw new Error(`${name} is broken`);
          calls.push({ name, args });
          return name.startsWith("create") ? gradient : undefined;
        };
      },
      set: (_target, property, value) => {
        values.set(String(property), value);
        sets.push({ name: String(property), args: [value] });
        return true;
      },
    },
  ) as Pen;
  return {
    pen,
    calls,
    sets,
    named: (name) => calls.filter((call) => call.name === name),
    breakOn: (name) => {
      broken = name;
    },
  };
}
