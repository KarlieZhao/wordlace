type ModMode = "none" | "fm" | "ring";

// defaults in the constructor:
//   modMode: "fm",
//   modIndex: 1.5,

export interface LinkageAudioOptions {
  baseHz: number; // pitch for distance = 1
  stagger: number;
  scaleOctaves: number; // pitch span between nearest and farthest
  maxDistance: number; // distances >= this clamp to the top of the range
  noteDuration: number; // seconds per note
  volume: number; // 0..1 master
  higherWhenFarther: boolean;
  modMode: ModMode;
  modIndex: number;
  attack: number;
  release: number;
  sustain: number;
}

const PENTATONIC = [0, 2, 4, 7, 9];

export class LinkageAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private mode: 0 | 1 = 0;
  private readonly opts: LinkageAudioOptions;

  constructor(opts: Partial<LinkageAudioOptions> = {}) {
    this.opts = {
      baseHz: 220,
      scaleOctaves: 2,
      maxDistance: 12,
      noteDuration: 5,
      stagger: 0.1,
      volume: 0.3,
      higherWhenFarther: true,
      modMode: "ring",
      modIndex: 1.5,
      attack: 0.6,
      release: 3,
      sustain: 0.2,
      ...opts,
    };
  }

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.opts.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setMode(mode: 0 | 1) {
    this.mode = mode;
  }

  playMode0(distances: number[]): void {
    if (!this.enabled || !this.ctx || !this.master || distances.length === 0) return;

    const ctx = this.ctx;
    const sorted = [...distances].sort((a, b) => a - b);
    // keep the chord from clipping as N grows
    const perNoteGain = 1 / Math.sqrt(sorted.length);
    const now = ctx.currentTime;

    sorted.forEach((d, i) => {
      const start = now + i * this.opts.stagger;
      this.note(this.distanceToHz(d), start, perNoteGain);
    });
  }

  private note(freq: number, start: number, peak: number): void {
    const ctx = this.ctx!;
    const { noteDuration } = this.opts;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    // short attack/release envelope to avoid clicks
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);

    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + noteDuration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  play(distances: number[]) {
    if (this.mode === 0) this.playMode0(distances);
    else if (this.mode === 1) this.playMode1(distances);
  }

  playMode1(distances: number[]): void {
    if (!this.enabled || !this.ctx || !this.master || distances.length === 0) return;

    const freqs = [...new Set(distances.map((d) => this.distanceToHz(d)))].sort((a, b) => a - b);
    const perNoteGain = 1 / Math.sqrt(freqs.length);
    const start = this.ctx.currentTime;

    freqs.forEach((freq, i) => {
      const neighbor = freqs.length > 1 ? freqs[(i + 1) % freqs.length] : null;
      const modFreq = neighbor !== null ? this.harmonicMod(freq, neighbor) : null;
      this.voice(freq, modFreq, start, perNoteGain);
    });
  }

  private harmonicMod(carrier: number, other: number): number {
    const r = other / carrier;
    // snap to the nearest integer ratio (or 1/integer when the other note is lower)
    const snapped = r >= 1 ? Math.max(1, Math.round(r)) : 1 / Math.max(1, Math.round(1 / r));
    return carrier * snapped;
  }

  private voice(freq: number, modFreq: number | null, start: number, peak: number): void {
    const ctx = this.ctx!;
    const { noteDuration, modMode, modIndex, attack, release, sustain } = this.opts;
    const end = start + noteDuration;

    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = freq;

    const floor = 0.0001; // exponential ramps can't touch 0
    const env = ctx.createGain();

    const a = Math.min(attack, noteDuration * 0.5);
    const r = Math.min(release, noteDuration - a);
    const releaseStart = end - r;

    const sustainLevel = Math.max(peak * sustain, floor);

    env.gain.setValueAtTime(floor, start);
    // attack
    env.gain.exponentialRampToValueAtTime(sustainLevel, start + a);
    // sustain
    env.gain.setValueAtTime(sustainLevel, releaseStart);
    // release
    env.gain.exponentialRampToValueAtTime(floor, end);

    const oscs: OscillatorNode[] = [carrier];
    const nodes: AudioNode[] = [carrier, env];

    if (modFreq !== null && modMode !== "none") {
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = modFreq;
      mod.detune.value = (Math.random() - 0.5) * 12; // ±6 cents
      oscs.push(mod);
      nodes.push(mod);

      if (modMode === "fm") {
        // modulator -> depth gain -> carrier.frequency (depth is in Hz)
        const depth = ctx.createGain();

        const deviation = modFreq * modIndex;
        depth.gain.setValueAtTime(deviation, start);
        // timbre starts bright/clangy and mellows out as the note decays
        depth.gain.exponentialRampToValueAtTime(deviation * 0.05, end);
        mod.connect(depth).connect(carrier.frequency);
        carrier.connect(env);
        nodes.push(depth);
      } else {
        // ring mod: carrier's gain is driven by the modulator (base gain 0)
        const ring = ctx.createGain();
        ring.gain.value = 0;
        mod.connect(ring.gain);
        carrier.connect(ring).connect(env);
        nodes.push(ring);
      }
    } else {
      carrier.connect(env);
    }

    env.connect(this.master!);

    for (const o of oscs) {
      o.start(start);
      o.stop(end + 0.02);
    }
    carrier.onended = () => nodes.forEach((n) => n.disconnect());
  }

  private distanceToHz(distance: number): number {
    const { baseHz, scaleOctaves, maxDistance, higherWhenFarther } = this.opts;

    let t = Math.min(Math.max((distance - 1) / (maxDistance - 1), 0), 1);
    if (!higherWhenFarther) t = 1 - t;

    // quantize onto a pentatonic scale spanning `scaleOctaves`
    const steps = scaleOctaves * PENTATONIC.length;
    const step = Math.round(t * steps);
    const semitones = 12 * Math.floor(step / PENTATONIC.length) + PENTATONIC[step % PENTATONIC.length];

    return baseHz * Math.pow(2, semitones / 12);
  }
}
