import { createEventType } from "@remix-run/events";

let [kick, createKick] = createEventType("drum:kick");
let [snare, createSnare] = createEventType("drum:snare");
let [hat, createHat] = createEventType("drum:hat");
let [play, createPlay] = createEventType("drum:play");
let [stop, createStop] = createEventType("drum:stop");
let [tempoChange, createTempoChange] =
  createEventType<number>("drum:tempo-change");
let [change, createChange] = createEventType("drum:change");

export type Instrument = "kicks" | "hihat" | "snare";

function b64UrlEncode(buf: Uint8Array): string {
  const asStr = buf.reduce((o, b) => o + String.fromCharCode(b), "");
  // base64url
  return btoa(asStr).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64UrlDecode(value: string): Uint8Array {
  const base64 = (
    value + "=".repeat(value.length % 4 && 4 - (value.length % 4))
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const buf = atob(base64);
  const bytes = new Uint8Array(buf.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = buf.charCodeAt(i);
  }
  return bytes;
}

function toDrumPatterns(
  bytes: ArrayLike<number>
): Record<Instrument, number[]> {
  return {
    hihat: Array.from(Array.prototype.slice.call(bytes, 0, 16)),
    snare: Array.from(Array.prototype.slice.call(bytes, 16, 32)),
    kicks: Array.from(Array.prototype.slice.call(bytes, 32, 48)),
  };
}

export class Drummer extends EventTarget {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserBuffer: Uint8Array<ArrayBuffer> | null = null;

  private _isPlaying = false;
  private tempoBpm: number;
  private current16th = 0;
  private nextNoteTime = 0;
  private intervalId: number | null = null;
  private patterns: Record<Instrument, number[]>;

  // Tempo settings
  private readonly minBpm = 30;
  private readonly maxBpm = 300;

  // Scheduler settings
  private readonly lookaheadMs = 25; // how frequently to check (ms)
  private readonly scheduleAheadS = 0.1; // how far ahead to schedule (s)

  // Drums
  #hihat: Drum | null = null;
  #snare: Drum | null = null;
  #kick: Drum | null = null;

  // Event binders
  static kick = kick;
  static snare = snare;
  static hat = hat;
  static play = play;
  static stop = stop;
  static tempoChange = tempoChange;
  static change = change;

  // prettier-ignore
  private static defaultPatterns: readonly number[] = [
    80, 0, 80, 0, 80, 0, 80, 80, 80, 80, 80, 0, 80, 0, 80, 0, // hihat
    0, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0, 0, 80, 0, 0, 0, // snare
    80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 80, 0, 0, 0, 0, 0, // kick
  ];

  constructor(tempoBpm: number) {
    super();
    this.tempoBpm = Math.max(
      this.minBpm,
      Math.min(this.maxBpm, Math.floor(tempoBpm))
    );
    this.patterns = toDrumPatterns(Drummer.defaultPatterns);
  }

  serialize() {
    return b64UrlEncode(
      new Uint8Array([
        ...this.patterns.hihat,
        ...this.patterns.snare,
        ...this.patterns.kicks,
      ])
    );
  }

  deserialize(value: string) {
    const bytes = b64UrlDecode(value);
    if (bytes.length === 48) {
      this.patterns = toDrumPatterns(bytes);
    }
  }

  get isPlaying() {
    return this._isPlaying;
  }

  get bpm() {
    return this.tempoBpm;
  }

  async toggle() {
    if (this.isPlaying) {
      await this.stop();
    } else {
      await this.play();
    }
  }

  reset() {
    this.patterns = toDrumPatterns(Drummer.defaultPatterns);
    this.setTempo(120);
  }

  setTempo(bpm: number) {
    this.tempoBpm = Math.max(
      this.minBpm,
      Math.min(this.maxBpm, Math.floor(bpm || this.tempoBpm))
    );
    this.dispatchEvent(createTempoChange({ detail: this.tempoBpm }));
    this.dispatchEvent(createChange());
  }

  async play(bpm?: number) {
    this.ensureContext();
    if (!this.audioCtx) return;
    if (bpm) {
      this.setTempo(bpm);
    }
    await this.audioCtx.resume();

    if (this._isPlaying) return;
    this._isPlaying = true;
    this.nextNoteTime = this.audioCtx.currentTime;
    // don't reset current16th so setTempo can adjust mid-groove if restarted
    if (this.intervalId != null) window.clearInterval(this.intervalId);
    this.intervalId = window.setInterval(this.scheduler, this.lookaheadMs);
    this.dispatchEvent(createPlay());
    this.dispatchEvent(createChange());
  }

  async stop() {
    if (!this.audioCtx) return;
    if (this.intervalId != null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isPlaying = false;
    this.current16th = 0;
    this.nextNoteTime = this.audioCtx.currentTime;
    this.dispatchEvent(createStop());
    this.dispatchEvent(createChange());
  }

  private async ensureContext() {
    if (!this.audioCtx) {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = this.audioCtx ?? new Ctx();
      this.audioCtx = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(ctx.destination);

      this.createAnalyser();

      this.#hihat = new Hihat(ctx, this.masterGain);
      this.#snare = new Snare(ctx, this.masterGain);
      this.#kick = new Kick(ctx, this.masterGain);
      await Promise.all([this.#snare.ready, this.#kick.ready]);
    }
  }

  private createAnalyser() {
    this.ensureContext();
    if (!this.audioCtx) return;

    this.analyser = this.audioCtx.createAnalyser();

    this.analyser.fftSize = 256;
    this.analyserBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.smoothingTimeConstant = 0.9;

    this.masterGain?.connect(this.analyser);
  }

  analyze() {
    if (!this.analyser || !this.analyserBuffer) return;
    this.analyser.getByteFrequencyData(this.analyserBuffer);
    return this.analyserBuffer;
  }

  private secondsPer16th(): number {
    return 60 / Math.max(1, this.tempoBpm) / 4;
  }

  private playKick(time: number, volume: number) {
    if (!this.audioCtx || !this.masterGain || !this.#kick || !volume) return;
    this.#kick.play(time, volume);
    this.dispatchEvent(createKick());
    this.dispatchEvent(createChange());
  }

  private playSnare(time: number, volume: number) {
    if (!this.audioCtx || !this.masterGain || !this.#snare || !volume) return;
    this.#snare.play(time, volume);
    this.dispatchEvent(createSnare());
    this.dispatchEvent(createChange());
  }

  private playHiHat(time: number, volume: number) {
    if (!this.audioCtx || !this.masterGain || !this.#hihat || !volume) return;
    this.#hihat.play(time, volume);
    this.dispatchEvent(createHat());
    this.dispatchEvent(createChange());
  }

  getTrack(drum: Instrument): number[] {
    return this.patterns[drum];
  }

  toggleNote(drum: Instrument, note: number, state: boolean) {
    this.patterns[drum][note] = state ? 80 : 0;
    this.dispatchEvent(createChange());
  }

  adjustNoteVolume(drum: Instrument, note: number, delta: number) {
    this.patterns[drum][note] = Math.min(
      Math.max(0, this.patterns[drum][note] + delta),
      100
    );
    this.dispatchEvent(createChange());
  }

  private scheduleStep(step: number, time: number) {
    this.playHiHat(time, this.patterns.hihat[step] / 100);
    this.playSnare(time, this.patterns.snare[step] / 100);
    this.playKick(time, this.patterns.kicks[step] / 100);
  }

  private advanceNote() {
    this.nextNoteTime += this.secondsPer16th();
    this.current16th = (this.current16th + 1) % 16;
  }

  private scheduler = () => {
    if (!this.audioCtx) return;
    while (
      this.nextNoteTime <
      this.audioCtx.currentTime + this.scheduleAheadS
    ) {
      this.scheduleStep(this.current16th, this.nextNoteTime);
      this.advanceNote();
    }
  };
}

function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const length = ctx.sampleRate; // 1 second
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

class Drum {
  #context: AudioContext;
  #output: AudioNode;

  #ready: Promise<void>;
  #buffer: AudioBuffer | null = null;

  constructor(
    context: AudioContext,
    output: AudioNode,
    offline: OfflineAudioContext
  ) {
    this.#context = context;
    this.#output = output;

    this.#ready = offline.startRendering().then((buffer) => {
      this.#buffer = buffer;
    });
  }

  get ready() {
    return this.#ready;
  }

  play(time: number, volume: number) {
    if (!this.#buffer) return;

    let source = this.#context.createBufferSource();
    source.buffer = this.#buffer;

    let gain = this.#context.createGain();
    source.connect(gain).connect(this.#output);

    gain.gain.setValueAtTime(volume, time);
    source.start(time);
  }
}

class Hihat extends Drum {
  static decay = 0.04;

  constructor(context: AudioContext, output: AudioNode) {
    const offline = new OfflineAudioContext({
      length: Hihat.decay * context.sampleRate,
      sampleRate: context.sampleRate,
      numberOfChannels: 1,
    });

    const noise = offline.createBufferSource();
    noise.buffer = createNoiseBuffer(offline);
    const hp = offline.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8000;
    const gain = offline.createGain();
    gain.gain.setValueAtTime(1, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, Hihat.decay);
    noise.connect(hp).connect(gain).connect(offline.destination);

    noise.start(0);
    noise.stop(Hihat.decay);

    super(context, output, offline);
  }
}

class Snare extends Drum {
  static decay = 0.2;

  constructor(context: AudioContext, output: AudioNode) {
    const offline = new OfflineAudioContext({
      length: Snare.decay * context.sampleRate,
      sampleRate: context.sampleRate,
      numberOfChannels: 1,
    });

    const noise = offline.createBufferSource();
    noise.buffer = createNoiseBuffer(offline);

    const band = offline.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800;
    const noiseGain = offline.createGain();
    noiseGain.gain.setValueAtTime(1, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, Snare.decay);

    noise.connect(band).connect(noiseGain).connect(offline.destination);

    noise.start(0);
    noise.stop(Snare.decay);

    // Body/tonal component
    const osc = offline.createOscillator();
    const oscGain = offline.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, 0);
    oscGain.gain.setValueAtTime(0.5, 0);
    oscGain.gain.exponentialRampToValueAtTime(0.01, Snare.decay);
    osc.connect(oscGain).connect(offline.destination);

    osc.start(0);
    osc.stop(Snare.decay);

    super(context, output, offline);
  }
}

class Kick extends Drum {
  static decay = 0.15;

  constructor(context: AudioContext, output: AudioNode) {
    const offline = new OfflineAudioContext({
      length: Kick.decay * context.sampleRate,
      sampleRate: context.sampleRate,
      numberOfChannels: 1,
    });

    const osc = offline.createOscillator();
    osc.type = "sine";
    const gain = offline.createGain();
    osc.connect(gain).connect(offline.destination);

    osc.frequency.setValueAtTime(150, 0);
    osc.frequency.exponentialRampToValueAtTime(0.001, Kick.decay);

    gain.gain.setValueAtTime(1, 0);
    gain.gain.linearRampToValueAtTime(0.001, Kick.decay);

    osc.start(0);
    osc.stop(Kick.decay);

    super(context, output, offline);
  }
}
