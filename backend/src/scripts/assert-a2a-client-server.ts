import assert from 'node:assert/strict';
import { A2AClientService } from '../a2a/a2a-client.service.js';
import { createA2ATextMessage } from '../a2a/a2a.types.js';

const calls: string[] = [];
const client = new A2AClientService({
  localServer: {
    sendTask: async ({ userId, agentId, message }) => {
      calls.push(`${userId}:${agentId}:${message.parts.length}`);
      return {
        id: 'task-client-1',
        status: {
          state: 'completed',
          timestamp: '2026-06-18T00:00:00.000Z',
          message: createA2ATextMessage('agent', 'client result'),
        },
        artifacts: [],
      };
    },
  },
});

async function main(): Promise<void> {
  const task = await client.sendMessage({
    userId: 'user-1',
    agentRef: { kind: 'local', agentId: 'agent-1' },
    message: createA2ATextMessage('user', 'hello client'),
  });

  assert.equal(task.status.state, 'completed');
  assert.deepEqual(calls, ['user-1:agent-1:1']);

  await assert.rejects(
    client.sendMessage({
      userId: 'user-1',
      agentRef: { kind: 'remote', remoteAgentId: 'remote-1' },
      message: createA2ATextMessage('user', 'hello remote'),
    }),
    /not implemented/i
  );

  console.log('PASS assert-a2a-client-server');
}

void main();
