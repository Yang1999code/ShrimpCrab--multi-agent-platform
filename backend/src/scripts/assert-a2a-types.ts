import assert from 'node:assert/strict';
import {
  A2A_TASK_STATES,
  createA2ATextMessage,
  createSubmittedA2ATask,
  isA2ATaskState,
  type A2AAgentCard,
  type A2ATaskState,
} from '../a2a/a2a.types.js';

assert.deepEqual(A2A_TASK_STATES, [
  'submitted',
  'working',
  'input-required',
  'completed',
  'failed',
  'canceled',
]);

assert.equal(isA2ATaskState('submitted'), true);
assert.equal(isA2ATaskState('completed'), true);
assert.equal(isA2ATaskState('cancelled'), false);
assert.equal(isA2ATaskState('unknown'), false);

const state: A2ATaskState = 'working';
assert.equal(state, 'working');

const message = createA2ATextMessage('user', 'hello from A2A');
assert.equal(message.role, 'user');
assert.equal(message.parts.length, 1);
assert.deepEqual(message.parts[0], { kind: 'text', text: 'hello from A2A' });

const task = createSubmittedA2ATask({
  id: 'task-1',
  contextId: 'ctx-1',
  message,
  metadata: { source: 'assert-a2a-types' },
});

assert.equal(task.id, 'task-1');
assert.equal(task.contextId, 'ctx-1');
assert.equal(task.status.state, 'submitted');
assert.equal(task.status.message?.parts[0]?.kind, 'text');
assert.equal(task.artifacts.length, 0);
assert.equal(task.metadata?.source, 'assert-a2a-types');

const card: A2AAgentCard = {
  id: 'openclaw',
  name: 'OpenClaw/PI',
  description: 'Default local agent base',
  version: '1.0.0',
  url: '/api/a2a/cards/openclaw',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'workflow',
      name: 'Workflow',
      description: 'Can participate in local workflows',
      tags: ['workflow'],
    },
  ],
  metadata: { platform: 'openclaw' },
};

assert.equal(card.skills[0]?.id, 'workflow');
assert.equal(card.capabilities.streaming, false);

console.log('PASS assert-a2a-types');
