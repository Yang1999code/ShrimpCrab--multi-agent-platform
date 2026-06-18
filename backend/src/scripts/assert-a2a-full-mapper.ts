import assert from 'node:assert/strict';
import {
  workflowArtifactToA2AArtifact,
  workflowStatusToA2AState,
} from '../a2a/a2a-task-mapper.service.js';

assert.equal(workflowStatusToA2AState('pending'), 'submitted');
assert.equal(workflowStatusToA2AState('running'), 'working');
assert.equal(workflowStatusToA2AState('succeeded'), 'completed');
assert.equal(workflowStatusToA2AState('failed'), 'failed');
assert.equal(workflowStatusToA2AState('skipped'), 'canceled');

const artifact = workflowArtifactToA2AArtifact(
  {
    id: 'artifact-1',
    nodeId: 'worker',
    nodeLabel: 'Worker',
    label: 'report.md',
    kind: 'workspace-file',
    path: 'C:/secret/server/workspace/report.md',
    relativePath: 'reports/report.md',
    size: 123,
    createdAt: '2026-06-18T00:00:00.000Z',
  },
  '/api/projects/project-1/files/download'
);

assert.deepEqual(artifact.parts, [{
  kind: 'file',
  name: 'report.md',
  uri: '/api/projects/project-1/files/download?path=reports%2Freport.md',
}]);
assert.equal(JSON.stringify(artifact).includes('C:/secret'), false);
assert.equal(artifact.metadata?.relativePath, 'reports/report.md');
assert.equal(artifact.metadata?.size, 123);

console.log('PASS assert-a2a-full-mapper');
