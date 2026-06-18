import type { A2AAgentCard, A2AMessage, A2ATask } from './a2a.types.js';
import { a2aRouter } from './a2a-router.service.js';
import { getAgentByIdAndUser, readAgentUserConfig } from '../services/agent.service.js';
import { getA2AInstanceAgentCard } from './a2a-card.service.js';

export interface LocalA2AServerSendTaskInput {
  userId: string;
  agentId: string;
  message: A2AMessage;
  contextId?: string;
  timeoutMs?: number;
}

export class LocalA2AServerService {
  async getAgentCard(userId: string, agentId: string): Promise<A2AAgentCard | null> {
    const agent = await getAgentByIdAndUser(agentId, userId);
    if (!agent) return null;
    const config = readAgentUserConfig(agent);
    const platform = typeof config.platform === 'string' && config.platform.trim()
      ? config.platform.trim()
      : platformFromManifest(agent.manifest) || 'openclaw';
    return getA2AInstanceAgentCard(agent, platform, '/api/a2a/agents');
  }

  async sendTask(input: LocalA2AServerSendTaskInput): Promise<A2ATask> {
    return a2aRouter.sendMessage(input);
  }
}

export const localA2AServer = new LocalA2AServerService();

function platformFromManifest(manifestJson: string): string | null {
  try {
    const manifest = JSON.parse(manifestJson) as { entrypoint?: { type?: unknown } };
    return typeof manifest.entrypoint?.type === 'string' ? manifest.entrypoint.type : null;
  } catch {
    return null;
  }
}
