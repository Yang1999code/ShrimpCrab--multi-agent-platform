import assert from 'node:assert/strict';
import { A2ARouterService } from '../a2a/a2a-router.service.js';
import { createA2ATextMessage } from '../a2a/a2a.types.js';

const router = new A2ARouterService({
  gateway: {
    runAgentTask: async ({ agentId, inputText }) => ({
      success: true,
      agentId,
      platform: 'opencode',
      outputText: `gateway:${inputText}`,
      artifacts: [],
    }),
  },
  createTaskId: () => 'task-fixed',
});

async function main(): Promise<void> {
  const task = await router.sendMessage({
    userId: 'user-1',
    agentId: 'agent-1',
    message: createA2ATextMessage('user', 'hello router'),
    contextId: 'ctx-1',
  });

  assert.equal(task.id, 'task-fixed');
  assert.equal(task.contextId, 'ctx-1');
  assert.equal(task.status.state, 'completed');
  assert.deepEqual(task.status.message?.parts[0], { kind: 'text', text: 'gateway:hello router' });
  assert.equal(task.metadata?.agentId, 'agent-1');
  assert.equal(task.metadata?.platform, 'opencode');

  const failed = await new A2ARouterService({
    gateway: {
      runAgentTask: async ({ agentId }) => ({
        success: false,
        agentId,
        error: 'not available',
      }),
    },
    createTaskId: () => 'task-failed',
  }).sendMessage({
    userId: 'user-1',
    agentId: 'agent-2',
    message: createA2ATextMessage('user', 'hello failed'),
  });

  assert.equal(failed.status.state, 'failed');
  assert.deepEqual(failed.status.message?.parts[0], { kind: 'text', text: 'not available' });

  await assert.rejects(
    () => router.sendMessage({
      userId: 'user-1',
      agentId: 'agent-1',
      message: { role: 'user', parts: [{ kind: 'data', data: { only: 'data' } }] },
    }),
    /text part/i
  );

  console.log('PASS assert-a2a-router-service');
}

void main();
