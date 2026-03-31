import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWorkbenchDefaultLlm } from '../src/lib/agentos';

test('resolveWorkbenchDefaultLlm prefers OpenAI when both OpenAI and Anthropic keys exist', () => {
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousAnthropic = process.env.ANTHROPIC_API_KEY;
  const previousGemini = process.env.GEMINI_API_KEY;

  process.env.OPENAI_API_KEY = 'sk-openai-test';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.GEMINI_API_KEY = 'gemini-test';

  try {
    assert.deepEqual(resolveWorkbenchDefaultLlm(), {
      providerId: 'openai',
      modelId: 'gpt-4o',
    });
  } finally {
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;

    if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousAnthropic;

    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
  }
});

test('resolveWorkbenchDefaultLlm falls back to Anthropic when OpenAI is unavailable', () => {
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousAnthropic = process.env.ANTHROPIC_API_KEY;

  delete process.env.OPENAI_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

  try {
    assert.deepEqual(resolveWorkbenchDefaultLlm(), {
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-0',
    });
  } finally {
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;

    if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousAnthropic;
  }
});
