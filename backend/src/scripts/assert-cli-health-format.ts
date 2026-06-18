import assert from 'node:assert/strict';
import { formatCliHealthFailure } from '../services/agent-runner.service.js';

const message = formatCliHealthFailure('openclaw', {
  available: false,
  version: '',
  command: 'openclaw.cmd',
  args: ['--version'],
  displayCommand: 'openclaw.cmd --version',
  usesWsl: false,
  errorName: 'Error',
  stderr: "'openclaw.cmd' �����ڲ����ⲿ����",
});

assert.match(message, /openclaw CLI 不可用/);
assert.match(message, /openclaw\.cmd --version/);
assert.match(message, /错误：Error/);
assert.equal(message.includes('�'), false);
assert.equal(message.includes('Error。Error'), false);

console.log('PASS assert-cli-health-format');
