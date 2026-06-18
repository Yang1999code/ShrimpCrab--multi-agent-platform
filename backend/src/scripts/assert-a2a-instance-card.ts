import assert from 'node:assert/strict';
import { getA2AInstanceAgentCard } from '../a2a/a2a-card.service.js';

const card = getA2AInstanceAgentCard(
  {
    id: 'agent-instance-1',
    name: 'My Coding Agent',
    description: 'Works on repositories.',
    sourceVersion: '2.3.4',
    tags: JSON.stringify(['coding', 'review']),
  },
  'opencode',
  '/api/a2a/agents'
);

assert.equal(card.id, 'agent-instance-1');
assert.equal(card.name, 'My Coding Agent');
assert.equal(card.version, '2.3.4');
assert.equal(card.url, '/api/a2a/agents/agent-instance-1');
assert.equal(card.capabilities.streaming, true);
assert.equal(card.skills.some((skill) => skill.tags.includes('coding')), true);
assert.equal(card.metadata?.platform, 'opencode');
assert.equal(card.metadata?.agentId, 'agent-instance-1');

console.log('PASS assert-a2a-instance-card');
