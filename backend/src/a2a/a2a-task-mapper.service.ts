import type { AgentGatewayResult } from '../services/agent-gateway.service.js';
import {
  createA2ATextMessage,
  type A2AMessage,
  type A2ATask,
} from './a2a.types.js';
import type {
  WorkflowArtifact,
  WorkflowNodeExecutionStatus,
} from '../services/workflow-executor.service.js';

export function a2aMessageToRuntimeText(message: A2AMessage): string {
  const textParts = message.parts
    .filter((part) => part.kind === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (textParts.length === 0) {
    throw new Error('A2A message must include at least one text part in the first version.');
  }

  return textParts.join('\n\n');
}

export function gatewayResultToA2ATask(input: {
  taskId: string;
  contextId?: string;
  inputMessage: A2AMessage;
  result: AgentGatewayResult;
  timestamp?: string;
}): A2ATask {
  const timestamp = input.timestamp || new Date().toISOString();
  const outputText = input.result.success
    ? input.result.outputText || 'Agent completed without output.'
    : input.result.error || 'Agent task failed.';

  return {
    id: input.taskId,
    ...(input.contextId ? { contextId: input.contextId } : {}),
    status: {
      state: input.result.success ? 'completed' : 'failed',
      message: createA2ATextMessage('agent', outputText),
      timestamp,
    },
    artifacts: [],
    metadata: {
      agentId: input.result.agentId,
      platform: input.result.platform,
      inputRole: input.inputMessage.role,
    },
  };
}

export function workflowStatusToA2AState(
  status: WorkflowNodeExecutionStatus
): A2ATask['status']['state'] {
  switch (status) {
    case 'pending':
    case 'ready':
      return 'submitted';
    case 'running':
      return 'working';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'canceled';
  }
}

export function workflowArtifactToA2AArtifact(
  artifact: WorkflowArtifact,
  downloadBaseUrl: string
): A2ATask['artifacts'][number] {
  const separator = downloadBaseUrl.includes('?') ? '&' : '?';
  const uri = `${downloadBaseUrl}${separator}path=${encodeURIComponent(artifact.relativePath)}`;
  return {
    id: artifact.id,
    name: artifact.label,
    parts: [{
      kind: 'file',
      name: artifact.label,
      uri,
    }],
    metadata: {
      nodeId: artifact.nodeId,
      nodeLabel: artifact.nodeLabel,
      kind: artifact.kind,
      relativePath: artifact.relativePath,
      size: artifact.size,
      createdAt: artifact.createdAt,
    },
  };
}
