import crypto from 'node:crypto';
import { agentGateway, type AgentGatewayRequest, type AgentGatewayResult } from '../services/agent-gateway.service.js';
import {
  createSubmittedA2ATask,
  type A2AMessage,
  type A2ATask,
  type A2ATaskEvent,
} from './a2a.types.js';
import { a2aMessageToRuntimeText, gatewayResultToA2ATask } from './a2a-task-mapper.service.js';
import { a2aTaskStore, type A2ATaskStoreService } from './a2a-task-store.service.js';

export interface A2ARouterSendMessageInput {
  userId: string;
  agentId: string;
  message: A2AMessage;
  contextId?: string;
  timeoutMs?: number;
}

export interface A2ARouterDependencies {
  gateway?: {
    runAgentTask: (input: AgentGatewayRequest) => Promise<AgentGatewayResult>;
  };
  createTaskId?: () => string;
  store?: A2ATaskStoreService;
}

export class A2ARouterService {
  private readonly gateway: NonNullable<A2ARouterDependencies['gateway']>;
  private readonly createTaskId: NonNullable<A2ARouterDependencies['createTaskId']>;
  private readonly store: A2ATaskStoreService;

  constructor(dependencies: A2ARouterDependencies = {}) {
    this.gateway = dependencies.gateway || agentGateway;
    this.createTaskId = dependencies.createTaskId || (() => crypto.randomUUID());
    this.store = dependencies.store || a2aTaskStore;
  }

  async sendMessage(input: A2ARouterSendMessageInput): Promise<A2ATask> {
    const submitted = this.startMessage(input);
    const terminal = await this.store.waitForTerminal(input.userId, submitted.id);
    if (!terminal) {
      throw new Error(`A2A task disappeared before completion: ${submitted.id}`);
    }
    return terminal;
  }

  startMessage(input: A2ARouterSendMessageInput): A2ATask {
    const runtimeText = a2aMessageToRuntimeText(input.message);
    const taskId = this.createTaskId();
    const submitted = this.store.create(input.userId, input.agentId, createSubmittedA2ATask({
      id: taskId,
      contextId: input.contextId,
      message: input.message,
      metadata: {
        agentId: input.agentId,
        cancellationMode: 'logical',
      },
    }));

    void this.executeTask(input, runtimeText, taskId);
    return submitted;
  }

  getTask(userId: string, taskId: string): A2ATask | null {
    return this.store.get(userId, taskId);
  }

  getTaskEvents(userId: string, taskId: string): A2ATaskEvent[] | null {
    return this.store.getEvents(userId, taskId);
  }

  cancelTask(userId: string, taskId: string): A2ATask | null {
    return this.store.cancel(userId, taskId);
  }

  subscribeToTask(
    userId: string,
    taskId: string,
    listener: (event: A2ATaskEvent) => void
  ): (() => void) | null {
    return this.store.subscribe(userId, taskId, listener);
  }

  isTerminal(task: A2ATask): boolean {
    return this.store.isTerminal(task);
  }

  private async executeTask(
    input: A2ARouterSendMessageInput,
    runtimeText: string,
    taskId: string
  ): Promise<void> {
    this.store.update(input.userId, taskId, {
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const result = await this.gateway.runAgentTask({
        userId: input.userId,
        agentId: input.agentId,
        inputText: runtimeText,
        contextId: input.contextId,
        timeoutMs: input.timeoutMs,
      });

      const terminal = gatewayResultToA2ATask({
        taskId,
        contextId: input.contextId,
        inputMessage: input.message,
        result,
      });
      this.store.update(input.userId, taskId, terminal);
    } catch (error) {
      const failed = gatewayResultToA2ATask({
        taskId,
        contextId: input.contextId,
        inputMessage: input.message,
        result: {
          success: false,
          agentId: input.agentId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      this.store.update(input.userId, taskId, failed);
    }
  }
}

export const a2aRouter = new A2ARouterService();
