import assert from 'node:assert/strict';
import { dispatchWorkflowAgentTask } from '../services/workflow-agent-dispatch.service.js';

async function main(): Promise<void> {
  const gatewayCalls: string[] = [];
  const runnerCalls: string[] = [];
  const request = {
    agentId: 'agent-workflow-1',
    platform: 'opencode' as const,
    workspacePath: 'C:/tmp/project-workspace',
    inputText: 'build the requested files',
    providerConfig: {
      apiKey: 'provider-key',
      providerType: 'openai-compatible',
      runtimeMode: 'managed' as const,
    },
    timeoutMs: 5000,
  };

  const viaGateway = await dispatchWorkflowAgentTask(
    { ...request, useA2AAdapter: true },
    {
      gateway: {
        runResolvedAgentTask: async (input) => {
          gatewayCalls.push(`${input.agent.id}:${input.inputText}:${input.timeoutMs}`);
          return {
            success: true,
            agentId: input.agent.id,
            platform: input.agent.platform,
            outputText: 'same workflow output',
          };
        },
      },
      runner: {
        executeMessage: async () => {
          throw new Error('direct runner must not be called');
        },
      },
    }
  );

  const viaRunner = await dispatchWorkflowAgentTask(
    { ...request, useA2AAdapter: false },
    {
      gateway: {
        runResolvedAgentTask: async () => {
          throw new Error('gateway must not be called');
        },
      },
      runner: {
        executeMessage: async (agentId, platform, workspacePath, inputText, providerConfig, timeoutMs) => {
          runnerCalls.push(
            `${agentId}:${platform}:${workspacePath}:${inputText}:${providerConfig?.runtimeMode}:${timeoutMs}`
          );
          return 'same workflow output';
        },
      },
    }
  );

  assert.equal(viaGateway, viaRunner);
  assert.deepEqual(gatewayCalls, ['agent-workflow-1:build the requested files:5000']);
  assert.deepEqual(runnerCalls, [
    'agent-workflow-1:opencode:C:/tmp/project-workspace:build the requested files:managed:5000',
  ]);

  await assert.rejects(
    dispatchWorkflowAgentTask(
      { ...request, useA2AAdapter: true },
      {
        gateway: {
          runResolvedAgentTask: async () => ({
            success: false,
            agentId: request.agentId,
            platform: request.platform,
            error: 'CLI unavailable',
          }),
        },
        runner: {
          executeMessage: async () => 'must not run',
        },
      }
    ),
    /CLI unavailable/
  );

  console.log('PASS assert-workflow-agent-dispatch');
}

void main();
