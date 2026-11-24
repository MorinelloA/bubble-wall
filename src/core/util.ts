/** Small helpers shared across src/core. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smooth ease in and out between 0 and 1. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The fields of an untrusted object, read safely by name. Anything else gives no fields. */
export type Fields = ReadonlyMap<string, unknown>;

export function fieldsOf(value: unknown): Fields {
  return isRecord(value) ? new Map(Object.entries(value)) : new Map<string, unknown>();
}
