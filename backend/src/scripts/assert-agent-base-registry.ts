import assert from 'node:assert/strict';
import {
  getAgentBaseDefinitions,
  isAgentBaseId,
  isRuntimeMode,
} from '../services/agent-base-registry.service.js';

const bases = getAgentBaseDefinitions();

assert.deepEqual(
  bases.map((base) => base.id),
  ['openclaw', 'claude-code', 'hermes', 'opencode']
);

assert.equal(bases[0].displayName, 'OpenClaw/PI');
assert.equal(bases.every((base) => base.statusBadge.includes('推荐')), true);
assert.equal(bases.every((base) => base.docsUrl.startsWith('https://')), true);
assert.equal(isAgentBaseId('claude-code'), true);
assert.equal(isAgentBaseId('codex'), false);
assert.equal(isRuntimeMode('system'), true);
assert.equal(isRuntimeMode('managed'), true);
assert.equal(isRuntimeMode('external'), false);

console.log('agent base registry assertions passed');
