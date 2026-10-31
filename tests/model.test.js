import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whiteNotes, keyLayout, normalizeSettings, viewport, soundingNote, gesturePhase } from '../model.js';

test('default viewport is exactly F2 through F5 inclusive', () => {
  const s = normalizeSettings();
  const v = viewport(s);
  assert.equal(v.first, 41);
  assert.equal(v.last, 77);
  assert.equal(v.count, 22);
  const keys = keyLayout(s);
  assert.equal(keys.filter(k => !k.black).length, 22);
  assert.equal(keys.filter(k => k.black).length, 15);
});
test('full register has 88 keys from A0 to C8', () => {
  assert.equal(whiteNotes[0], 21);
  assert.equal(whiteNotes.at(-1), 108);
  assert.equal(whiteNotes.length, 52);
});
test('B flat shifts written C down one tone for every register', () => {
  assert.equal(soundingNote(60, 'bb'), 58);
  assert.equal(soundingNote(60, 'c'), 60);
  assert.equal(soundingNote(21, 'bb'), 19);
});
test('zoom and position are clamped to full keyboard', () => {
  for (const count of [7, 22, 52]) {
    for (const start of [-99, 0, 20, 999]) {
      const s = normalizeSettings({count, start});
      const v = viewport(s);
      assert.ok(v.first >= 21 && v.last <= 108);
      assert.equal(keyLayout(s).filter(k=>!k.black).length, count);
    }
  }
});
test('corrupt preferences are rejected independently', () => {
  const defaults = normalizeSettings();
  for (const input of [null, [], 'oops', 42]) assert.deepEqual(normalizeSettings(input), defaults);
  const s = normalizeSettings({count:Infinity,start:NaN,instrument:'evil',transpose:'b',slide:'false'});
  assert.deepEqual(s, defaults);
  assert.equal(normalizeSettings({instrument:'trumpet',transpose:'bb',slide:true}).slide, true);
});
test('horizontal drag pans only when enabled and threshold crossed', () => {
  assert.equal(gesturePhase(false, 30, 0), 'play');
  assert.equal(gesturePhase(true, 5, 0), 'play');
  assert.equal(gesturePhase(true, 15, 0), 'slide');
  assert.equal(gesturePhase(true, 2, 20), 'play');
});
test('theme is classic by default and only known themes persist', () => {
  assert.equal(normalizeSettings().theme,'classic');
  assert.equal(normalizeSettings({theme:'sepia'}).theme,'sepia');
  assert.equal(normalizeSettings({theme:'neon'}).theme,'neon');
  assert.equal(normalizeSettings({theme:'invalid'}).theme,'classic');
});
