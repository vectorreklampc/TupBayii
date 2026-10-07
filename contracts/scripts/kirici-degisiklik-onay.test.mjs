import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onayDogrula } from './kirici-degisiklik-onay.mjs';

const govde = '## API Breaking Change Etkisi\nEski istemciler yanit alanini okuyamaz.\n\n## Gecis Plani\nIki surum boyunca eski alan korunur, istemciler yeni alana tasinir.';
const onay = { user: { login: 'inceleyen' }, state: 'APPROVED', commit_id: 'abc', submitted_at: '2026-10-01T12:00:00Z' };
const veri = { body: govde, author: 'yazar', sha: 'abc', reviews: [onay] };

test('etki, gecis plani ve farkli kisiden guncel onay kabul edilir', () => {
  assert.equal(onayDogrula(veri), true);
});

test('bos veya eksik etki ve gecis plani reddedilir', () => {
  for (const body of ['', '## API Breaking Change Etkisi\nTBD\n\n## Gecis Plani\nDaha sonra', '## API Breaking Change Etkisi\nEtkilenen istemciler']) {
    assert.throws(() => onayDogrula({ ...veri, body }), /etki ve gecis/);
  }
});

test('doldurulmamis pull request sablonu etki ve gecis plani sayilmaz', () => {
  const body = readFileSync(new URL('../../.github/PULL_REQUEST_TEMPLATE.md', import.meta.url), 'utf8');

  assert.throws(() => onayDogrula({ ...veri, body }), /etki ve gecis/);
});

test('yazarin, eski commitin veya sonradan geri cekilen onay reddedilir', () => {
  for (const reviews of [
    [{ ...onay, user: { login: 'yazar' } }],
    [{ ...onay, commit_id: 'onceki' }],
    [onay, { ...onay, state: 'CHANGES_REQUESTED', submitted_at: '2026-10-01T13:00:00Z' }]
  ]) assert.throws(() => onayDogrula({ ...veri, reviews }), /onay/);
});
