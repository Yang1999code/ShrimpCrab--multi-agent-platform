import {
  getAgentBaseDefinition,
  getAgentBaseDefinitions,
  isAgentBaseId,
  type AgentBaseId,
} from '../services/agent-base-registry.service.js';
import type { A2AAgentCard, A2ASkill } from './a2a.types.js';

const SKILLS_BY_PLATFORM: Record<AgentBaseId, A2ASkill[]> = {
  openclaw: [
    {
      id: 'workflow',
      name: 'Workflow',
      description: 'Participates in local workspace and workflow orchestration tasks.',
      tags: ['workflow', 'workspace', 'chat'],
    },
    {
      id: 'workspace',
      name: 'Workspace',
      description: 'Works against a local project workspace.',
      tags: ['workspace'],
    },
  ],
  'claude-code': [
    {
      id: 'coding',
      name: 'Coding',
      description: 'Handles coding, repository analysis, and engineering tasks through Claude Code CLI.',
      tags: ['coding', 'analysis', 'repo-task'],
    },
  ],
  hermes: [
    {
      id: 'automation',
      name: 'Automation',
      description: 'Handles memory, skills, lightweight tools, and automation-oriented tasks.',
      tags: ['memory', 'automation', 'tool-task'],
    },
  ],
  opencode: [
    {
      id: 'coding',
      name: 'Coding',
      description: 'Handles coding and terminal-native repository tasks through OpenCode CLI.',
      tags: ['coding', 'terminal', 'repo-task'],
    },
  ],
};

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim() || '/api/a2a/cards';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function getA2AAgentCards(baseUrl = '/api/a2a/cards'): A2AAgentCard[] {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return getAgentBaseDefinitions().map((base) => ({
    id: base.id,
    name: base.displayName,
    description: base.descriptionZh,
    version: '1.0.0',
    url: `${normalizedBaseUrl}/${base.id}`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: SKILLS_BY_PLATFORM[base.id],
    metadata: {
      platform: base.id,
      docsUrl: base.docsUrl,
      installUrl: base.installUrl,
      runtimeModes: ['system', 'managed'],
      managedInstallSupported: base.managedInstallSupported,
      riskNoteZh: base.riskNoteZh,
    },
  }));
}

export function getA2AAgentCard(platform: string, baseUrl = '/api/a2a/cards'): A2AAgentCard {
  if (!isAgentBaseId(platform)) {
    throw new Error(`Unsupported A2A agent card platform: ${platform}`);
  }

  const base = getAgentBaseDefinition(platform);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    id: base.id,
    name: base.displayName,
    description: base.descriptionZh,
    version: '1.0.0',
    url: `${normalizedBaseUrl}/${base.id}`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: SKILLS_BY_PLATFORM[base.id],
    metadata: {
      platform: base.id,
      docsUrl: base.docsUrl,
      installUrl: base.installUrl,
      runtimeModes: ['system', 'managed'],
      managedInstallSupported: base.managedInstallSupported,
      riskNoteZh: base.riskNoteZh,
    },
  };
}

export function getA2AInstanceAgentCard(
  agent: {
    id: string;
    name: string;
    description: string;
    sourceVersion: string;
    tags: string;
  },
  platform: string,
  baseUrl = '/api/a2a/agents'
): A2AAgentCard {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const platformSkills = isAgentBaseId(platform)
    ? SKILLS_BY_PLATFORM[platform]
    : [{
        id: 'general-task',
        name: 'General Task',
        description: `Executes tasks through the ${platform} runtime.`,
        tags: [platform, 'task'],
      }];
  const tags = parseStringArray(agent.tags);
  const skills = platformSkills.map((skill) => ({
    ...skill,
    tags: Array.from(new Set([...skill.tags, ...tags])),
  }));

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    version: agent.sourceVersion || '1.0.0',
    url: `${normalizedBaseUrl}/${encodeURIComponent(agent.id)}`,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills,
    metadata: {
      agentId: agent.id,
      platform,
      authentication: 'JWT',
      taskEvents: true,
      cancellationMode: 'logical',
    },
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}
