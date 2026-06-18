const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'src', 'lib', 'api.ts'), 'utf8');
const typesSource = fs.readFileSync(path.join(root, 'src', 'types', 'index.ts'), 'utf8');
const workspaceSource = fs.readFileSync(
  path.join(root, 'src', 'components', 'projects', 'ProjectWorkspace.tsx'),
  'utf8'
);

assert.match(apiSource, /useA2AAdapter\?: boolean/);
assert.match(typesSource, /useA2AAdapter: boolean/);
assert.match(typesSource, /executionChannel\?: WorkflowExecutionChannel/);
assert.match(workspaceSource, /const \[useA2AAdapter, setUseA2AAdapter\] = useState\(true\)/);
assert.match(workspaceSource, /useA2AAdapter,/);
assert.match(workspaceSource, /A2A 标准通道/);
assert.match(workspaceSource, /A2A 标准网关|兼容直连通道/);

console.log('PASS assert-a2a-workflow-ui');
