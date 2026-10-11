import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const matrisKaynak = new URL('../../docs/r0-1-pilot-izlenebilirlik.json', import.meta.url);
const openapiKaynak = new URL('../openapi.json', import.meta.url);
const platformJira = { windows: 'TBP-255', android: 'TBP-256' };
const akisJira = {
  login: 'TBP-249', musteri: 'TBP-250', urunFiyat: 'TBP-250',
  satis: 'TBP-252', stok: 'TBP-251', kasaOzeti: 'TBP-253'
};
const durumlar = ['loading', 'empty', 'validation', 'permission', 'networkError', 'success'];
const surumler = ['R0.1', 'R0.2', 'R0.3', 'R1.0'];
const jiraDeseni = /^TBP-\d+$/;
// TBP-258: test oracle'larinin calistirma kaniti; oracle tanimi kosu sonucu degildir.
const testYurutmeJira = 'TBP-258';

function dogrula(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}

const httpMetotlari = new Set(['get', 'post', 'put', 'patch', 'delete']);

function operasyonlar(openapi) {
  const harita = new Map();
  for (const [yol, ogeler] of Object.entries(openapi.paths ?? {})) {
    for (const [metot, islem] of Object.entries(ogeler)) {
      if (!httpMetotlari.has(metot) || !islem?.operationId) continue;
      harita.set(islem.operationId, { yol, metot, islem, parametreler: [...(ogeler.parameters ?? []), ...(islem.parameters ?? [])] });
    }
  }
  return harita;
}

const readinessDegerleri = ['BLOCKED', 'SPEC_REQUIRED', 'HUMAN_REQUIRED', 'READY'];
const stateDurumlari = ['UNVERIFIED', 'CANDIDATE', 'VERIFIED'];
const figmaDurumlari = ['CANDIDATE', 'VERIFIED'];
const figmaNodeDeseni = /^\d+:\d+$/;
const semaOneki = '#/components/schemas/';
// TBP-249: yalniz oturum acma kimliksizdir; digerleri bearer ister.
const anonimDavranislar = new Set(['login-open']);
// TBP-251/252/253: stok ve finans yazmalari idempotent olmali.
const idempotentJira = new Set(['TBP-251', 'TBP-252', 'TBP-253']);
const idempotencyKodlari = ['IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_IN_PROGRESS'];
const hataKoduDeseni = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const yasakGirdi = /tenant|connection.?string|secret/i;
// Turkce cogul kaynak: -ler/-lar, tamlamada -leri/-lari.
const cogulKaynak = /^\/api\/v1\/[a-z0-9-]*(?:ler|lar|leri|lari)(?:\/|$)/;

function refCoz(openapi, ref) {
  return ref.slice(2).split('/').reduce((dugum, anahtar) => dugum?.[anahtar], openapi);
}

// $ref kapanisi boyunca ulasilan component schema adlarini ve property adlarini toplar.
function kapanis(dugum, openapi, sonuc = { semalar: new Set(), ozellikler: new Set() }, gorulen = new Set()) {
  if (!dugum || typeof dugum !== 'object') return sonuc;
  if (typeof dugum.$ref === 'string' && !gorulen.has(dugum.$ref)) {
    gorulen.add(dugum.$ref);
    if (dugum.$ref.startsWith(semaOneki)) sonuc.semalar.add(dugum.$ref.slice(semaOneki.length));
    kapanis(refCoz(openapi, dugum.$ref), openapi, sonuc, gorulen);
  }
  if (dugum.properties && typeof dugum.properties === 'object' && !Array.isArray(dugum.properties)) {
    for (const ad of Object.keys(dugum.properties)) sonuc.ozellikler.add(ad);
  }
  for (const [anahtar, deger] of Object.entries(dugum)) if (anahtar !== '$ref') kapanis(deger, openapi, sonuc, gorulen);
  return sonuc;
}

const refAdi = (sema) => typeof sema?.$ref === 'string' && sema.$ref.startsWith(semaOneki)
  ? sema.$ref.slice(semaOneki.length) : null;

function basariSemasi(islem) {
  const [, yanit] = Object.entries(islem.responses ?? {}).find(([kod]) => /^2\d\d$/.test(kod)) ?? [];
  return yanit?.content?.['application/json']?.schema;
}

// Operasyonun tipli girdi ve cikti schema adlari; tipsizse hata.
function tipliUclar(op) {
  const { metot, islem } = op;
  const yer = `${metot.toUpperCase()} ${op.yol}`;
  const govde = islem.requestBody?.content?.['application/json']?.schema;
  const girdi = govde === undefined ? null : refAdi(govde);
  dogrula(govde === undefined ? !['post', 'put', 'patch'].includes(metot) : girdi !== null,
    `${yer}: girdi govdesi component schema $ref olmali`);
  const basari = basariSemasi(islem);
  const cikti = islem['x-collection'] === true ? refAdi(basari?.properties?.data?.items) : refAdi(basari);
  if (metot === 'get' && islem['x-collection'] !== true) {
    dogrula(!(basari?.type === 'array' || basari?.properties?.data?.type === 'array'),
      `${yer}: liste donen uc sayfali koleksiyon (x-collection) olmali`);
  }
  dogrula(cikti !== null, `${yer}: basari cevabi tipli component schema olmali`);
  return { girdi, cikti };
}

function operasyonDogrula(op, bagliDavranislar, openapi) {
  const { yol, metot, islem, parametreler } = op;
  const yer = `${metot.toUpperCase()} ${yol}`;
  dogrula(yol.startsWith('/api/v1/'), `${yer}: pilot operasyonu /api/v1 altinda olmali`);
  dogrula(cogulKaynak.test(yol), `${yer}: kaynak adi cogul olmali`);
  const semalar = openapi.components?.securitySchemes ?? {};
  const bearerMi = (ad) => semalar[ad]?.type === 'http' && semalar[ad]?.scheme?.toLowerCase() === 'bearer';
  const anonim = bagliDavranislar.every((d) => anonimDavranislar.has(d.id));
  if (!anonim || islem.security?.length !== 0) {
    dogrula(Array.isArray(islem.security) && islem.security.length > 0 &&
      islem.security.every((g) => Object.keys(g).length > 0 && Object.keys(g).every(bearerMi)),
    `${yer}: login disi operasyon bearer security gerektirir`);
  }
  const cozulmus = parametreler.map((p) => typeof p?.$ref === 'string' ? refCoz(openapi, p.$ref) : p);
  const girdiAdlari = [...cozulmus.map((p) => p?.name ?? ''),
    ...kapanis(islem.requestBody, openapi).ozellikler];
  dogrula(girdiAdlari.every((ad) => !yasakGirdi.test(ad)),
    `${yer}: client tenant, connection string veya secret gonderemez`);
  const kodlar = islem['x-error-codes'] ?? {};
  dogrula(typeof kodlar === 'object' && !Array.isArray(kodlar) && Object.entries(kodlar).every(([durum, liste]) =>
    /^[45]\d\d$/.test(durum) && islem.responses?.[durum]?.$ref === '#/components/responses/Hata' &&
    Array.isArray(liste) && liste.length > 0 && liste.every((k) => hataKoduDeseni.test(k))),
  `${yer}: x-error-codes yalniz tanimli Hata response'larina UPPER_SNAKE_CASE kod listesi baglar`);
  const yazma = metot !== 'get';
  if (yazma && bagliDavranislar.some((d) => idempotentJira.has(d.sourceJira))) {
    dogrula(islem['x-idempotency-required'] === true &&
      cozulmus.some((p) => p?.name === 'Idempotency-Key' && p.in === 'header' && p.required === true),
    `${yer}: stok/finans yazmasi Idempotency-Key gerektirir`);
  }
  if (islem['x-idempotency-required'] === true) {
    dogrula(idempotencyKodlari.every((k) => kodlar['409']?.includes(k)),
      `${yer}: 409 x-error-codes ${idempotencyKodlari.join(' ve ')} icermeli`);
  }
  return tipliUclar(op);
}

function davranisDogrula(matris, ops, semalar, openapi) {
  const davranislar = matris.apiBehaviors;
  dogrula(Array.isArray(davranislar) && davranislar.length > 0, 'apiBehaviors katalogu dolu olmali');
  const idler = new Set();
  for (const d of davranislar) {
    dogrula(typeof d.id === 'string' && d.id && !idler.has(d.id), `apiBehavior id tekil olmali: ${d.id}`);
    idler.add(d.id);
    dogrula(jiraDeseni.test(d.sourceJira), `apiBehavior ${d.id}: sourceJira gecerli TBP anahtari olmali`);
    dogrula(typeof d.operationId === 'string' && ops.has(d.operationId),
      `apiBehavior ${d.id}: OpenAPI'de bulunan operationId gerekli`);
    dogrula(Array.isArray(d.schemas) && d.schemas.length > 0 && d.schemas.every((ad) => Object.hasOwn(semalar, ad)),
      `apiBehavior ${d.id}: schemas dolu olmali ve OpenAPI'de bulunmali`);
  }
  const girdiler = new Set();
  const ciktilar = new Set();
  for (const [kimlik, op] of ops) {
    const bagli = davranislar.filter((d) => d.operationId === kimlik);
    if (bagli.length === 0) continue;
    const { girdi, cikti } = operasyonDogrula(op, bagli, openapi);
    if (girdi) girdiler.add(girdi);
    ciktilar.add(cikti);
    const kullanilan = kapanis(op.islem, openapi).semalar;
    for (const d of bagli) {
      dogrula(d.schemas.every((ad) => kullanilan.has(ad)) && [girdi, cikti].every((ad) => !ad || d.schemas.includes(ad)),
        `apiBehavior ${d.id}: schemas ${kimlik} operasyonunda kullanilmali ve girdi/cikti schema'sini icermeli`);
    }
  }
  const ortak = [...girdiler].filter((ad) => ciktilar.has(ad));
  dogrula(ortak.length === 0, `girdi ve cikti schema'lari ayrik olmali: ${ortak.join(', ')}`);
  return new Map(davranislar.map((d) => [d.id, d]));
}

// Kok testOracles katalogu: her kayit bir Jira oracle tanimi, sahibi pilotJira, kosu kaniti TBP-258.
// Donus: bilinen oracle id'leri ve satir id -> o satiri kapsayan tek oracle kaydi.
function oracleKatalogDogrula(matris) {
  const katalog = matris.testOracles;
  dogrula(Array.isArray(katalog) && katalog.length > 0, 'testOracles katalogu dolu dizi olmali');
  const satirIdleri = new Set(matris.rows.map((s) => s.id));
  const idler = new Set();
  const kapsam = new Map();
  for (const o of katalog) {
    dogrula(jiraDeseni.test(o?.id) && !idler.has(o.id), `testOracles id tekil TBP anahtari olmali: ${o?.id}`);
    idler.add(o.id);
    dogrula(jiraDeseni.test(o.pilotJira), `testOracles ${o.id}: pilotJira gecerli TBP anahtari olmali`);
    dogrula(o.executionJira === testYurutmeJira, `testOracles ${o.id}: executionJira ${testYurutmeJira} olmali`);
    dogrula(Array.isArray(o.rows) && o.rows.length > 0, `testOracles ${o.id}: rows dolu dizi olmali`);
    for (const satirId of o.rows) {
      dogrula(satirIdleri.has(satirId), `testOracles ${o.id}: bilinmeyen satir ${satirId}`);
      dogrula(!kapsam.has(satirId), `testOracles ${o.id}: satir ${satirId} birden fazla oracle ile kapsanamaz`);
      kapsam.set(satirId, o);
    }
  }
  return { idler, kapsam };
}

// Satir testOracle'i katalogla iki yonlu eslesir: VERIFIED <=> satiri kapsayan kayit var.
function testOracleDogrula(satir, oracleler) {
  const yer = satir.id;
  const { status, ids } = satir.testOracle ?? {};
  dogrula(['MISSING', 'VERIFIED'].includes(status) && Array.isArray(ids) && ids.every((k) => jiraDeseni.test(k)),
    `${yer}: testOracle {status: MISSING|VERIFIED, ids: TBP anahtarlari} olmali`);
  dogrula((status === 'VERIFIED') === (ids.length > 0), `${yer}: testOracle VERIFIED ise ID zorunlu, MISSING ise ID bos olmali`);
  dogrula(ids.every((k) => oracleler.idler.has(k)), `${yer}: testOracle ids testOracles katalogunda bulunmali`);
  const kayit = oracleler.kapsam.get(yer);
  dogrula(kayit ? ids.length === 1 && ids[0] === kayit.id : ids.length === 0,
    `${yer}: testOracle ids yalniz bu satiri kapsayan katalog kaydini icermeli (${kayit?.id ?? 'yok'})`);
  if (kayit) dogrula(kayit.pilotJira === satir.pilotJira, `${yer}: testOracle ${kayit.id} pilotJira satir pilotJira ile eslesmeli`);
}

function satirDogrula(satir, matris, davranislar, kimlikler, semalar, oracleler) {
  const yer = satir.id ?? '?';
  dogrula(satir.pilotJira === akisJira[satir.flow], `${yer}: pilotJira beklenen Jira ile eslesmeli`);
  dogrula(satir.platformJira === platformJira[satir.platform], `${yer}: platformJira beklenen Jira ile eslesmeli`);
  dogrula(Array.isArray(satir.mainPlanJira) && satir.mainPlanJira.length > 0 &&
    satir.mainPlanJira.every((anahtar) => jiraDeseni.test(anahtar)), `${yer}: mainPlanJira gecerli TBP anahtarlari olmali`);
  dogrula(Array.isArray(satir.requirements) && satir.requirements.length > 0 &&
    satir.requirements.every((k) => jiraDeseni.test(k)), `${yer}: requirements gecerli Jira kimlikleri olmali`);
  dogrula(satir.requirements.includes(satir.pilotJira) && satir.requirements.includes(satir.platformJira),
    `${yer}: requirements pilotJira ve platformJira icermeli`);
  dogrula(typeof satir.humanApproval === 'boolean', `${yer}: humanApproval boolean olmali`);
  dogrula(Array.isArray(satir.blockers), `${yer}: blockers dizi olmali`);
  testOracleDogrula(satir, oracleler);
  dogrula(Array.isArray(satir.apiBehaviors) && satir.apiBehaviors.length > 0 &&
    satir.apiBehaviors.every((id) => davranislar.has(id)), `${yer}: apiBehaviors katalogdaki id'lere referans vermeli`);
  dogrula(Object.keys(satir.states ?? {}).sort().join() === [...durumlar].sort().join(),
    `${yer}: tam 6 state gerekli (${durumlar.join(', ')})`);
  for (const d of durumlar) {
    const { status, figmaNode } = satir.states[d] ?? {};
    dogrula(stateDurumlari.includes(status), `${yer}: state ${d} status UNVERIFIED/CANDIDATE/VERIFIED olmali`);
    dogrula(figmaNode === null || figmaNodeDeseni.test(figmaNode), `${yer}: state ${d} figmaNode gecerli node id veya null olmali`);
  }
  dogrula(satir.figma?.file === matris.figmaFile, `${yer}: figma file sabit figmaFile ile eslesmeli`);
  const nodlar = satir.figma.nodes;
  dogrula(Array.isArray(nodlar) && nodlar.every((n) => figmaNodeDeseni.test(n.id) &&
    typeof n.name === 'string' && n.name.trim() && figmaDurumlari.includes(n.status)),
    `${yer}: Figma node id N:N bicimli, name dolu, status CANDIDATE/VERIFIED olmali`);
  const { operationIds, schemas } = satir.openapi ?? {};
  dogrula(Array.isArray(operationIds) && Array.isArray(schemas), `${yer}: openapi operationIds/schemas dizi olmali`);
  dogrula(operationIds.every((kimlik) => kimlikler.has(kimlik)), `${yer}: OpenAPI'de olmayan operationId`);
  dogrula(schemas.every((ad) => Object.hasOwn(semalar, ad)), `${yer}: OpenAPI'de olmayan schema`);
  const kayitlar = satir.apiBehaviors.map((id) => davranislar.get(id));
  const esit = (liste, beklenen) => new Set(liste).size === liste.length &&
    liste.length === beklenen.size && liste.every((o) => beklenen.has(o));
  dogrula(esit(operationIds, new Set(kayitlar.map((d) => d.operationId))),
    `${yer}: openapi.operationIds apiBehaviors operationId birlesimine esit olmali`);
  dogrula(esit(schemas, new Set(kayitlar.flatMap((d) => d.schemas))),
    `${yer}: openapi.schemas apiBehaviors schema birlesimine esit olmali`);
  dogrula(readinessDegerleri.includes(satir.readiness), `${yer}: readiness ${readinessDegerleri.join('|')} olmali`);
  if (satir.readiness !== 'READY') {
    dogrula(satir.blockers.length > 0, `${yer}: ${satir.readiness} satir blocker tasimali`);
    return;
  }
  dogrula(satir.blockers.length === 0, `${yer}: READY satir blocker tasiyamaz`);
  dogrula(satir.testOracle.status === 'VERIFIED', `${yer}: READY icin testOracle VERIFIED ve ID'li olmali`);
  dogrula(nodlar.length > 0 && nodlar.every((n) => n.status === 'VERIFIED'),
    `${yer}: READY icin tum Figma node'lari VERIFIED olmali`);
  dogrula(durumlar.every((d) => satir.states[d].status === 'VERIFIED' && satir.states[d].figmaNode !== null),
    `${yer}: READY icin 6 state VERIFIED ve figmaNode dolu olmali`);
  dogrula(satir.humanApproval === true, `${yer}: READY icin humanApproval true olmali`);
}

export function pilotMatrisDogrula(matris, openapi) {
  dogrula(matris.sourceOfTruth === 'Jira', 'Jira Source of Truth olarak belirtilmeli');
  dogrula(surumler.every((s) => matris.releasePath?.some((r) => r.release === s && r.scope)),
    `releasePath ${surumler.join(', ')} icermeli`);
  dogrula(Array.isArray(matris.outOfScope) && matris.outOfScope.length > 0, 'outOfScope dolu olmali');
  dogrula(matris.rows?.length === 12, 'Tam 12 platform-akis satiri gerekli');
  const kombinasyonlar = new Set(matris.rows.map((s) => `${s.platform}/${s.flow}`));
  const beklenen = Object.keys(platformJira).flatMap((p) => Object.keys(akisJira).map((a) => `${p}/${a}`));
  dogrula(kombinasyonlar.size === 12 && beklenen.every((k) => kombinasyonlar.has(k)),
    'Windows/Android x Login, Musteri, Urun/Fiyat, Satis, Stok, Kasa Ozeti kombinasyonlari tam ve tekil olmali');
  // Tekil kombinasyon + bu kural satir id'lerini tekil yapar; oracle kapsami id ile baglanir.
  const hataliId = matris.rows.find((s) => s.id !== `${s.platform}-${s.flow}`);
  dogrula(!hataliId, `${hataliId?.id}: satir id platform-flow olmali`);
  const kimlikler = operasyonlar(openapi);
  const semalar = openapi.components?.schemas ?? {};
  const davranislar = davranisDogrula(matris, kimlikler, semalar, openapi);
  const oracleler = oracleKatalogDogrula(matris);
  for (const satir of matris.rows) satirDogrula(satir, matris, davranislar, kimlikler, semalar, oracleler);
  return true;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [matris, openapi] = await Promise.all([matrisKaynak, openapiKaynak]
    .map(async (kaynak) => JSON.parse(await readFile(kaynak, 'utf8'))));
  pilotMatrisDogrula(matris, openapi);
  console.log('R0.1 pilot izlenebilirlik matrisi PASS');
}
