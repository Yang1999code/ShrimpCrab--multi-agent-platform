import { localA2AServer, type LocalA2AServerSendTaskInput } from './a2a-server.service.js';
import type { A2AMessage, A2ATask } from './a2a.types.js';

export type A2AAgentRef =
  | { kind: 'local'; agentId: string }
  | { kind: 'remote'; remoteAgentId: string };

export interface A2AClientDependencies {
  localServer?: {
    sendTask: (input: LocalA2AServerSendTaskInput) => Promise<A2ATask>;
  };
}

export class A2AClientService {
  private readonly localServer: NonNullable<A2AClientDependencies['localServer']>;

  constructor(dependencies: A2AClientDependencies = {}) {
    this.localServer = dependencies.localServer || localA2AServer;
  }

  async sendMessage(input: {
    userId: string;
    agentRef: A2AAgentRef;
    message: A2AMessage;
    contextId?: string;
    timeoutMs?: number;
  }): Promise<A2ATask> {
    if (input.agentRef.kind === 'remote') {
      throw new Error('Remote A2A agents are not implemented in the first version.');
    }

    return this.localServer.sendTask({
      userId: input.userId,
      agentId: input.agentRef.agentId,
      message: input.message,
      contextId: input.contextId,
      timeoutMs: input.timeoutMs,
    });
  }
}

export const a2aClient = new A2AClientService();
