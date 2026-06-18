import assert from 'node:assert/strict';
import { resolveWorkflowA2AEnabled } from '../routes/workflows.routes.js';

assert.equal(resolveWorkflowA2AEnabled(true, '0'), true);
assert.equal(resolveWorkflowA2AEnabled(false, '1'), false);
assert.equal(resolveWorkflowA2AEnabled(undefined, '1'), true);
assert.equal(resolveWorkflowA2AEnabled(undefined, 'true'), true);
assert.equal(resolveWorkflowA2AEnabled(undefined, '0'), false);
assert.equal(resolveWorkflowA2AEnabled(undefined, undefined), false);

console.log('PASS assert-workflow-a2a-flag');
