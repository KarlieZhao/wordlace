export interface LinkageAudioOptions {
  baseHz: number; // pitch for distance = 1
  scaleOctaves: number; // pitch span between nearest and farthest
  maxDistance: number; // distances >= this clamp to the top of the range
  noteDuration: number; // seconds per note
  stagger: number; // seconds between note onsets (so N equal pitches are still N audible notes)
  volume: number; // 0..1 master
  higherWhenFarther: boolean;
}

const PENTATONIC = [0, 2, 4, 7, 9];

export class LinkageAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private readonly opts: LinkageAudioOptions;

  constructor(opts: Partial<LinkageAudioOptions> = {}) {
    this.opts = {
      baseHz: 220,
      scaleOctaves: 2,
      maxDistance: 12,
      noteDuration: 1.35,
      stagger: 0.07,
      volume: 0.3,
      higherWhenFarther: true,
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

  play(distances: number[]): void {
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
    osc.type = "sine";
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
