import assert from 'node:assert/strict';
import { A2ARouterService } from '../a2a/a2a-router.service.js';
import { A2ATaskStoreService } from '../a2a/a2a-task-store.service.js';
import { createA2ATextMessage } from '../a2a/a2a.types.js';

let releaseGateway: (() => void) | undefined;
const gatewayWait = new Promise<void>((resolve) => {
  releaseGateway = resolve;
});
const store = new A2ATaskStoreService();
const router = new A2ARouterService({
  store,
  gateway: {
    runAgentTask: async ({ agentId }) => {
      await gatewayWait;
      return {
        success: true,
        agentId,
        platform: 'opencode',
        outputText: 'late success',
      };
    },
  },
  createTaskId: () => 'task-lifecycle-1',
});

async function main(): Promise<void> {
  const submitted = router.startMessage({
    userId: 'user-1',
    agentId: 'agent-1',
    message: createA2ATextMessage('user', 'long task'),
  });

  assert.equal(['submitted', 'working'].includes(submitted.status.state), true);
  assert.equal(router.getTask('user-1', submitted.id)?.metadata?.agentId, 'agent-1');

  const canceled = router.cancelTask('user-1', submitted.id);
  assert.equal(canceled?.status.state, 'canceled');
  assert.equal(router.getTask('other-user', submitted.id), null);

  releaseGateway?.();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(router.getTask('user-1', submitted.id)?.status.state, 'canceled');
  assert.deepEqual(
    router.getTaskEvents('user-1', submitted.id)?.map((event) => event.task.status.state),
    ['submitted', 'working', 'canceled']
  );

  console.log('PASS assert-a2a-router-lifecycle');
}

void main();
