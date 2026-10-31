import { keyLayout, normalizeSettings, viewport, soundingNote, gesturePhase, noteName } from './model.js';
import { PianoAudio } from './audio.js';
const $ = id => document.getElementById(id);
const keyboard = $('keyboard');
const keys = $('keys');
const dialog = $('settings');
const audio = new PianoAudio();
const STORAGE = 'piano-pwa-settings-v1';
let settings;
try { settings = normalizeSettings(JSON.parse(localStorage.getItem(STORAGE))); }
catch { settings = normalizeSettings(); }
let pointer = null;
let activeKey = null;
let loadVersion = 0;
let keyWidth = 1;
const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch {} };
function silence() {
  audio.stop();
  if (activeKey) activeKey.classList.remove('is-active');
  activeKey = null;
}
function cancelGesture() {
  if (pointer && keyboard.hasPointerCapture(pointer.id)) keyboard.releasePointerCapture(pointer.id);
  pointer = null;
  silence();
}
function playKey(key) {
  if (key === activeKey) return;
  silence();
  if (!key || document.body.dataset.ready !== 'true') return;
  activeKey = key;
  key.classList.add('is-active');
  audio.play(soundingNote(Number(key.dataset.note), settings.transpose), settings.instrument);
  $('hint').classList.add('dismissed');
}
function keyAt(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest('.key') || null;
}
for (const key of keyLayout({ count: 52, start: 0 })) {
  const button = document.createElement('button');
  button.className = `key ${key.black ? 'black' : 'white'}`;
  button.dataset.note = key.note;
  button.style.left = `calc(var(--key-width) * ${key.x})`;
  button.style.width = `calc(var(--key-width) * ${key.width})`;
  button.setAttribute('aria-label', noteName(key.note));
  button.tabIndex = -1;
  const label = document.createElement('span');
  label.className = 'note-label';
  const name = noteName(key.note);
  label.textContent = key.black ? '' : name.slice(0, -1);
  if (!key.black) {
    const octave = document.createElement('span');
    octave.className = 'octave';
    octave.textContent = name.slice(-1);
    label.append(octave);
  }
  button.append(label);
  keys.append(button);
}
function updateControls() {
  $('scale').value = settings.count;
  $('scale-label').textContent = `${settings.count} белых клавиш`;
  $('position').max = 52 - settings.count;
  $('position').value = settings.start;
  $('position').disabled = settings.count === 52;
  $('instrument').value = settings.instrument;
  $('transpose').value = settings.transpose;
  $('slide').checked = settings.slide;
  $('theme').value = settings.theme;
  document.documentElement.dataset.theme = settings.theme;
  $('overview-window').style.left = `${settings.start / 52 * 100}%`;
  $('overview-window').style.width = `${settings.count / 52 * 100}%`;
  const range = viewport(settings);
  $('range-label').textContent = `${noteName(range.first)} — ${noteName(range.last)}`;
}
function layout() {
  cancelGesture();
  keyWidth = keyboard.clientWidth / settings.count;
  document.documentElement.style.setProperty('--key-width', `${keyWidth}px`);
  keyboard.scrollLeft = settings.start * keyWidth;
  updateControls();
}
async function prepareInstrument() {
  const version = ++loadVersion;
  cancelGesture();
  document.body.dataset.ready = 'false';
  $('loading').hidden = false;
  $('loading').textContent = 'Подготовка инструмента…';
  try {
    await audio.load(settings.instrument);
    if (version !== loadVersion) return;
    document.body.dataset.ready = 'true';
    $('loading').hidden = true;
  } catch {
    if (version !== loadVersion) return;
    $('loading').textContent = 'Не удалось загрузить звук. Проверьте интернет и попробуйте ещё раз.';
    const retry = document.createElement('button');
    retry.textContent = 'Повторить';retry.onclick = prepareInstrument;
    $('loading').append(retry);
  }
}
keyboard.addEventListener('pointerdown', e => {
  if (pointer || dialog.open || document.body.dataset.ready !== 'true' || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, start: settings.start, sliding: false };
  // Synthetic events used by accessibility/testing have no active pointer capture.
  if (e.isTrusted) keyboard.setPointerCapture(e.pointerId);
  playKey(e.target.closest('.key') || keyAt(e.clientX, e.clientY));
});
keyboard.addEventListener('pointermove', e => {
  if (!pointer || pointer.id !== e.pointerId) return;
  e.preventDefault();
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  if (!pointer.sliding && gesturePhase(settings.slide, dx, dy) === 'slide') {
    pointer.sliding = true;
    silence();
  }
  if (pointer.sliding) {
    settings = normalizeSettings({ ...settings, start: pointer.start - dx / keyWidth });
    keyboard.scrollLeft = settings.start * keyWidth;
    updateControls();
  } else playKey(keyAt(e.clientX, e.clientY));
});
function endPointer(e) {
  if (!pointer || pointer.id !== e.pointerId) return;
  save();cancelGesture();
}
keyboard.addEventListener('pointerup', endPointer);
keyboard.addEventListener('pointercancel', endPointer);
keyboard.addEventListener('lostpointercapture', endPointer);
window.addEventListener('blur', cancelGesture);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture(); });
window.addEventListener('pagehide', cancelGesture);
new ResizeObserver(layout).observe(keyboard);
$('settings-button').addEventListener('click', () => { cancelGesture();dialog.showModal(); });
$('close-settings').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) {
  const rect = dialog.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
} });
dialog.addEventListener('close', cancelGesture);
$('scale').addEventListener('input', e => {
  const count = Number(e.target.value);
  const center = settings.start + settings.count / 2;
  settings = normalizeSettings({ ...settings, count, start: center - count / 2 });
  save();layout();
});
$('position').addEventListener('input', e => {
  settings = normalizeSettings({ ...settings, start: Number(e.target.value) });
  save();layout();
});
// The miniature is also a direct register selector.
let overviewPointer = null;
function moveOverview(e) {
  const rect = $('overview').getBoundingClientRect();
  settings = normalizeSettings({ ...settings, start: (e.clientX - rect.left) / rect.width * 52 - settings.count / 2 });
  save();layout();
}
$('overview').addEventListener('pointerdown', e => {
  if (overviewPointer !== null) return;
  overviewPointer = e.pointerId;$('overview').setPointerCapture(e.pointerId);moveOverview(e);
});
$('overview').addEventListener('pointermove', e => { if (e.pointerId === overviewPointer) moveOverview(e); });
for (const type of ['pointerup','pointercancel','lostpointercapture']) $('overview').addEventListener(type, () => { overviewPointer = null; });
$('overview').style.touchAction = 'none';
$('slide').addEventListener('change', e => { cancelGesture();settings.slide = e.target.checked;save(); });
$('transpose').addEventListener('change', e => { cancelGesture();settings.transpose = e.target.value;save(); });
$('instrument').addEventListener('change', e => { settings.instrument = e.target.value;save();prepareInstrument(); });
$('reset').addEventListener('click', () => { settings = normalizeSettings();save();layout();prepareInstrument(); });
layout();
prepareInstrument();

$('theme').addEventListener('change', e => { settings.theme = e.target.value;save();updateControls(); });

async function enableOffline() {
  const status = $('offline-status');
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'Офлайн-режим недоступен в этом браузере.';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    if (!registration.active && registration.installing) {
      const worker = registration.installing;
      await new Promise((resolve, reject) => {
        const check = () => {
          if (worker.state === 'activated') resolve();
          if (worker.state === 'redundant') reject(new Error('Не удалось сохранить приложение'));
        };
        worker.addEventListener('statechange', check);check();
      });
    }
    await navigator.serviceWorker.ready;
    document.body.dataset.offline = 'ready';
    status.textContent = 'Готово к работе без интернета · все инструменты';
  } catch {
    document.body.dataset.offline = 'error';
    status.textContent = 'Не удалось сохранить офлайн. ';
    const retry = document.createElement('button');
    retry.className = 'offline-retry';retry.textContent = 'Повторить';
    retry.onclick = () => { status.textContent = 'Сохраняем…';enableOffline(); };
    status.append(retry);
  }
}
enableOffline();
