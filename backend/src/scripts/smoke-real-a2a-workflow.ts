import assert from 'node:assert/strict';

const backendBaseUrl = process.env.SMOKE_BACKEND_URL || 'http://127.0.0.1:3002';
const frontendBaseUrl = process.env.SMOKE_FRONTEND_URL || 'http://127.0.0.1:3000';

const workflowDsl = {
  schemaVersion: '1.0' as const,
  name: '真实 HTTP A2A 验证流程',
  description: '从开始节点经过 Agent 节点再到结束节点。',
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

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<{ response: Response; body: T }> {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({})) as T;
  return { response, body };
}

async function waitForExecution(
  executionId: string,
  token: string
): Promise<{
  id: string;
  status: string;
  useA2AAdapter: boolean;
  finalOutput?: string;
  nodeStates: Record<string, { executionChannel?: string; output?: string }>;
}> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const { response, body } = await requestJson<{
      execution?: {
        id: string;
        status: string;
        useA2AAdapter: boolean;
        finalOutput?: string;
        nodeStates: Record<string, { executionChannel?: string; output?: string }>;
      };
    }>(`/api/workflows/executions/${executionId}`, {}, token);
    assert.equal(response.status, 200);
    assert.ok(body.execution);
    if (['succeeded', 'failed', 'cancelled'].includes(body.execution.status)) {
      return body.execution;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Workflow execution timed out: ${executionId}`);
}

async function startWorkflow(
  token: string,
  projectId: string,
  architectureId: string,
  useA2AAdapter: boolean
) {
  const { response, body } = await requestJson<{
    execution?: { id: string; useA2AAdapter: boolean };
  }>(
    '/api/workflows/execute',
    {
      method: 'POST',
      body: JSON.stringify({
        workflowDsl,
        task: '生成一份项目执行结果',
        projectId,
        architectureId,
        dryRun: true,
        useA2AAdapter,
      }),
    },
    token
  );
  assert.equal(response.status, 202);
  assert.ok(body.execution?.id);
  assert.equal(body.execution?.useA2AAdapter, useA2AAdapter);
  return waitForExecution(body.execution.id, token);
}

async function main(): Promise<void> {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `a2a-smoke-${nonce}@example.com`;
  const password = 'SmokePass123!';
  let token = '';
  let projectId = '';
  let architectureId = '';

  try {
    const frontend = await fetch(frontendBaseUrl);
    assert.equal(frontend.status, 200);
    const frontendHtml = await frontend.text();
    assert.match(frontendHtml, /__next|NEXT_DATA|OpenClaw|龙虾/i);

  const registered = await requestJson<{
    accessToken?: string;
    user?: { id?: string; email?: string };
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      username: `smoke_${nonce.replace(/\W/g, '').slice(-12)}`,
      password,
    }),
  });
  assert.equal(registered.response.status, 201);
  assert.ok(registered.body.accessToken);
  token = registered.body.accessToken;

  const loggedIn = await requestJson<{ accessToken?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loggedIn.response.status, 200);
  assert.ok(loggedIn.body.accessToken);
  token = loggedIn.body.accessToken;

  const me = await requestJson<{ email?: string }>('/auth/me', {}, token);
  assert.equal(me.response.status, 200);
  assert.equal(me.body.email, email);

  const cards = await requestJson<{ cards?: Array<{ id: string }> }>('/api/a2a/cards', {}, token);
  assert.equal(cards.response.status, 200);
  assert.deepEqual(cards.body.cards?.map((card) => card.id), [
    'openclaw',
    'claude-code',
    'hermes',
    'opencode',
  ]);

  const missingTask = await requestJson<{
    task?: { status?: { state?: string } };
  }>(
    '/api/a2a/agents/missing-agent/tasks',
    {
      method: 'POST',
      body: JSON.stringify({
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: '验证不存在 Agent 时不会伪造成功' }],
        },
      }),
    },
    token
  );
  assert.equal(missingTask.response.status, 200);
  assert.equal(missingTask.body.task?.status?.state, 'failed');

  const architecture = await requestJson<{
    architecture?: { id?: string };
  }>(
    '/api/architectures',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `A2A 验证团队 ${nonce}`,
        description: '临时端到端验证团队',
        agents: [],
        workflowDsl,
      }),
    },
    token
  );
  assert.equal(architecture.response.status, 201);
  assert.ok(architecture.body.architecture?.id);
  architectureId = architecture.body.architecture.id;

  const project = await requestJson<{
    project?: { id?: string; teamIds?: string[] };
  }>(
    '/api/projects',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `A2A 验证项目 ${nonce}`,
        description: '临时端到端验证项目',
        teamIds: [architectureId],
      }),
    },
    token
  );
  assert.equal(project.response.status, 201);
  assert.ok(project.body.project?.id);
  assert.deepEqual(project.body.project?.teamIds, [architectureId]);
  projectId = project.body.project.id;

  const viaA2A = await startWorkflow(token, projectId, architectureId, true);
  const viaDirect = await startWorkflow(token, projectId, architectureId, false);

  assert.equal(viaA2A.status, 'succeeded');
  assert.equal(viaDirect.status, 'succeeded');
  assert.equal(viaA2A.useA2AAdapter, true);
  assert.equal(viaDirect.useA2AAdapter, false);
  assert.equal(viaA2A.nodeStates.worker?.executionChannel, 'dry-run');
  assert.equal(viaDirect.nodeStates.worker?.executionChannel, 'dry-run');
  assert.equal(viaA2A.nodeStates.worker?.output, viaDirect.nodeStates.worker?.output);
  assert.match(viaA2A.finalOutput || '', /artifacts\/nodes\/worker-run-1\.md/);
  assert.match(viaDirect.finalOutput || '', /artifacts\/nodes\/worker-run-1\.md/);

    console.log(
      `PASS smoke-real-a2a-workflow frontend=200 cards=${cards.body.cards?.length} ` +
      `a2a=${viaA2A.status} direct=${viaDirect.status} nodeOutputsEqual=true`
    );
  } finally {
    if (token && projectId) {
      await requestJson(`/api/projects/${projectId}`, { method: 'DELETE' }, token);
    }
    if (token && architectureId) {
      await requestJson(`/api/architectures/${architectureId}`, { method: 'DELETE' }, token);
    }
  }
}

void main();
