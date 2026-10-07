import test from 'node:test';
import assert from 'node:assert/strict';
import { kiriciDegisiklikKontrol } from './kirici-degisiklik-kontrol.mjs';

function temelBelge() {
  return {
    openapi: '3.1.0',
    info: { title: 'Fixture API', version: '1.0.0' },
    paths: {
      '/api/satislar': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { aciklama: { type: 'string' } }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Basarili',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['durum'],
                    properties: { durum: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

test('opsiyonel request alani eklemeyi compatible kabul eder', async () => {
  const onceki = temelBelge();
  const yeni = structuredClone(onceki);
  yeni.paths['/api/satislar'].post.requestBody.content['application/json'].schema.properties.not = {
    type: 'string'
  };

  assert.equal((await kiriciDegisiklikKontrol(onceki, yeni)).kirici, false);
});

test('zorunlu request alani eklemeyi breaking kabul eder', async () => {
  const onceki = temelBelge();
  const yeni = structuredClone(onceki);
  const sema = yeni.paths['/api/satislar'].post.requestBody.content['application/json'].schema;
  sema.properties.musteriId = { type: 'string' };
  sema.required = ['musteriId'];

  assert.equal((await kiriciDegisiklikKontrol(onceki, yeni)).kirici, true);
});

test('endpoint silmeyi breaking kabul eder', async () => {
  const onceki = temelBelge();
  const yeni = structuredClone(onceki);
  delete yeni.paths['/api/satislar'];

  assert.equal((await kiriciDegisiklikKontrol(onceki, yeni)).kirici, true);
});

test('response type degisikligini breaking kabul eder', async () => {
  const onceki = temelBelge();
  const yeni = structuredClone(onceki);
  yeni.paths['/api/satislar'].post.responses['200'].content['application/json'].schema
    .properties.durum.type = 'integer';

  assert.equal((await kiriciDegisiklikKontrol(onceki, yeni)).kirici, true);
});

test('arac veya parsing hatasini breaking onayi gibi ele almaz', async () => {
  await assert.rejects(
    kiriciDegisiklikKontrol('olmayan-baseline.json', 'olmayan-yeni.json'),
    /araci calismadi/
  );
});
