import {
  agentGateway,
  type AgentGatewayResult,
  type ResolvedAgentGatewayRequest,
} from './agent-gateway.service.js';
import {
  agentRunner,
  type AgentPlatform,
  type ProviderConfig,
} from './agent-runner.service.js';

export interface WorkflowAgentDispatchRequest {
  useA2AAdapter: boolean;
  agentId: string;
  platform: AgentPlatform;
  workspacePath: string;
  inputText: string;
  providerConfig?: ProviderConfig;
  timeoutMs?: number;
}

export interface WorkflowAgentDispatchDependencies {
  gateway?: {
    runResolvedAgentTask: (input: ResolvedAgentGatewayRequest) => Promise<AgentGatewayResult>;
  };
  runner?: {
    executeMessage: (
      agentId: string,
      platform: AgentPlatform,
      workspacePath: string,
      message: string,
      providerConfig?: ProviderConfig,
      timeoutMs?: number
    ) => Promise<string>;
  };
}

export async function dispatchWorkflowAgentTask(
  input: WorkflowAgentDispatchRequest,
  dependencies: WorkflowAgentDispatchDependencies = {}
): Promise<string> {
  if (!input.useA2AAdapter) {
    return (dependencies.runner || agentRunner).executeMessage(
      input.agentId,
      input.platform,
      input.workspacePath,
      input.inputText,
      input.providerConfig,
      input.timeoutMs
    );
  }

  const result = await (dependencies.gateway || agentGateway).runResolvedAgentTask({
    agent: {
      id: input.agentId,
      platform: input.platform,
      workspacePath: input.workspacePath,
      providerConfig: input.providerConfig,
    },
    inputText: input.inputText,
    timeoutMs: input.timeoutMs,
  });

  if (!result.success) {
    throw new Error(result.error || `Agent Gateway failed for ${input.agentId}`);
  }

  return result.outputText || '';
}
