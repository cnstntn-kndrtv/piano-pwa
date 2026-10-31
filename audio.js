export const SAMPLE_ROOTS = [21, ...Array.from({ length: 15 }, (_, i) => 24 + i * 6)];
export class PianoAudio {
  constructor() {
    this.context = null;
    this.buffers = new Map();
    this.voice = null;
    this.generation = 0;
  }
  getContext() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio недоступен в этом браузере');
      this.context = new Context({ latencyHint: 'interactive' });
    }
    return this.context;
  }
  async load(instrument) {
    if (this.buffers.has(instrument)) return;
    const ctx = this.getContext();
    const decoded = await Promise.all(SAMPLE_ROOTS.map(async root => {
      const response = await fetch(new URL(`./assets/sounds/${instrument}/${root}.mp3`, import.meta.url));
      if (!response.ok) throw new Error('Не удалось загрузить звуки');
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      return [root, buffer];
    }));
    this.buffers.set(instrument, new Map(decoded));
  }
  play(note, instrument) {
    this.stop();
    const generation = this.generation;
    const ctx = this.getContext();
    const start = () => {
      if (generation !== this.generation) return;
      const samples = this.buffers.get(instrument);
      if (!samples) return;
      const root = SAMPLE_ROOTS.reduce((a, b) => Math.abs(a - note) <= Math.abs(b - note) ? a : b);
      const source = ctx.createBufferSource();
      source.buffer = samples.get(root);
      source.playbackRate.value = 2 ** ((note - root) / 12);
      const gain = ctx.createGain();
      const volume = instrument === 'trumpet' ? 0.5 : 0.8;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.003);
      source.connect(gain).connect(ctx.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      this.voice = { source, gain };
    };
    // No scheduling/lookahead queue while playing: start in this event turn.
    if (ctx.state === 'running') start();
    else ctx.resume().then(start).catch(() => {});
  }
  stop() {
    this.generation++;
    if (!this.voice) return;
    const { source, gain } = this.voice;
    this.voice = null;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.003);
    source.stop(now + 0.025);
  }
}
