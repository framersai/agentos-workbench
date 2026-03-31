import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkbenchProcessRequestInput } from '../src/routes/agentos';

test('buildWorkbenchProcessRequestInput forwards workflow, agency, and preferred model options', () => {
  const workflowRequest = {
    definitionId: 'local.research-and-publish',
    workflowId: 'wf-123',
    conversationId: 'session-123',
    metadata: { source: 'test' },
  };
  const agencyRequest = {
    agencyId: 'agency-123',
    workflowId: 'wf-123',
    goal: 'Research and summarize',
    participants: [{ roleId: 'lead', personaId: 'v_researcher' }],
  };

  const input = buildWorkbenchProcessRequestInput({
    userId: 'workbench-user',
    sessionId: 'session-123',
    conversationId: 'session-123',
    selectedPersonaId: 'v_researcher',
    textInput: 'Hello',
    model: 'gpt-4o-mini',
    workflowRequest,
    agencyRequest,
  });

  assert.equal(input.userId, 'workbench-user');
  assert.equal(input.sessionId, 'session-123');
  assert.equal(input.conversationId, 'session-123');
  assert.equal(input.selectedPersonaId, 'v_researcher');
  assert.equal(input.textInput, 'Hello');
  assert.deepEqual(input.workflowRequest, workflowRequest);
  assert.deepEqual(input.agencyRequest, agencyRequest);
  assert.equal(input.options?.preferredModelId, 'gpt-4o-mini');
  assert.equal(input.options?.preferredProviderId, 'openai');
});

test('buildWorkbenchProcessRequestInput falls back to defaults when optional fields are omitted', () => {
  const input = buildWorkbenchProcessRequestInput({
    textInput: 'Hi',
  });

  assert.equal(input.userId, 'anonymous');
  assert.equal(input.textInput, 'Hi');
  assert.equal(typeof input.sessionId, 'string');
  assert.equal(input.selectedPersonaId, undefined);
  assert.equal(input.workflowRequest, undefined);
  assert.equal(input.agencyRequest, undefined);
  assert.equal(input.options, undefined);
});

test('buildWorkbenchProcessRequestInput preserves an explicit provider override', () => {
  const input = buildWorkbenchProcessRequestInput({
    textInput: 'Hello',
    model: 'claude-sonnet-4-0',
    providerId: 'anthropic',
  });

  assert.equal(input.options?.preferredModelId, 'claude-sonnet-4-0');
  assert.equal(input.options?.preferredProviderId, 'anthropic');
});
