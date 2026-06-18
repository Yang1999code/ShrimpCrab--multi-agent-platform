const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'src', 'lib', 'api.ts'), 'utf8');
const types = fs.readFileSync(path.join(root, 'src', 'types', 'index.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src', 'app', 'agent', '[id]', 'page.tsx'), 'utf8');
const panelPath = path.join(root, 'src', 'components', 'chat', 'A2AAgentPanel.tsx');

assert.equal(fs.existsSync(panelPath), true);
const panel = fs.readFileSync(panelPath, 'utf8');

assert.match(types, /export interface A2ATask/);
assert.match(types, /export interface A2AMessage/);
assert.match(api, /fetchA2AInstanceAgentCard/);
assert.match(api, /startA2ATask/);
assert.match(api, /fetchA2ATask/);
assert.match(api, /cancelA2ATask/);
assert.match(page, /type TabType = 'chat' \| 'monitor' \| 'capabilities' \| 'a2a'/);
assert.match(page, /<A2AAgentPanel/);
assert.match(panel, /A2A Agent Card/);
assert.match(panel, /取消任务/);
assert.match(panel, /waitForCompletion: false/);

console.log('PASS assert-a2a-agent-panel');
