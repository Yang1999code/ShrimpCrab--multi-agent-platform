import { getAgentByIdAndUser, readAgentUserConfig } from './agent.service.js';
import { agentRunner, type AgentPlatform, type ProviderConfig } from './agent-runner.service.js';
import { getProviderById } from './provider.service.js';
import { buildAgentRuntimePrompt } from './agent-runtime-context.service.js';
import { resolveStoredPath } from './workspace.service.js';

export interface AgentGatewayRequest {
  userId: string;
  agentId: string;
  inputText: string;
  contextId?: string;
  timeoutMs?: number;
}

export interface AgentGatewayResult {
  success: boolean;
  agentId: string;
  platform?: AgentPlatform;
  outputText?: string;
  artifacts?: unknown[];
  error?: string;
}

export interface AgentGatewayResolvedAgent {
  id: string;
  platform: AgentPlatform;
  workspacePath: string;
  providerConfig?: ProviderConfig;
  prepareInput?: (inputText: string) => string;
}

export interface ResolvedAgentGatewayRequest {
  agent: AgentGatewayResolvedAgent;
  inputText: string;
  contextId?: string;
  timeoutMs?: number;
}

export interface AgentGatewayDependencies {
  resolveAgent?: (input: { userId: string; agentId: string }) => Promise<AgentGatewayResolvedAgent | null>;
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

const SUPPORTED_GATEWAY_PLATFORMS: AgentPlatform[] = [
  'claude-code',
  'openclaw',
  'codex',
  'hermes',
  'opencode',
];

function isAgentPlatform(value: unknown): value is AgentPlatform {
  return typeof value === 'string' && SUPPORTED_GATEWAY_PLATFORMS.includes(value as AgentPlatform);
}

function platformFromManifest(manifestJson: string): AgentPlatform | null {
  try {
    const manifest = JSON.parse(manifestJson) as { entrypoint?: { type?: unknown } };
    return isAgentPlatform(manifest?.entrypoint?.type) ? manifest.entrypoint.type : null;
  } catch {
    return null;
  }
}

async function defaultResolveAgent(input: {
  userId: string;
  agentId: string;
}): Promise<AgentGatewayResolvedAgent | null> {
  const agent = await getAgentByIdAndUser(input.agentId, input.userId);
  if (!agent) return null;

  const userConfig = readAgentUserConfig(agent);
  const configPlatform = isAgentPlatform(userConfig.platform) ? userConfig.platform : null;
  const manifestPlatform = platformFromManifest(agent.manifest);
  const platform = configPlatform || manifestPlatform || 'openclaw';
  const runtimeMode = userConfig.runtimeMode === 'managed' ? 'managed' : 'system';
  const providerId = userConfig.providerId ?? agent.providerId ?? null;
  const provider = providerId ? await getProviderById(providerId, input.userId) : null;
  const selectedModel = typeof userConfig.model === 'string' ? userConfig.model.trim() : '';
  const stateDir = agent.stateDir ? resolveStoredPath(agent.stateDir) : null;
  const providerConfig = buildAgentGatewayProviderConfig({
    agentStateDir: stateDir,
    runtimeMode,
    selectedModel,
    provider,
  });

  return {
    id: agent.id,
    platform,
    workspacePath: resolveStoredPath(agent.workspacePath),
    providerConfig,
    prepareInput: (inputText) => buildAgentRuntimePrompt(agent, {
      userMessage: inputText,
      mode: 'direct-chat',
      platform,
      providerConfig,
      extraInstructions: [
        'This request came through the local A2A task endpoint.',
        'Complete the task directly and return a concrete result.',
      ],
    }),
  };
}

export function buildAgentGatewayProviderConfig(input: {
  agentStateDir: string | null;
  runtimeMode: 'system' | 'managed';
  selectedModel?: string;
  provider: {
    apiKey: string;
    baseUrl?: string | null;
    models?: string | null;
    type: string;
  } | null;
}): ProviderConfig {
  if (!input.provider) {
    return {
      apiKey: '',
      stateDir: input.agentStateDir,
      runtimeMode: input.runtimeMode,
    };
  }

  const models = parseProviderModels(input.provider.models);
  const selectedModel = input.selectedModel?.trim();
  return {
    apiKey: input.provider.apiKey,
    baseUrl: input.provider.baseUrl || undefined,
    models: selectedModel
      ? [selectedModel, ...models.filter((model) => model !== selectedModel)]
      : models,
    stateDir: input.agentStateDir,
    providerType: input.provider.type,
    runtimeMode: input.runtimeMode,
  };
}

function parseProviderModels(rawModels?: string | null): string[] {
  if (!rawModels) return [];
  try {
    const parsed = JSON.parse(rawModels);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((model) => {
        if (typeof model === 'string') return model;
        if (model && typeof model === 'object') {
          const value = model as { id?: unknown; name?: unknown };
          if (typeof value.id === 'string') return value.id;
          if (typeof value.name === 'string') return value.name;
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export class AgentGatewayService {
  private readonly resolveAgent: NonNullable<AgentGatewayDependencies['resolveAgent']>;
  private readonly runner: NonNullable<AgentGatewayDependencies['runner']>;

  constructor(dependencies: AgentGatewayDependencies = {}) {
    this.resolveAgent = dependencies.resolveAgent || defaultResolveAgent;
    this.runner = dependencies.runner || agentRunner;
  }

  async runAgentTask(input: AgentGatewayRequest): Promise<AgentGatewayResult> {
    const inputText = input.inputText.trim();
    if (!inputText) {
      return {
        success: false,
        agentId: input.agentId,
        error: 'inputText is required',
      };
    }

    const resolvedAgent = await this.resolveAgent({
      userId: input.userId,
      agentId: input.agentId,
    });

    if (!resolvedAgent) {
      return {
        success: false,
        agentId: input.agentId,
        error: `Agent not found: ${input.agentId}`,
      };
    }

    return this.runResolvedAgentTask({
      agent: resolvedAgent,
      inputText,
      contextId: input.contextId,
      timeoutMs: input.timeoutMs,
    });
  }

  async runResolvedAgentTask(input: ResolvedAgentGatewayRequest): Promise<AgentGatewayResult> {
    const inputText = input.inputText.trim();
    if (!inputText) {
      return {
        success: false,
        agentId: input.agent.id,
        platform: input.agent.platform,
        error: 'inputText is required',
      };
    }

    try {
      const runtimeInput = input.agent.prepareInput
        ? input.agent.prepareInput(inputText)
        : inputText;
      const outputText = await this.runner.executeMessage(
        input.agent.id,
        input.agent.platform,
        input.agent.workspacePath,
        runtimeInput,
        input.agent.providerConfig,
        input.timeoutMs
      );

      return {
        success: true,
        agentId: input.agent.id,
        platform: input.agent.platform,
        outputText,
        artifacts: [],
      };
    } catch (error) {
      return {
        success: false,
        agentId: input.agent.id,
        platform: input.agent.platform,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const agentGateway = new AgentGatewayService();
