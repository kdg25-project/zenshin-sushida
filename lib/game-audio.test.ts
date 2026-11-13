import { describe, expect, it, vi } from "vitest";
import { GameAudio, gameSoundEvents, type GameAudioContext } from "./game-audio";

const session = (status: string, events: ("solve" | "skip")[] = [], completed = 0) => ({ status, events: events.map(kind => ({ kind })), completedWordIds: Array.from({ length: completed }) });

function context(state: AudioContextState = "running") {
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null; type: OscillatorType; frequency: { setValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
  const value = {
    state, currentTime: 2, destination: {},
    createOscillator: vi.fn(() => { const oscillator = { start: vi.fn(), stop: vi.fn(), onended: null, type: "sine" as OscillatorType, frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; oscillators.push(oscillator); return oscillator; }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
  } satisfies GameAudioContext;
  return { value, oscillators };
}

describe("game sound event bridge", () => {
  it("plays only new durable events and replaces a final letter with the plate sound", () => {
    expect(gameSoundEvents(session("playing"), session("playing", ["solve"], 0))).toEqual(["letter"]);
    expect(gameSoundEvents(session("playing", ["solve"], 0), session("playing", ["solve", "solve"], 1))).toEqual(["plate"]);
    expect(gameSoundEvents(session("playing", ["solve"], 0), session("playing", ["solve"], 0))).toEqual([]);
    expect(gameSoundEvents(session("playing"), session("playing", ["skip"]))).toEqual(["skip"]);
  });

  it("plays the result flourish once for an actual result transition", () => {
    expect(gameSoundEvents(session("playing"), session("result"))).toEqual(["result"]);
    expect(gameSoundEvents(session("result"), session("result"))).toEqual([]);
    expect(gameSoundEvents(session("result"), session("idle"))).toEqual([]);
  });
});

describe("GameAudio", () => {
  it("creates and resumes audio only when unlocked, and schedules nothing before then", () => {
    const fake = context("suspended");
    const factory = vi.fn(() => fake.value);
    const audio = new GameAudio(factory);
    audio.play("letter");
    expect(factory).not.toHaveBeenCalled();
    audio.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.value.resume).toHaveBeenCalledTimes(1);
    audio.play("letter");
    expect(fake.value.createOscillator).not.toHaveBeenCalled();
  });

  it("schedules original low-gain effects only from an unlocked running context and releases them", () => {
    const fake = context();
    const audio = new GameAudio(() => fake.value);
    audio.unlock();
    audio.play("plate");
    audio.play("result");
    expect(fake.value.createOscillator).toHaveBeenCalledTimes(6);
    expect(fake.oscillators.every(oscillator => oscillator.start.mock.calls.length === 1)).toBe(true);
    audio.dispose();
    expect(fake.oscillators.every(oscillator => oscillator.stop.mock.calls.length >= 1)).toBe(true);
    expect(fake.value.close).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected resume and lets a later local gesture retry", async () => {
    const fake = context("suspended");
    fake.value.resume.mockRejectedValueOnce(new Error("blocked"));
    const audio = new GameAudio(() => fake.value);
    audio.unlock();
    await Promise.resolve();
    audio.unlock();
    expect(fake.value.resume).toHaveBeenCalledTimes(2);
  });

  it("keeps one sparse BGM loop, cancels its look-ahead notes, and never restarts after stopping", () => {
    vi.useFakeTimers();
    try {
      const fake = context();
      const audio = new GameAudio(() => fake.value);
      audio.unlock();
      audio.startBgm();
      const scheduled = fake.value.createOscillator.mock.calls.length;
      expect(scheduled).toBeGreaterThan(0);
      audio.stopBgm();
      vi.advanceTimersByTime(2_000);
      expect(fake.value.createOscillator).toHaveBeenCalledTimes(scheduled);
      audio.startBgm();
      expect(fake.value.createOscillator.mock.calls.length).toBeGreaterThan(scheduled);
      audio.dispose();
      vi.advanceTimersByTime(2_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
