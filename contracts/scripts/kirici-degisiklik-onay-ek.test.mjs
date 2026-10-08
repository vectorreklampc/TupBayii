import test from 'node:test';
import assert from 'node:assert/strict';
import { onayDogrula } from './kirici-degisiklik-onay.mjs';

const body = '## API Breaking Change Etkisi\nEski istemciler etkilenir.\n\n## Gecis Plani\nIki surumluk gecis uygulanir.';
const temel = { body, author: 'yazar', sha: 'abc' };

test('baska bir inceleyenin acik degisiklik istegini onayla gecmez', () => {
  const reviews = [
    { user: { login: 'inceleyen-a' }, state: 'CHANGES_REQUESTED', commit_id: 'abc', submitted_at: '2026-10-01T12:00:00Z' },
    { user: { login: 'inceleyen-b' }, state: 'APPROVED', commit_id: 'abc', submitted_at: '2026-10-01T13:00:00Z' }
  ];

  assert.throws(() => onayDogrula({ ...temel, reviews }), /onay/);
});

test('inceleyenin daha yeni onayi onceki degisiklik isteginin yerini alir', () => {
  const reviews = [
    { user: { login: 'inceleyen' }, state: 'CHANGES_REQUESTED', commit_id: 'abc', submitted_at: '2026-10-01T12:00:00Z' },
    { user: { login: 'inceleyen' }, state: 'APPROVED', commit_id: 'abc', submitted_at: '2026-10-01T13:00:00Z' }
  ];

  assert.equal(onayDogrula({ ...temel, reviews }), true);
});
