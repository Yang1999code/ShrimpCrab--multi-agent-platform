import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import type { A2ATask, A2ATaskEvent } from './a2a.types.js';

interface StoredA2ATask {
  userId: string;
  agentId: string;
  task: A2ATask;
  events: A2ATaskEvent[];
}

const TERMINAL_STATES = new Set(['completed', 'failed', 'canceled']);

function cloneTask(task: A2ATask): A2ATask {
  return structuredClone(task);
}

export class A2ATaskStoreService extends EventEmitter {
  private readonly tasks = new Map<string, StoredA2ATask>();

  create(userId: string, agentId: string, task: A2ATask): A2ATask {
    const stored: StoredA2ATask = {
      userId,
      agentId,
      task: cloneTask(task),
      events: [],
    };
    this.tasks.set(task.id, stored);
    this.appendEvent(stored);
    return cloneTask(stored.task);
  }

  get(userId: string, taskId: string): A2ATask | null {
    const stored = this.tasks.get(taskId);
    return stored?.userId === userId ? cloneTask(stored.task) : null;
  }

  getEvents(userId: string, taskId: string): A2ATaskEvent[] | null {
    const stored = this.tasks.get(taskId);
    return stored?.userId === userId ? structuredClone(stored.events) : null;
  }

  update(userId: string, taskId: string, patch: Partial<A2ATask>): A2ATask | null {
    const stored = this.tasks.get(taskId);
    if (!stored || stored.userId !== userId) return null;
    if (TERMINAL_STATES.has(stored.task.status.state)) return cloneTask(stored.task);

    stored.task = {
      ...stored.task,
      ...patch,
      status: patch.status ? { ...stored.task.status, ...patch.status } : stored.task.status,
      artifacts: patch.artifacts ?? stored.task.artifacts,
      metadata: {
        ...(stored.task.metadata || {}),
        ...(patch.metadata || {}),
      },
    };
    this.appendEvent(stored);
    return cloneTask(stored.task);
  }

  cancel(userId: string, taskId: string): A2ATask | null {
    const stored = this.tasks.get(taskId);
    if (!stored || stored.userId !== userId) return null;
    if (TERMINAL_STATES.has(stored.task.status.state)) return cloneTask(stored.task);

    stored.task = {
      ...stored.task,
      status: {
        state: 'canceled',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        ...(stored.task.metadata || {}),
        cancellationMode: 'logical',
        cancellationNote: 'The result of the running external process will be ignored.',
      },
    };
    this.appendEvent(stored);
    return cloneTask(stored.task);
  }

  subscribe(
    userId: string,
    taskId: string,
    listener: (event: A2ATaskEvent) => void
  ): (() => void) | null {
    const stored = this.tasks.get(taskId);
    if (!stored || stored.userId !== userId) return null;
    const eventName = `task:${taskId}`;
    this.on(eventName, listener);
    return () => this.off(eventName, listener);
  }

  async waitForTerminal(userId: string, taskId: string): Promise<A2ATask | null> {
    const current = this.get(userId, taskId);
    if (!current || TERMINAL_STATES.has(current.status.state)) return current;

    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(userId, taskId, (event) => {
        if (!TERMINAL_STATES.has(event.task.status.state)) return;
        unsubscribe?.();
        resolve(event.task);
      });
      if (!unsubscribe) resolve(null);
    });
  }

  isTerminal(task: A2ATask): boolean {
    return TERMINAL_STATES.has(task.status.state);
  }

  private appendEvent(stored: StoredA2ATask): void {
    const event: A2ATaskEvent = {
      id: crypto.randomUUID(),
      taskId: stored.task.id,
      timestamp: stored.task.status.timestamp,
      task: cloneTask(stored.task),
    };
    stored.events.push(event);
    this.emit(`task:${stored.task.id}`, structuredClone(event));
  }
}

export const a2aTaskStore = new A2ATaskStoreService();
