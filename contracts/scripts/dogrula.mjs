import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const kaynak = new URL('../openapi.json', import.meta.url);
const hataRef = '#/components/responses/Hata';
const izRef = '#/components/headers/TraceId';
const sayfaRef = '#/components/schemas/Sayfalama';
const anahtarRef = '#/components/parameters/IdempotencyKey';
const metotlar = new Set(['get', 'post', 'put', 'patch', 'delete']);

function dogrulaKosul(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}

function parametreVarMi(parametreler, ad) {
  return parametreler.some((p) => p?.$ref === `#/components/parameters/${ad}`);
}

function semaKontrol(sema, yol) {
  if (!sema || typeof sema !== 'object' || sema.$ref) return;
  for (const [ad, alt] of Object.entries(sema.properties ?? {})) {
    dogrulaKosul(/^[a-z][a-zA-Z0-9]*$/.test(ad), `${yol}: JSON property camelCase olmali: ${ad}`);
    semaKontrol(alt, `${yol}.${ad}`);
  }
  for (const alan of ['items', 'additionalProperties', 'not', 'if', 'then', 'else']) {
    semaKontrol(sema[alan], `${yol}.${alan}`);
  }
  for (const alan of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    for (const [sira, alt] of (sema[alan] ?? []).entries()) semaKontrol(alt, `${yol}.${alan}[${sira}]`);
  }
  for (const alan of ['$defs', 'dependentSchemas', 'patternProperties']) {
    for (const [ad, alt] of Object.entries(sema[alan] ?? {})) semaKontrol(alt, `${yol}.${alan}.${ad}`);
  }
}

export async function contractDogrula(belge) {
  await SwaggerParser.validate(structuredClone(belge));
  dogrulaKosul(belge.openapi.startsWith('3.1.'), 'OpenAPI 3.1 gerekli');
  const { schemas, responses, headers, parameters } = belge.components ?? {};
  dogrulaKosul(schemas?.Hata && schemas?.DogrulamaDetayi && schemas?.Sayfalama &&
    responses?.Hata?.content?.['application/json']?.schema?.$ref === '#/components/schemas/Hata' &&
    responses.Hata.headers?.TraceId?.$ref === izRef && headers?.TraceId &&
    parameters?.Page && parameters?.PageSize && parameters?.IdempotencyKey,
  'Ortak hata, TraceId, sayfalama veya idempotency contract bileseni eksik');
  dogrulaKosul(['code', 'message', 'traceId'].every((ad) =>
    schemas.Hata.required?.includes(ad) && schemas.Hata.properties?.[ad]?.type === 'string') &&
    schemas.Hata.properties?.details?.items?.$ref === '#/components/schemas/DogrulamaDetayi' &&
    ['field', 'code'].every((ad) => schemas.DogrulamaDetayi.required?.includes(ad)) &&
    ['page', 'pageSize', 'totalItems', 'totalPages'].every((ad) =>
      schemas.Sayfalama.required?.includes(ad) && schemas.Sayfalama.properties?.[ad]?.type === 'integer'),
  'Ortak hata veya sayfalama semasinin zorunlu alanlari bozuk');
  for (const [ad, isim, konum, tip] of [
    ['Page', 'page', 'query', 'integer'],
    ['PageSize', 'pageSize', 'query', 'integer'],
    ['IdempotencyKey', 'Idempotency-Key', 'header', 'string']
  ]) {
    const parametre = parameters[ad];
    dogrulaKosul(parametre.name === isim && parametre.in === konum &&
      parametre.schema?.type === tip &&
      (ad !== 'IdempotencyKey' || parametre.required === true && parametre.schema.minLength >= 1) &&
      (ad === 'IdempotencyKey' || parametre.schema.minimum >= 1),
    `${ad}: kanonik parametre tanimi bozuk`);
  }
  for (const [ad, sema] of Object.entries(schemas)) semaKontrol(sema, ad);

  const kimlikler = new Set();
  for (const [yol, yolOgeleri] of Object.entries(belge.paths)) {
    dogrulaKosul(/^\/api\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/\{[a-z][a-zA-Z0-9]*\}|\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(yol),
      `${yol}: route /api/... ASCII kebab-case olmali`);
    for (const [metot, islem] of Object.entries(yolOgeleri)) {
      if (!metotlar.has(metot)) continue;
      const yer = `${metot.toUpperCase()} ${yol}`;
      dogrulaKosul(/^[a-z][a-zA-Z0-9]*$/.test(islem.operationId ?? '') && !kimlikler.has(islem.operationId),
        `${yer}: benzersiz camelCase operationId gerekli`);
      kimlikler.add(islem.operationId);
      dogrulaKosul(Array.isArray(islem.security) &&
        (islem.security.length === 0
          ? typeof islem['x-anonymous-reason'] === 'string' && !!islem['x-anonymous-reason'].trim()
          : islem.security.every((gereksinim) =>
            Object.keys(gereksinim).length > 0 &&
            Object.keys(gereksinim).every((ad) => Object.hasOwn(belge.components.securitySchemes ?? {}, ad)))),
      `${yer}: security veya anonim erisim gerekcesi gerekli`);
      const yanitlar = islem.responses ?? {};
      dogrulaKosul(Object.keys(yanitlar).some((kod) => /^2\d\d$/.test(kod)), `${yer}: basari response'u gerekli`);
      for (const kod of ['400', '401', '403', '500']) {
        dogrulaKosul(yanitlar[kod]?.$ref === hataRef, `${yer}: ${kod} ortak Hata response'u olmali`);
      }
      for (const [kod, yanit] of Object.entries(yanitlar)) {
        if (/^[45]\d\d$/.test(kod)) dogrulaKosul(yanit.$ref === hataRef, `${yer}: ${kod} ortak Hata olmali`);
        else dogrulaKosul(yanit.headers?.TraceId?.$ref === izRef, `${yer}: ${kod} TraceId header'i olmali`);
        for (const [tip, icerik] of Object.entries(yanit.content ?? {})) semaKontrol(icerik.schema, `${yer} ${kod} ${tip}`);
      }
      for (const [tip, icerik] of Object.entries(islem.requestBody?.content ?? {}))
        semaKontrol(icerik.schema, `${yer} request ${tip}`);
      const parametreler = [...(yolOgeleri.parameters ?? []), ...(islem.parameters ?? [])];
      if (metot === 'get') dogrulaKosul(typeof islem['x-collection'] === 'boolean',
        `${yer}: koleksiyon karari gerekli`);
      if (islem['x-collection'] === true) {
        dogrulaKosul(metot === 'get' && parametreVarMi(parametreler, 'Page') &&
          parametreVarMi(parametreler, 'PageSize'), `${yer}: koleksiyon page/pageSize ister`);
        const basari = Object.entries(yanitlar).find(([kod]) => /^2\d\d$/.test(kod))?.[1];
        const sema = basari?.content?.['application/json']?.schema;
        dogrulaKosul(sema?.properties?.data?.type === 'array' &&
          sema?.properties?.pagination?.$ref === sayfaRef &&
          ['data', 'pagination'].every((alan) => sema.required?.includes(alan)),
        `${yer}: koleksiyon data ve pagination govdesi ister`);
      }
      if (['post', 'put', 'patch', 'delete'].includes(metot)) {
        dogrulaKosul(typeof islem['x-idempotency-required'] === 'boolean', `${yer}: idempotency karari gerekli`);
        if (islem['x-idempotency-required']) {
          dogrulaKosul(parametreVarMi(parametreler, 'IdempotencyKey') &&
            yanitlar['409']?.$ref === hataRef, `${yer}: Idempotency-Key ve 409 gerekli`);
        } else dogrulaKosul(typeof islem['x-retry-semantics'] === 'string' &&
          islem['x-retry-semantics'].trim(), `${yer}: retry semantigi gerekli`);
      }
    }
  }
  return true;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const belge = JSON.parse(await readFile(kaynak, 'utf8'));
  await contractDogrula(belge);
  console.log('OpenAPI yapi ve TBP-21 contract kurallari PASS');
}
