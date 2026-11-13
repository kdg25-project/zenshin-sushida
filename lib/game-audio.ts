export type GameSound = "letter" | "plate" | "skip" | "result";

type FrequencyParamLike = { setValueAtTime(value: number, time: number): unknown };
type GainParamLike = FrequencyParamLike & { exponentialRampToValueAtTime(value: number, time: number): unknown };
type AudioNodeLike = { connect(destination: unknown): unknown; disconnect?(): unknown };
type OscillatorLike = AudioNodeLike & { type: OscillatorType; frequency: FrequencyParamLike; start(when?: number): unknown; stop(when?: number): unknown; onended: ((event: Event) => unknown) | null };
type GainLike = AudioNodeLike & { gain: GainParamLike };

export type GameAudioContext = {
  state: AudioContextState;
  currentTime: number;
  destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume(): Promise<void>;
  close(): Promise<void>;
};

export type GameAudioFactory = () => GameAudioContext | undefined;

/** Compares durable session edges so render frames can never retrigger a sound. */
export function gameSoundEvents(previous: { status: string; events: { kind: "solve" | "skip" }[]; completedWordIds: unknown[] }, next: { status: string; events: { kind: "solve" | "skip" }[]; completedWordIds: unknown[] }): GameSound[] {
  const events = next.events.slice(previous.events.length);
  const completedCount = Math.max(0, next.completedWordIds.length - previous.completedWordIds.length);
  const solveIndexes = events.flatMap((event, index) => event.kind === "solve" ? [index] : []);
  const completedSolves = new Set(solveIndexes.slice(Math.max(0, solveIndexes.length - completedCount)));
  const sounds = events.map((event, index) => event.kind === "skip" ? "skip" : completedSolves.has(index) ? "plate" : "letter") as GameSound[];
  if (previous.status !== "result" && next.status === "result") sounds.push("result");
  return sounds;
}

function browserAudioContext(): GameAudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!window.AudioContext) return undefined;
  return new window.AudioContext();
}

/**
 * Small procedural Japanese-shop effects. It creates an AudioContext only from
 * a local interaction, then only plays through that same unlocked context.
 */
export class GameAudio {
  private context: GameAudioContext | undefined;
  private disposed = false;
  private readonly active = new Set<OscillatorLike>();
  private readonly bgmActive = new Set<OscillatorLike>();
  private bgmTimer: ReturnType<typeof setInterval> | undefined;
  private bgmRequested = false;
  private nextBgmAt = 0;
  private bgmStep = 0;

  constructor(private readonly factory: GameAudioFactory = browserAudioContext) {}

  unlock(): void {
    if (this.disposed) return;
    if (this.context?.state === "closed") this.context = undefined;
    try {
      this.context ??= this.factory();
      if (this.context?.state === "suspended") void this.context.resume().then(() => this.scheduleBgm()).catch(() => undefined);
      else this.scheduleBgm();
    } catch {
      // Audio is optional: a browser policy or missing implementation must not affect play.
    }
  }

  play(sound: GameSound): void {
    const context = this.context;
    if (this.disposed || !context || context.state !== "running") return;
    const at = context.currentTime + 0.01;
    switch (sound) {
      case "letter":
        this.tone(context, 460, at, 0.055, 0.035, "triangle");
        break;
      case "plate":
        this.tone(context, 620, at, 0.075, 0.05, "triangle");
        this.tone(context, 890, at + 0.075, 0.08, 0.04, "sine");
        break;
      case "skip":
        this.tone(context, 180, at, 0.09, 0.028, "triangle");
        break;
      case "result":
        [392, 466.16, 587.33, 698.46].forEach((frequency, index) => this.tone(context, frequency, at + index * 0.105, 0.13, 0.035, "sine"));
        break;
    }
  }

  /** Starts one calm 80 BPM koto-and-wood loop after the round actually begins. */
  startBgm(): void {
    if (this.disposed) return;
    this.bgmRequested = true;
    this.scheduleBgm();
  }

  /** Cancels the loop and every future note queued by its short look-ahead. */
  stopBgm(): void {
    this.bgmRequested = false;
    if (this.bgmTimer !== undefined) clearInterval(this.bgmTimer);
    this.bgmTimer = undefined;
    this.nextBgmAt = 0;
    for (const oscillator of this.bgmActive) {
      try { oscillator.stop(); } catch {}
    }
    this.bgmActive.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopBgm();
    for (const oscillator of this.active) {
      try { oscillator.stop(); } catch {}
    }
    this.active.clear();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }

  private scheduleBgm(): void {
    const context = this.context;
    if (this.disposed || !this.bgmRequested || !context || context.state !== "running" || this.bgmTimer !== undefined) return;
    this.nextBgmAt = context.currentTime + 0.04;
    this.fillBgm(context);
    this.bgmTimer = setInterval(() => this.fillBgm(context), 600);
  }

  private fillBgm(context: GameAudioContext): void {
    if (this.disposed || !this.bgmRequested || this.context !== context || context.state !== "running") return;
    const now = context.currentTime;
    // A backgrounded tab may wake long after its scheduled notes; skip them instead of bursting.
    if (this.nextBgmAt < now) this.nextBgmAt = now + 0.04;
    const lookAhead = now + 1.25;
    while (this.nextBgmAt < lookAhead) {
      this.scheduleBgmStep(context, this.nextBgmAt, this.bgmStep);
      this.nextBgmAt += 0.375;
      this.bgmStep = (this.bgmStep + 1) % 16;
    }
  }

  private scheduleBgmStep(context: GameAudioContext, at: number, step: number): void {
    // Hirajoshi-like pentatonic colors: sparse plucks leave room for feedback effects.
    const melody: (number | undefined)[] = [293.66, undefined, 349.23, undefined, 440, undefined, 392, undefined, 293.66, undefined, 440, undefined, 523.25, undefined, 392, undefined];
    const note = melody[step];
    if (note) this.pluck(context, note, at, 0.28, 0.012);
    if (step === 0 || step === 8) this.tone(context, step === 0 ? 138.59 : 174.61, at, 0.08, 0.009, "triangle", this.bgmActive);
  }

  private pluck(context: GameAudioContext, frequency: number, at: number, duration: number, volume: number): void {
    this.tone(context, frequency, at, duration, volume, "triangle", this.bgmActive);
    this.tone(context, frequency * 2.01, at, duration * 0.6, volume * 0.28, "sine", this.bgmActive);
  }

  private tone(context: GameAudioContext, frequency: number, at: number, duration: number, volume: number, type: OscillatorType, collection = this.active): void {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { this.active.delete(oscillator); this.bgmActive.delete(oscillator); try { oscillator.disconnect?.(); gain.disconnect?.(); } catch {} };
      this.active.add(oscillator);
      collection.add(oscillator);
      oscillator.start(at);
      oscillator.stop(at + duration);
    } catch {
      // Some browsers may invalidate a context between a frame and scheduling.
    }
  }
}
