import assert from 'node:assert/strict';
import express from 'express';
import a2aRoutes from '../routes/a2a.routes.js';
import { generateToken } from '../utils/jwt.js';

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/a2a', a2aRoutes);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const unauthenticated = await fetch(`${baseUrl}/api/a2a/cards`);
    assert.equal(unauthenticated.status, 401);

    const token = generateToken({ userId: 'user-1', email: 'user@example.com' });
    const authenticated = await fetch(`${baseUrl}/api/a2a/cards`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(authenticated.status, 200);
    const cardsBody = await authenticated.json() as { cards?: Array<{ id: string }> };
    assert.deepEqual(
      cardsBody.cards?.map((card) => card.id),
      ['openclaw', 'claude-code', 'hermes', 'opencode']
    );

    const openclaw = await fetch(`${baseUrl}/api/a2a/cards/openclaw`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(openclaw.status, 200);
    const openclawBody = await openclaw.json() as { card?: { id: string; name: string } };
    assert.equal(openclawBody.card?.id, 'openclaw');
    assert.equal(openclawBody.card?.name, 'OpenClaw/PI');

    const invalid = await fetch(`${baseUrl}/api/a2a/cards/codex`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(invalid.status, 400);

    const missingAgentTask = await fetch(`${baseUrl}/api/a2a/agents/missing-agent/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: 'hello missing agent' }],
        },
        contextId: 'ctx-smoke',
      }),
    });
    assert.equal(missingAgentTask.status, 200);
    const taskBody = await missingAgentTask.json() as { task?: { status?: { state?: string } } };
    assert.equal(taskBody.task?.status?.state, 'failed');

    const invalidMessageTask = await fetch(`${baseUrl}/api/a2a/agents/missing-agent/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          role: 'user',
          parts: [{ kind: 'data', data: { unsupported: true } }],
        },
      }),
    });
    assert.equal(invalidMessageTask.status, 400);

    const missingAgentCard = await fetch(`${baseUrl}/api/a2a/agents/missing-agent/card`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(missingAgentCard.status, 404);

    const asyncTaskResponse = await fetch(`${baseUrl}/api/a2a/agents/missing-agent/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: 'hello async missing agent' }],
        },
        waitForCompletion: false,
      }),
    });
    assert.equal(asyncTaskResponse.status, 202);
    const asyncBody = await asyncTaskResponse.json() as {
      task?: { id?: string; status?: { state?: string } };
    };
    assert.ok(asyncBody.task?.id);
    assert.equal(['submitted', 'working'].includes(asyncBody.task?.status?.state || ''), true);

    let asyncState = '';
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const taskResponse = await fetch(`${baseUrl}/api/a2a/tasks/${asyncBody.task?.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(taskResponse.status, 200);
      const body = await taskResponse.json() as { task?: { status?: { state?: string } } };
      asyncState = body.task?.status?.state || '';
      if (['completed', 'failed', 'canceled'].includes(asyncState)) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(asyncState, 'failed');

    const eventsResponse = await fetch(`${baseUrl}/api/a2a/tasks/${asyncBody.task?.id}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(eventsResponse.status, 200);
    assert.match(eventsResponse.headers.get('content-type') || '', /text\/event-stream/);
    const eventsText = await eventsResponse.text();
    assert.match(eventsText, /submitted/);
    assert.match(eventsText, /working/);
    assert.match(eventsText, /failed/);

    const cancelTerminal = await fetch(`${baseUrl}/api/a2a/tasks/${asyncBody.task?.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(cancelTerminal.status, 200);
    const cancelBody = await cancelTerminal.json() as {
      task?: { status?: { state?: string } };
    };
    assert.equal(cancelBody.task?.status?.state, 'failed');

    const missingTaskLookup = await fetch(`${baseUrl}/api/a2a/tasks/not-found`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(missingTaskLookup.status, 404);

    console.log('PASS smoke-a2a-routes');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

void main();
