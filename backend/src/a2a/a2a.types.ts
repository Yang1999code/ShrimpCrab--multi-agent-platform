export const A2A_TASK_STATES = [
  'submitted',
  'working',
  'input-required',
  'completed',
  'failed',
  'canceled',
] as const;

export type A2ATaskState = typeof A2A_TASK_STATES[number];
export type A2ARole = 'user' | 'agent' | 'system';

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface A2AAgentCard {
  id: string;
  name: string;
  description: string;
  version: string;
  url: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  skills: A2ASkill[];
  metadata?: Record<string, unknown>;
}

export type A2APart =
  | { kind: 'text'; text: string }
  | { kind: 'file'; name: string; mimeType?: string; uri?: string; bytesBase64?: string }
  | { kind: 'data'; data: Record<string, unknown> };

export interface A2AMessage {
  role: A2ARole;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export interface A2AArtifact {
  id: string;
  name: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export interface A2ATask {
  id: string;
  contextId?: string;
  status: {
    state: A2ATaskState;
    message?: A2AMessage;
    timestamp: string;
  };
  artifacts: A2AArtifact[];
  metadata?: Record<string, unknown>;
}

export interface A2ATaskEvent {
  id: string;
  taskId: string;
  timestamp: string;
  task: A2ATask;
}

export function isA2ATaskState(value: unknown): value is A2ATaskState {
  return typeof value === 'string' && A2A_TASK_STATES.includes(value as A2ATaskState);
}

export function createA2ATextMessage(
  role: A2ARole,
  text: string,
  metadata?: Record<string, unknown>
): A2AMessage {
  return {
    role,
    parts: [{ kind: 'text', text }],
    ...(metadata ? { metadata } : {}),
  };
}

export function createSubmittedA2ATask(input: {
  id: string;
  contextId?: string;
  message: A2AMessage;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}): A2ATask {
  return {
    id: input.id,
    ...(input.contextId ? { contextId: input.contextId } : {}),
    status: {
      state: 'submitted',
      message: input.message,
      timestamp: input.timestamp || new Date().toISOString(),
    },
    artifacts: [],
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
