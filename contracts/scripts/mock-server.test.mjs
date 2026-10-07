import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mockSunucusuOlustur } from './mock-server.mjs';

const temel = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));

function mockBelgesi() {
  const belge = structuredClone(temel);
  const hata = { $ref: '#/components/responses/Hata' };
  belge.paths['/api/satislar/{satisId}'] = {
    get: {
      operationId: 'satisiGetir', security: [], 'x-anonymous-reason': 'Mock server altyapi testi',
      'x-collection': false,
      responses: {
        '200': {
          description: 'Ornek satis', headers: { TraceId: { $ref: '#/components/headers/TraceId' } },
          content: { 'application/json': { schema: {
            type: 'object',
            properties: { satisId: { type: 'string', example: 'satis-1' }, tutar: { type: 'number', minimum: 0 } }
          } } }
        },
        '400': hata, '401': hata, '403': hata, '500': hata
      }
    }
  };
  return belge;
}

test('OpenAPI operasyonundan tarayiciya uygun mock yanit uretir', async (t) => {
  const sunucu = await mockSunucusuOlustur(mockBelgesi());
  await new Promise((coz) => sunucu.listen(0, '127.0.0.1', coz));
  t.after(() => sunucu.close());
  const { port } = sunucu.address();

  const yanit = await fetch(`http://127.0.0.1:${port}/api/satislar/42`);
  assert.equal(yanit.status, 200);
  assert.equal(yanit.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await yanit.json(), { satisId: 'satis-1', tutar: 0 });

  const onKontrol = await fetch(`http://127.0.0.1:${port}/api/satislar/42`, { method: 'OPTIONS' });
  assert.equal(onKontrol.status, 204);
  assert.match(onKontrol.headers.get('access-control-allow-methods'), /GET/);

  const bulunamadi = await fetch(`http://127.0.0.1:${port}/api/bilinmeyen`);
  assert.equal(bulunamadi.status, 404);
  assert.equal((await bulunamadi.json()).code, 'MOCK_OPERATION_NOT_FOUND');
});
