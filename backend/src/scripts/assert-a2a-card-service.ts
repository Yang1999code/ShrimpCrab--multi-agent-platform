import assert from 'node:assert/strict';
import { getA2AAgentCard, getA2AAgentCards } from '../a2a/a2a-card.service.js';

const cards = getA2AAgentCards('/api/a2a/cards');
assert.deepEqual(
  cards.map((card) => card.id),
  ['openclaw', 'claude-code', 'hermes', 'opencode']
);

for (const card of cards) {
  assert.equal(card.url, `/api/a2a/cards/${card.id}`);
  assert.equal(card.version, '1.0.0');
  assert.equal(card.capabilities.streaming, false);
  assert.equal(card.capabilities.pushNotifications, false);
  assert.equal(card.capabilities.stateTransitionHistory, false);
  assert.equal(card.skills.length > 0, true);
  assert.equal(card.metadata?.platform, card.id);
}

const openclaw = getA2AAgentCard('openclaw', '/api/a2a/cards');
assert.equal(openclaw.name, 'OpenClaw/PI');
assert.equal(openclaw.skills.some((skill) => skill.id === 'workflow'), true);

const claude = getA2AAgentCard('claude-code', '/api/a2a/cards');
assert.equal(claude.skills.some((skill) => skill.id === 'coding'), true);

assert.throws(
  () => getA2AAgentCard('codex', '/api/a2a/cards'),
  /Unsupported A2A agent card platform/
);

console.log('PASS assert-a2a-card-service');
