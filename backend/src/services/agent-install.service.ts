import {
  getAgentBaseDefinition,
  type AgentBaseId,
} from './agent-base-registry.service.js';

export type AgentInstallStatus =
  | 'idle'
  | 'checking'
  | 'needs-install'
  | 'needs-confirmation'
  | 'installing'
  | 'installed'
  | 'failed';

export interface AgentInstallGuide {
  platform: AgentBaseId;
  displayName: string;
  status: AgentInstallStatus;
  docsUrl: string;
  installUrl: string;
  installCommands: string[];
  requiresUserConfirmation: boolean;
  managedInstallSupported: boolean;
  riskNoteZh: string;
}

export function getAgentInstallGuide(platform: AgentBaseId): AgentInstallGuide {
  const base = getAgentBaseDefinition(platform);
  return {
    platform,
    displayName: base.displayName,
    status: base.managedInstallSupported ? 'needs-confirmation' : 'needs-install',
    docsUrl: base.docsUrl,
    installUrl: base.installUrl,
    installCommands: [...base.installCommands],
    requiresUserConfirmation: true,
    managedInstallSupported: base.managedInstallSupported,
    riskNoteZh: base.riskNoteZh,
  };
}

export function getAgentInstallGuides(platforms: AgentBaseId[]): AgentInstallGuide[] {
  return platforms.map((platform) => getAgentInstallGuide(platform));
}

