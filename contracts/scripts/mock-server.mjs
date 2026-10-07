import SwaggerParser from '@apidevtools/swagger-parser';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { contractDogrula } from './dogrula.mjs';

const varsayilanKaynak = new URL('../openapi.json', import.meta.url);
const httpMetotlari = new Set(['get', 'post', 'put', 'patch', 'delete']);

function semadanOrnek(sema = {}) {
  if (Object.hasOwn(sema, 'example')) return sema.example;
  if (Object.hasOwn(sema, 'default')) return sema.default;
  if (sema.enum?.length) return sema.enum[0];
  if (sema.oneOf?.length) return semadanOrnek(sema.oneOf[0]);
  if (sema.anyOf?.length) return semadanOrnek(sema.anyOf[0]);
  if (sema.allOf?.length) return Object.assign({}, ...sema.allOf.map((alt) => semadanOrnek(alt)));

  const tip = Array.isArray(sema.type) ? sema.type.find((deger) => deger !== 'null') : sema.type;
  if (tip === 'object' || sema.properties) {
    return Object.fromEntries(Object.entries(sema.properties ?? {}).map(([ad, alt]) => [ad, semadanOrnek(alt)]));
  }
  if (tip === 'array') return [semadanOrnek(sema.items)];
  if (tip === 'integer' || tip === 'number') return sema.minimum ?? 0;
  if (tip === 'boolean') return false;
  if (tip === 'null') return null;
  if (sema.format === 'date-time') return '2026-01-01T00:00:00Z';
  if (sema.format === 'date') return '2026-01-01';
  if (sema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
  return 'string';
}

function yolDeseni(yol) {
  const kacisli = yol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${kacisli.replace(/\\\{[^/]+\\\}/g, '[^/]+')}/?$`);
}

function operasyonlariDerle(belge) {
  const operasyonlar = [];
  for (const [yol, yolOgeleri] of Object.entries(belge.paths)) {
    for (const [metot, islem] of Object.entries(yolOgeleri)) {
      if (httpMetotlari.has(metot)) operasyonlar.push({ metot: metot.toUpperCase(), desen: yolDeseni(yol), islem });
    }
  }
  return operasyonlar;
}

function ornekYanit(islem) {
  const [durum, yanit] = Object.entries(islem.responses)
    .filter(([kod]) => /^2\d\d$/.test(kod))
    .sort(([sol], [sag]) => Number(sol) - Number(sag))[0];
  const [icerikTuru, icerik] = Object.entries(yanit.content ?? {})[0] ?? [];
  const adliOrnek = Object.values(icerik?.examples ?? {})[0];
  let govde;
  if (icerik && Object.hasOwn(icerik, 'example')) govde = icerik.example;
  else if (adliOrnek && Object.hasOwn(adliOrnek, 'value')) govde = adliOrnek.value;
  else if (icerik?.schema) govde = semadanOrnek(icerik.schema);
  const basliklar = Object.fromEntries(Object.entries(yanit.headers ?? {}).map(([ad, deger]) =>
    [ad, String(deger.example ?? semadanOrnek(deger.schema))]));
  return { durum: Number(durum), icerikTuru, govde, basliklar };
}

export async function mockSunucusuOlustur(belge) {
  await contractDogrula(structuredClone(belge));
  const cozulmus = await SwaggerParser.dereference(structuredClone(belge));
  const operasyonlar = operasyonlariDerle(cozulmus);

  return createServer((istek, yanit) => {
    yanit.setHeader('Access-Control-Allow-Origin', '*');
    yanit.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    yanit.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (istek.method === 'OPTIONS') {
      yanit.writeHead(204).end();
      return;
    }

    const yol = new URL(istek.url, 'http://localhost').pathname;
    const bulunan = operasyonlar.find(({ metot, desen }) => metot === istek.method && desen.test(yol));
    if (!bulunan) {
      yanit.writeHead(404, { 'Content-Type': 'application/json' });
      yanit.end(JSON.stringify({ code: 'MOCK_OPERATION_NOT_FOUND', message: 'Contract icinde eslesen operasyon yok.' }));
      return;
    }

    const ornek = ornekYanit(bulunan.islem);
    for (const [ad, deger] of Object.entries(ornek.basliklar)) yanit.setHeader(ad, deger);
    if (ornek.icerikTuru) yanit.setHeader('Content-Type', ornek.icerikTuru);
    yanit.writeHead(ornek.durum);
    const jsonMu = ornek.icerikTuru?.includes('json');
    yanit.end(ornek.govde === undefined ? undefined : jsonMu ? JSON.stringify(ornek.govde) : String(ornek.govde));
  });
}

async function komutSatiri() {
  const portDegeri = process.env.MOCK_PORT ?? '4010';
  const host = process.env.MOCK_HOST ?? '0.0.0.0';
  const contractYolu = process.env.MOCK_CONTRACT;
  const kaynak = contractYolu ? pathToFileURL(contractYolu) : varsayilanKaynak;
  const belge = JSON.parse(await readFile(kaynak, 'utf8'));
  const sunucu = await mockSunucusuOlustur(belge);
  sunucu.listen(Number(portDegeri), host, () => {
    console.log(`OpenAPI mock server http://${host}:${portDegeri} adresinde hazir`);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await komutSatiri();
