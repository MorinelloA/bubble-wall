/**
 * A stand-in for the Web Audio API that plays nothing and remembers everything:
 * which nodes were made, how they were wired, what was started and stopped, and
 * where every level was sent.
 */

export class FakeParam {
  value: number;
  /** The level this was last sent towards. */
  target: number;
  readonly log: string[] = [];

  constructor(value = 0) {
    this.value = value;
    this.target = value;
  }

  cancelScheduledValues(): this {
    this.log.push("cancel");
    return this;
  }

  setValueAtTime(value: number): this {
    this.value = value;
    this.log.push("set");
    return this;
  }

  linearRampToValueAtTime(value: number): this {
    this.target = value;
    this.log.push("linear");
    return this;
  }

  /** Glides are instant here: the level is simply where it was sent. */
  setTargetAtTime(value: number): this {
    this.target = value;
    this.value = value;
    this.log.push("target");
    return this;
  }
}

export type NodeKind =
  "gain" | "oscillator" | "source" | "filter" | "limiter" | "panner" | "destination";

export class FakeNode {
  readonly outputs: (FakeNode | FakeParam)[] = [];
  readonly gain = new FakeParam(1);
  readonly frequency = new FakeParam(440);
  readonly playbackRate = new FakeParam(1);
  readonly pan = new FakeParam(0);
  readonly Q = new FakeParam(1);
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0);
  readonly release = new FakeParam(0);
  type = "";
  buffer: FakeBuffer | null = null;
  loop = false;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  disconnected = false;
  finished = false;
  private readonly ended: (() => void)[] = [];

  constructor(readonly kind: NodeKind) {}

  connect<T extends FakeNode | FakeParam>(to: T): T {
    this.outputs.push(to);
    return to;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  start(at = 0): void {
    this.startedAt = at;
  }

  stop(at = 0): void {
    this.stoppedAt = at;
  }

  addEventListener(_type: string, listener: () => void): void {
    this.ended.push(listener);
  }

  /** The sound finished playing. */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const listener of this.ended) listener();
  }

  get playing(): boolean {
    return this.startedAt !== null && this.stoppedAt === null;
  }
}

export class FakeBuffer {
  data: Float32Array = new Float32Array(0);

  constructor(
    readonly length: number,
    readonly sampleRate: number,
  ) {}

  copyToChannel(samples: Float32Array): void {
    this.data = samples;
  }
}

export type ResumeBehaviour = "works" | "hangs" | "refuses";

export class FakeContext {
  state: "suspended" | "running" | "interrupted" | "closed" = "suspended";
  currentTime = 0;
  /** Low, so the noise buffers are quick to make. */
  readonly sampleRate = 2000;
  readonly destination = new FakeNode("destination");
  readonly nodes: FakeNode[] = [];
  resumeBehaviour: ResumeBehaviour = "works";
  resumeCalls = 0;
  suspendCalls = 0;
  private readonly stateListeners: (() => void)[] = [];

  private make(kind: NodeKind): FakeNode {
    const node = new FakeNode(kind);
    this.nodes.push(node);
    return node;
  }

  createGain = (): FakeNode => this.make("gain");
  createOscillator = (): FakeNode => this.make("oscillator");
  createBufferSource = (): FakeNode => this.make("source");
  createBiquadFilter = (): FakeNode => this.make("filter");
  createDynamicsCompressor = (): FakeNode => this.make("limiter");
  createStereoPanner = (): FakeNode => this.make("panner");
  createBuffer = (_channels: number, length: number, sampleRate: number): FakeBuffer =>
    new FakeBuffer(length, sampleRate);

  addEventListener(_type: string, listener: () => void): void {
    this.stateListeners.push(listener);
  }

  /** The browser changed the context's state, as an iPad does when it interrupts audio. */
  setState(state: FakeContext["state"]): void {
    this.state = state;
    for (const listener of this.stateListeners) listener();
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeBehaviour === "refuses") return Promise.reject(new Error("not allowed"));
    if (this.resumeBehaviour === "hangs") return new Promise(() => undefined);
    this.setState("running");
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.suspendCalls += 1;
    this.setState("suspended");
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.setState("closed");
    return Promise.resolve();
  }

  ofKind(kind: NodeKind): FakeNode[] {
    return this.nodes.filter((node) => node.kind === kind);
  }

  /** The node everything is mixed into: the one wired to the limiter. */
  get master(): FakeNode {
    const [limiter] = this.ofKind("limiter");
    const found = this.ofKind("gain").find((node) => limiter && node.outputs.includes(limiter));
    if (!found) throw new Error("no master level");
    return found;
  }

  /** The eight layer levels, in the order of LAYER_IDS. */
  get channels(): FakeNode[] {
    const master = this.master;
    return this.ofKind("gain").filter((node) => node.outputs.includes(master));
  }

  /** Sounds that play once: buffer sources that do not loop, and chime tones that stop. */
  get oneShots(): FakeNode[] {
    return this.nodes.filter(
      (node) =>
        node.startedAt !== null &&
        ((node.kind === "source" && !node.loop) ||
          (node.kind === "oscillator" && node.stoppedAt !== null)),
    );
  }

  /** Looping sources and steady tones that are sounding now. */
  get playingLoops(): FakeNode[] {
    return this.nodes.filter(
      (node) =>
        node.playing && ((node.kind === "source" && node.loop) || node.kind === "oscillator"),
    );
  }

  /** Every one-shot that has not finished yet finishes now. */
  finishOneShots(): void {
    for (const shot of this.oneShots) shot.finish();
  }

  asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}
