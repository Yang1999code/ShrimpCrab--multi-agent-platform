import assert from 'node:assert/strict';
import { AgentGatewayService } from '../services/agent-gateway.service.js';

const calls: Array<{
  agentId: string;
  platform: string;
  workspacePath: string;
  message: string;
  apiKey?: string;
  stateDir?: string | null;
  runtimeMode?: string;
  timeoutMs?: number;
}> = [];

const gateway = new AgentGatewayService({
  resolveAgent: async ({ agentId, userId }) => {
    if (agentId !== 'agent-1' || userId !== 'user-1') return null;
    return {
      id: 'agent-1',
      platform: 'opencode',
      workspacePath: 'C:/tmp/openclaw-agent-workspace',
      providerConfig: {
        apiKey: '',
        providerType: 'opencode',
        runtimeMode: 'system',
      },
    };
  },
  runner: {
    executeMessage: async (agentId, platform, workspacePath, message, providerConfig, timeoutMs) => {
      calls.push({
        agentId,
        platform,
        workspacePath,
        message,
        apiKey: providerConfig?.apiKey,
        stateDir: providerConfig?.stateDir,
        runtimeMode: providerConfig?.runtimeMode,
        timeoutMs,
      });
      return `runner:${platform}:${message}`;
    },
  },
});

async function main(): Promise<void> {
  const success = await gateway.runAgentTask({
    userId: 'user-1',
    agentId: 'agent-1',
    inputText: 'hello gateway',
    timeoutMs: 1000,
  });

  assert.equal(success.success, true);
  assert.equal(success.outputText, 'runner:opencode:hello gateway');
  assert.equal(success.platform, 'opencode');
  assert.equal(success.agentId, 'agent-1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    agentId: 'agent-1',
    platform: 'opencode',
    workspacePath: 'C:/tmp/openclaw-agent-workspace',
    message: 'hello gateway',
    apiKey: '',
    stateDir: undefined,
    runtimeMode: 'system',
    timeoutMs: 1000,
  });

  const resolved = await gateway.runResolvedAgentTask({
    agent: {
      id: 'workflow-agent',
      platform: 'claude-code',
      workspacePath: 'C:/tmp/shared-project-workspace',
      providerConfig: {
        apiKey: 'workflow-provider-key',
        providerType: 'anthropic',
        stateDir: 'C:/tmp/workflow-state',
        runtimeMode: 'managed',
      },
    },
    inputText: 'execute workflow node',
    timeoutMs: 4321,
  });

  assert.equal(resolved.success, true);
  assert.equal(resolved.outputText, 'runner:claude-code:execute workflow node');
  assert.equal(resolved.agentId, 'workflow-agent');
  assert.equal(resolved.platform, 'claude-code');
  assert.deepEqual(calls[1], {
    agentId: 'workflow-agent',
    platform: 'claude-code',
    workspacePath: 'C:/tmp/shared-project-workspace',
    message: 'execute workflow node',
    apiKey: 'workflow-provider-key',
    stateDir: 'C:/tmp/workflow-state',
    runtimeMode: 'managed',
    timeoutMs: 4321,
  });

  const missing = await gateway.runAgentTask({
    userId: 'user-1',
    agentId: 'missing-agent',
    inputText: 'hello missing',
  });

  assert.equal(missing.success, false);
  assert.equal(missing.agentId, 'missing-agent');
  assert.match(missing.error || '', /not found/i);

  const invalidInput = await gateway.runAgentTask({
    userId: 'user-1',
    agentId: 'agent-1',
    inputText: '   ',
  });

  assert.equal(invalidInput.success, false);
  assert.match(invalidInput.error || '', /inputText/i);

  console.log('PASS assert-agent-gateway');
}

void main();
