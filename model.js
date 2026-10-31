export const whiteNotes = Array.from({ length: 88 }, (_, i) => i + 21)
  .filter(n => ![1, 3, 6, 8, 10].includes(n % 12));
const defaults = { count: 22, start: whiteNotes.indexOf(41), instrument: 'piano', transpose: 'c', slide: false, theme: 'classic' };
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
export function normalizeSettings(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const count = Number.isFinite(v.count) ? clamp(Math.round(v.count), 7, 52) : defaults.count;
  return {
    count,
    start: Number.isFinite(v.start) ? clamp(v.start, 0, 52 - count) : clamp(defaults.start, 0, 52 - count),
    instrument: ['piano', 'marimba', 'trumpet'].includes(v.instrument) ? v.instrument : defaults.instrument,
    transpose: v.transpose === 'bb' ? 'bb' : 'c',
    theme: ['classic', 'sepia', 'neon'].includes(v.theme) ? v.theme : 'classic',
    slide: typeof v.slide === 'boolean' ? v.slide : defaults.slide,
  };
}
export function viewport(settings) {
  const s = normalizeSettings(settings);
  return { first: whiteNotes[Math.floor(s.start)], last: whiteNotes[Math.ceil(s.start + s.count) - 1], count: s.count };
}
export function keyLayout(settings) {
  const { start, count } = normalizeSettings(settings);
  const result = [];
  for (let i = 0; i < whiteNotes.length; i++) {
    const note = whiteNotes[i];
    if (i + 1 > start && i < start + count) result.push({ note, black: false, x: i - start, width: 1 });
    if (i < 51 && whiteNotes[i + 1] - note === 2 && i + 1 > start && i + 1 < start + count) {
      result.push({ note: note + 1, black: true, x: i + 1 - start - 0.31, width: 0.62 });
    }
  }
  return result;
}
export const soundingNote = (note, transpose) => note - (transpose === 'bb' ? 2 : 0);
export const gesturePhase = (enabled, dx, dy) => enabled && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) ? 'slide' : 'play';
export function noteName(note) {
  const names = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
