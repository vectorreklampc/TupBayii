import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contractDogrula } from './dogrula.mjs';

const temel = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
const kopyala = () => structuredClone(temel);
const hata = { $ref: '#/components/responses/Hata' };
const iz = { $ref: '#/components/headers/TraceId' };

function listeBelgesi() {
  const belge = kopyala();
  belge.components.securitySchemes = { Kimlik: { type: 'http', scheme: 'bearer' } };
  belge.paths['/api/satislar'] = {
    get: {
      operationId: 'satislariGetir', security: [{ Kimlik: [] }], 'x-collection': true,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/PageSize' }
      ],
      responses: {
        '200': {
          description: 'Liste', headers: { TraceId: iz },
          content: { 'application/json': { schema: {
            type: 'object', required: ['data', 'pagination'],
            properties: {
              data: { type: 'array', items: { type: 'string' } },
              pagination: { $ref: '#/components/schemas/Sayfalama' }
            }
          } } }
        },
        '400': hata, '401': hata, '403': hata, '500': hata
      }
    }
  };
  return belge;
}

test('kanonik bos endpoint belgesi gercek ortak semalari dogrular', async () => {
  assert.equal(await contractDogrula(kopyala()), true);
});

test('kimlikli sayfali operasyon contract kurallarini gecer', async () => {
  assert.equal(await contractDogrula(listeBelgesi()), true);
});

test('eksik authentication beyanini reddeder', async () => {
  const belge = listeBelgesi();
  delete belge.paths['/api/satislar'].get.security;
  await assert.rejects(contractDogrula(belge), /security/);
  for (const security of [[{}], [{ Olmayan: [] }], [{ Kimlik: [] }, {}]]) {
    const yanlis = listeBelgesi();
    yanlis.paths['/api/satislar'].get.security = security;
    await assert.rejects(contractDogrula(yanlis), /security/);
  }
});

test('birlesik JSON semasinda camelCase disi alan adini reddeder', async () => {
  const belge = listeBelgesi();
  belge.components.schemas.Sayfalama.allOf = [{ properties: { YanlisAlan: { type: 'string' } } }];
  await assert.rejects(contractDogrula(belge), /camelCase/);
});

test('eksik sayfalama ve hatali envelope beyanini reddeder', async () => {
  const belge = listeBelgesi();
  belge.paths['/api/satislar'].get.parameters.pop();
  await assert.rejects(contractDogrula(belge), /page\/pageSize/);
  const ikinci = listeBelgesi();
  ikinci.paths['/api/satislar'].get.responses['403'] = {
    description: 'Yetkisiz', content: { 'application/json': { schema: { type: 'string' } } }
  };
  await assert.rejects(contractDogrula(ikinci), /403 ortak Hata/);
});

test('bozuk referansi yapisal olarak reddeder', async () => {
  const belge = listeBelgesi();
  belge.paths['/api/satislar'].get.responses['400'] = { $ref: '#/components/responses/Yok' };
  await assert.rejects(contractDogrula(belge));
});

test('ortak hata zarfinda zorunlu traceId kaybini reddeder', async () => {
  const belge = kopyala();
  belge.components.schemas.Hata.required = ['code', 'message'];
  await assert.rejects(contractDogrula(belge), /zorunlu alanlari bozuk/);
});

test('kanonik parametre adini ve konumunu degistirmeyi reddeder', async () => {
  const sayfa = listeBelgesi();
  sayfa.components.parameters.Page.name = 'yanlis';
  sayfa.components.parameters.Page.in = 'header';
  await assert.rejects(contractDogrula(sayfa), /Page: kanonik/);
  const anahtar = listeBelgesi();
  anahtar.components.parameters.IdempotencyKey.in = 'query';
  anahtar.components.parameters.IdempotencyKey.required = false;
  await assert.rejects(contractDogrula(anahtar), /IdempotencyKey: kanonik/);
});

test('kritik yazmada idempotency key ve conflict gerektirir', async () => {
  const belge = listeBelgesi();
  const get = belge.paths['/api/satislar'].get;
  belge.paths['/api/satislar'].post = {
    operationId: 'satisiTamamla', security: [{ Kimlik: [] }],
    'x-idempotency-required': true,
    parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
    responses: { ...get.responses, '409': hata }
  };
  assert.equal(await contractDogrula(belge), true);
  belge.paths['/api/satislar'].post.parameters = [];
  await assert.rejects(contractDogrula(belge), /Idempotency-Key/);
});
