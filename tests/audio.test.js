import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PianoAudio } from '../audio.js';

test('release before AudioContext resume cannot start a ghost note', async () => {
  let resume;
  let sources = 0;
  const audio = new PianoAudio();
  audio.context = {
    state:'suspended',
    resume: () => new Promise(resolve => { resume = resolve; }),
    createBufferSource: () => { sources++; throw new Error('Should not create source after release'); },
  };
  audio.play(60,'piano');
  audio.stop();
  resume();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sources,0);
  assert.equal(audio.voice,null);
});
