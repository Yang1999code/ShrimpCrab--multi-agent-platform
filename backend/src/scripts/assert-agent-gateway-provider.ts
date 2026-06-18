import assert from 'node:assert/strict';
import { buildAgentGatewayProviderConfig } from '../services/agent-gateway.service.js';

const config = buildAgentGatewayProviderConfig({
  agentStateDir: 'C:/agents/agent-1/state',
  runtimeMode: 'managed',
  selectedModel: 'model-selected',
  provider: {
    apiKey: 'provider-key',
    baseUrl: 'https://provider.example/v1',
    models: JSON.stringify(['model-default', 'model-selected']),
    type: 'opencode',
  },
});

assert.deepEqual(config, {
  apiKey: 'provider-key',
  baseUrl: 'https://provider.example/v1',
  models: ['model-selected', 'model-default'],
  stateDir: 'C:/agents/agent-1/state',
  providerType: 'opencode',
  runtimeMode: 'managed',
});

const withoutProvider = buildAgentGatewayProviderConfig({
  agentStateDir: null,
  runtimeMode: 'system',
  provider: null,
});
assert.deepEqual(withoutProvider, {
  apiKey: '',
  stateDir: null,
  runtimeMode: 'system',
});

console.log('PASS assert-agent-gateway-provider');
