import os from 'os';

export type AgentBaseId = 'openclaw' | 'claude-code' | 'hermes' | 'opencode';
export type RuntimeMode = 'system' | 'managed';
export type AgentBaseStatusBadge = '已有，推荐' | '已有接口，推荐补齐';

export interface AgentBaseDefinition {
  id: AgentBaseId;
  displayName: string;
  shortLabel: string;
  statusBadge: AgentBaseStatusBadge;
  descriptionZh: string;
  binaryName: string;
  versionCommand: string[];
  docsUrl: string;
  installUrl: string;
  managedInstallSupported: boolean;
  installCommands: string[];
  riskNoteZh: string;
}

const isWindows = os.platform() === 'win32';

const AGENT_BASE_DEFINITIONS: readonly AgentBaseDefinition[] = [
  {
    id: 'openclaw',
    displayName: 'OpenClaw/PI',
    shortLabel: 'OpenClaw/PI',
    statusBadge: '已有，推荐',
    descriptionZh: '默认底座，适合 OpenClaw/PI 工作流、workspace 管理和多 Agent 协作。',
    binaryName: isWindows ? 'openclaw.cmd' : 'openclaw',
    versionCommand: [isWindows ? 'openclaw.cmd' : 'openclaw', '--version'],
    docsUrl: 'https://pi.dev/',
    installUrl: 'https://pi.dev/',
    managedInstallSupported: true,
    installCommands: isWindows
      ? ['powershell -ExecutionPolicy Bypass -c "irm https://pi.dev/install.ps1 | iex"']
      : ['curl -fsSL https://pi.dev/install.sh | bash'],
    riskNoteZh: '第一版底层继续走 openclaw 平台；如果后续要拆 PI，需要再增加独立平台标识。',
  },
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    shortLabel: 'Claude Code',
    statusBadge: '已有接口，推荐补齐',
    descriptionZh: '适合代码任务、长上下文规划和工程协作，依赖 Claude Code CLI 与官方授权。',
    binaryName: isWindows ? 'claude.cmd' : 'claude',
    versionCommand: [isWindows ? 'claude.cmd' : 'claude', '--version'],
    docsUrl: 'https://code.claude.com/docs',
    installUrl: 'https://code.claude.com/docs',
    managedInstallSupported: true,
    installCommands: ['参考 Claude Code 官方文档安装，并完成账号登录/授权。'],
    riskNoteZh: '项目只负责调用和检测 CLI，不处理 Claude 账号、订阅或登录授权。',
  },
  {
    id: 'hermes',
    displayName: 'Hermes',
    shortLabel: 'Hermes',
    statusBadge: '已有，推荐',
    descriptionZh: '适合记忆、技能、自动化任务和轻量工具调用型 Agent。',
    binaryName: isWindows ? 'hermes.cmd' : 'hermes',
    versionCommand: [isWindows ? 'hermes.cmd' : 'hermes', 'version'],
    docsUrl: 'https://github.com/nousresearch/hermes-agent',
    installUrl: 'https://github.com/nousresearch/hermes-agent',
    managedInstallSupported: true,
    installCommands: ['参考 Hermes Agent GitHub README 的当前安装命令。'],
    riskNoteZh: 'Hermes 生态变化较快，下载安装前应以 GitHub README 当前版本为准。',
  },
  {
    id: 'opencode',
    displayName: 'OpenCode',
    shortLabel: 'OpenCode',
    statusBadge: '已有，推荐',
    descriptionZh: '开源编码 CLI，适合终端原生开发、代码修改和多模型接入。',
    binaryName: isWindows ? 'opencode.cmd' : 'opencode',
    versionCommand: [isWindows ? 'opencode.cmd' : 'opencode', '--version'],
    docsUrl: 'https://opencode.ai/',
    installUrl: 'https://opencode.ai/',
    managedInstallSupported: true,
    installCommands: ['参考 OpenCode 官网当前安装命令。'],
    riskNoteZh: 'OpenCode 的模型供应商和密钥仍需用户按自身账号配置。',
  },
] as const;

export function getAgentBaseDefinitions(): AgentBaseDefinition[] {
  return AGENT_BASE_DEFINITIONS.map((base) => ({ ...base, versionCommand: [...base.versionCommand], installCommands: [...base.installCommands] }));
}

export function getAgentBaseDefinition(id: AgentBaseId): AgentBaseDefinition {
  const base = AGENT_BASE_DEFINITIONS.find((item) => item.id === id);
  if (!base) {
    throw new Error(`Unsupported agent base: ${id}`);
  }
  return { ...base, versionCommand: [...base.versionCommand], installCommands: [...base.installCommands] };
}

export function isAgentBaseId(value: string): value is AgentBaseId {
  return AGENT_BASE_DEFINITIONS.some((base) => base.id === value);
}

export function isRuntimeMode(value: string): value is RuntimeMode {
  return value === 'system' || value === 'managed';
}

export function normalizeRuntimeMode(value: unknown): RuntimeMode {
  return typeof value === 'string' && isRuntimeMode(value.trim()) ? value.trim() as RuntimeMode : 'system';
}
