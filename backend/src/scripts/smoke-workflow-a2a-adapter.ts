import assert from 'node:assert/strict';
import express from 'express';
import workflowRoutes from '../routes/workflows.routes.js';
import { generateToken } from '../utils/jwt.js';

const workflowDsl = {
  schemaVersion: '1.0' as const,
  name: 'A2A adapter smoke workflow',
  description: 'Checks the workflow HTTP contract for the A2A adapter.',
  entryNodeId: 'start',
  nodes: [
    { id: 'start', type: 'start' as const, label: '开始' },
    {
      id: 'worker',
      type: 'agent' as const,
      label: '执行者',
      agentInstanceId: 'dry-run-agent',
      role: 'worker',
      kind: 'worker' as const,
    },
    { id: 'end', type: 'end' as const, label: '结束' },
  ],
  edges: [
    { id: 'edge-start-worker', from: 'start', to: 'worker' },
    { id: 'edge-worker-end', from: 'worker', to: 'end' },
  ],
  execution: {
    mode: 'dag' as const,
    maxConcurrency: 1,
    timeoutSec: 30,
  },
};

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/workflows', workflowRoutes);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = generateToken({ userId: 'workflow-a2a-user', email: 'workflow@example.com' });
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const startResponse = await fetch(`${baseUrl}/api/workflows/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workflowDsl,
        task: 'simulate a real project task',
        dryRun: true,
        useA2AAdapter: true,
      }),
    });
    assert.equal(startResponse.status, 202);
    const startBody = await startResponse.json() as {
      execution?: { id?: string; useA2AAdapter?: boolean };
    };
    assert.equal(startBody.execution?.useA2AAdapter, true);
    assert.ok(startBody.execution?.id);

    let execution: {
      status?: string;
      useA2AAdapter?: boolean;
      nodeStates?: Record<string, { executionChannel?: string }>;
    } | undefined;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const response = await fetch(
        `${baseUrl}/api/workflows/executions/${startBody.execution?.id}`,
        { headers }
      );
      assert.equal(response.status, 200);
      const body = await response.json() as { execution?: typeof execution };
      execution = body.execution;
      if (execution?.status === 'succeeded' || execution?.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    assert.equal(execution?.status, 'succeeded');
    assert.equal(execution?.useA2AAdapter, true);
    assert.equal(execution?.nodeStates?.worker?.executionChannel, 'dry-run');

    console.log('PASS smoke-workflow-a2a-adapter');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

void main();
