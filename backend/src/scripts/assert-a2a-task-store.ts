import assert from 'node:assert/strict';
import { A2ATaskStoreService } from '../a2a/a2a-task-store.service.js';
import { createSubmittedA2ATask, createA2ATextMessage } from '../a2a/a2a.types.js';

const store = new A2ATaskStoreService();
const task = createSubmittedA2ATask({
  id: 'task-store-1',
  message: createA2ATextMessage('user', 'run task'),
  timestamp: '2026-06-18T00:00:00.000Z',
});

store.create('user-1', 'agent-1', task);
store.update('user-1', task.id, {
  status: {
    state: 'working',
    timestamp: '2026-06-18T00:00:01.000Z',
  },
});

assert.equal(store.get('user-1', task.id)?.status.state, 'working');
assert.equal(store.get('other-user', task.id), null);
assert.deepEqual(
  store.getEvents('user-1', task.id)?.map((event) => event.task.status.state),
  ['submitted', 'working']
);

const canceled = store.cancel('user-1', task.id);
assert.equal(canceled?.status.state, 'canceled');
assert.equal(canceled?.metadata?.cancellationMode, 'logical');

const ignoredLateCompletion = store.update('user-1', task.id, {
  status: {
    state: 'completed',
    timestamp: '2026-06-18T00:00:02.000Z',
  },
});
assert.equal(ignoredLateCompletion?.status.state, 'canceled');

console.log('PASS assert-a2a-task-store');
