import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPlaygroundRuntimeMode,
  resolvePlaygroundRuntime,
} from '../src/routes/playground';

test('resolvePlaygroundRuntime awaits the runtime getter result', async () => {
  const runtime = {
    async *streamText() {
      yield { type: 'text_delta', text: 'hello' };
    },
  };

  const resolved = await resolvePlaygroundRuntime(async () => runtime, async () => null);

  assert.equal(resolved, runtime);
});

test('resolvePlaygroundRuntime prefers module exports when generateText is exported at top level', async () => {
  let getterCalled = false;
  const moduleRuntime = {
    async generateText() {
      return { text: 'live' };
    },
  };

  const resolved = await resolvePlaygroundRuntime(
    async () => {
      getterCalled = true;
      return { legacy: true };
    },
    async () => moduleRuntime,
  );

  assert.equal(resolved, moduleRuntime);
  assert.equal(getterCalled, false);
});

test('resolvePlaygroundRuntime returns null when runtime loading fails', async () => {
  const resolved = await resolvePlaygroundRuntime(
    async () => {
      throw new Error('runtime unavailable');
    },
    async () => null,
  );

  assert.equal(resolved, null);
});

test('getPlaygroundRuntimeMode reports live only when the required method exists', () => {
  assert.equal(getPlaygroundRuntimeMode({ streamText() {} }, 'streamText'), 'live');
  assert.equal(getPlaygroundRuntimeMode({ generateText() {} }, 'generateText'), 'live');
  assert.equal(getPlaygroundRuntimeMode({}, 'streamText'), 'stub');
  assert.equal(getPlaygroundRuntimeMode(null, 'generateText'), 'stub');
});
