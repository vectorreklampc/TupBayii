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

function dogrula(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}

function operasyonKimlikleri(openapi) {
  return new Set(Object.values(openapi.paths ?? {}).flatMap((ogeler) =>
    Object.values(ogeler).map((islem) => islem?.operationId).filter(Boolean)));
}

const readinessDegerleri = ['BLOCKED', 'SPEC_REQUIRED', 'HUMAN_REQUIRED', 'READY'];
const stateDurumlari = ['UNVERIFIED', 'CANDIDATE', 'VERIFIED'];
const figmaDurumlari = ['CANDIDATE', 'VERIFIED'];
const figmaNodeDeseni = /^\d+:\d+$/;

function davranisDogrula(matris, kimlikler, semalar) {
  const davranislar = matris.apiBehaviors;
  dogrula(Array.isArray(davranislar) && davranislar.length > 0, 'apiBehaviors katalogu dolu olmali');
  const idler = new Set();
  for (const d of davranislar) {
    dogrula(typeof d.id === 'string' && d.id && !idler.has(d.id), `apiBehavior id tekil olmali: ${d.id}`);
    idler.add(d.id);
    dogrula(jiraDeseni.test(d.sourceJira), `apiBehavior ${d.id}: sourceJira gecerli TBP anahtari olmali`);
    dogrula(d.operationId === null || kimlikler.has(d.operationId), `apiBehavior ${d.id}: OpenAPI'de olmayan operationId`);
    dogrula(Array.isArray(d.schemas) && d.schemas.every((ad) => Object.hasOwn(semalar, ad)),
      `apiBehavior ${d.id}: schemas dizi olmali ve OpenAPI'de bulunmali`);
  }
  return new Map(davranislar.map((d) => [d.id, d]));
}

function testOracleDogrula(yer, oracle) {
  const { status, ids } = oracle ?? {};
  dogrula(['MISSING', 'VERIFIED'].includes(status) && Array.isArray(ids) && ids.every((k) => jiraDeseni.test(k)),
    `${yer}: testOracle {status: MISSING|VERIFIED, ids: TBP anahtarlari} olmali`);
  dogrula((status === 'VERIFIED') === (ids.length > 0), `${yer}: testOracle VERIFIED ise ID zorunlu, MISSING ise ID bos olmali`);
}

function satirDogrula(satir, matris, davranislar, kimlikler, semalar) {
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
  testOracleDogrula(yer, satir.testOracle);
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
  dogrula(readinessDegerleri.includes(satir.readiness), `${yer}: readiness ${readinessDegerleri.join('|')} olmali`);
  if (satir.readiness !== 'READY') {
    dogrula(satir.blockers.length > 0, `${yer}: ${satir.readiness} satir blocker tasimali`);
    return;
  }
  dogrula(satir.blockers.length === 0, `${yer}: READY satir blocker tasiyamaz`);
  dogrula(satir.testOracle.status === 'VERIFIED', `${yer}: READY icin testOracle VERIFIED ve ID'li olmali`);
  dogrula(satir.apiBehaviors.every((id) => {
    const d = davranislar.get(id);
    return d.operationId !== null && d.schemas.length > 0;
  }), `${yer}: READY icin tum apiBehavior'lar operationId ve schema ile cozulmus olmali`);
  dogrula(operationIds.length > 0, `${yer}: READY icin gercek operationId gerekli`);
  dogrula(schemas.length > 0, `${yer}: READY icin gercek schema gerekli`);
  const kayitlar = satir.apiBehaviors.map((id) => davranislar.get(id));
  const esit = (liste, beklenen) => new Set(liste).size === liste.length &&
    liste.length === beklenen.size && liste.every((o) => beklenen.has(o));
  dogrula(esit(operationIds, new Set(kayitlar.map((d) => d.operationId))),
    `${yer}: READY openapi.operationIds apiBehaviors operationId birlesimine esit olmali`);
  dogrula(esit(schemas, new Set(kayitlar.flatMap((d) => d.schemas))),
    `${yer}: READY openapi.schemas apiBehaviors schema birlesimine esit olmali`);
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
  const kimlikler = operasyonKimlikleri(openapi);
  const semalar = openapi.components?.schemas ?? {};
  const davranislar = davranisDogrula(matris, kimlikler, semalar);
  for (const satir of matris.rows) satirDogrula(satir, matris, davranislar, kimlikler, semalar);
  return true;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [matris, openapi] = await Promise.all([matrisKaynak, openapiKaynak]
    .map(async (kaynak) => JSON.parse(await readFile(kaynak, 'utf8'))));
  pilotMatrisDogrula(matris, openapi);
  console.log('R0.1 pilot izlenebilirlik matrisi PASS');
}
