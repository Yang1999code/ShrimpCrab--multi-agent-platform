import assert from 'node:assert/strict';
import {
  a2aMessageToRuntimeText,
  gatewayResultToA2ATask,
} from '../a2a/a2a-task-mapper.service.js';
import { createA2ATextMessage } from '../a2a/a2a.types.js';

const text = a2aMessageToRuntimeText({
  role: 'user',
  parts: [
    { kind: 'text', text: 'first' },
    { kind: 'data', data: { ignored: true } },
    { kind: 'text', text: 'second' },
  ],
});
assert.equal(text, 'first\n\nsecond');

assert.throws(
  () => a2aMessageToRuntimeText({ role: 'user', parts: [{ kind: 'data', data: { only: 'data' } }] }),
  /text part/i
);

const completed = gatewayResultToA2ATask({
  taskId: 'task-1',
  contextId: 'ctx-1',
  inputMessage: createA2ATextMessage('user', 'hello'),
  result: {
    success: true,
    agentId: 'agent-1',
    platform: 'opencode',
    outputText: 'done',
    artifacts: [],
  },
});

assert.equal(completed.id, 'task-1');
assert.equal(completed.contextId, 'ctx-1');
assert.equal(completed.status.state, 'completed');
assert.equal(completed.status.message?.role, 'agent');
assert.deepEqual(completed.status.message?.parts[0], { kind: 'text', text: 'done' });
assert.equal(completed.metadata?.agentId, 'agent-1');
assert.equal(completed.metadata?.platform, 'opencode');

const failed = gatewayResultToA2ATask({
  taskId: 'task-2',
  inputMessage: createA2ATextMessage('user', 'hello'),
  result: {
    success: false,
    agentId: 'agent-1',
    error: 'CLI unavailable',
  },
});

assert.equal(failed.status.state, 'failed');
assert.equal(failed.status.message?.role, 'agent');
assert.deepEqual(failed.status.message?.parts[0], { kind: 'text', text: 'CLI unavailable' });

console.log('PASS assert-a2a-task-mapper');
