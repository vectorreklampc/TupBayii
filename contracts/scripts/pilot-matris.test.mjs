import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pilotMatrisDogrula } from './pilot-matris.mjs';

const oku = async (yol) => JSON.parse(await readFile(new URL(yol, import.meta.url), 'utf8'));
const temel = await oku('../../docs/r0-1-pilot-izlenebilirlik.json');
const openapi = await oku('../openapi.json');
const kopya = () => structuredClone(temel);
const durumlar = ['loading', 'empty', 'validation', 'permission', 'networkError', 'success'];

const apiBelgesi = () => {
  const belge = structuredClone(openapi);
  belge.paths['/api/giris'] = { post: { operationId: 'girisYap' } };
  belge.components.schemas.GirisIstegi = { type: 'object' };
  return belge;
};

function hazirSatir() {
  const matris = kopya();
  const satir = matris.rows[0];
  satir.readiness = 'READY';
  satir.humanApproval = true;
  satir.blockers = [];
  satir.openapi = { operationIds: ['girisYap'], schemas: ['GirisIstegi'] };
  satir.testOracle = { status: 'VERIFIED', ids: ['TBP-900'] };
  for (const davranis of matris.apiBehaviors.filter((d) => satir.apiBehaviors.includes(d.id))) {
    davranis.operationId = 'girisYap';
    davranis.schemas = ['GirisIstegi'];
  }
  satir.figma.nodes = [{ id: '1:1', name: 'Login', status: 'VERIFIED' }];
  for (const durum of durumlar) satir.states[durum] = { status: 'VERIFIED', figmaNode: '1:1' };
  return { matris, satir };
}

const reddeder = (degistir, desen, api = openapi) => {
  const matris = kopya();
  degistir(matris);
  assert.throws(() => pilotMatrisDogrula(matris, api), desen);
};

test('mevcut blokeli matris dogrulanir', () => {
  assert.equal(pilotMatrisDogrula(kopya(), openapi), true);
});

test('12 platform-akis kombinasyonu zorunlu ve tekil', () => {
  reddeder((m) => m.rows.pop(), /12/);
  reddeder((m) => { m.rows[1].flow = m.rows[0].flow; m.rows[1].platform = m.rows[0].platform; }, /kombinasyon/);
});

test('state seti tam 6 olmali', () => {
  reddeder((m) => delete m.rows[0].states.empty, /state/);
  reddeder((m) => { m.rows[0].states.ekstra = { status: 'UNVERIFIED', figmaNode: null }; }, /state/);
});

test('Jira, release yolu ve kapsam disi zorunlu', () => {
  reddeder((m) => { m.sourceOfTruth = 'Yerel'; }, /Source of Truth/);
  reddeder((m) => { m.rows[0].pilotJira = 'TBP-1'; }, /pilotJira/);
  reddeder((m) => { m.rows[0].mainPlanJira = ['abc']; }, /mainPlanJira/);
  reddeder((m) => { m.rows[0].platformJira = 'TBP-256'; }, /platformJira/);
  reddeder((m) => { m.releasePath = m.releasePath.filter((r) => r.release !== 'R0.2'); }, /releasePath/);
  reddeder((m) => { m.outOfScope = []; }, /outOfScope/);
});

test('blokeli satir blocker tasimali, bilinmeyen readiness reddedilir', () => {
  reddeder((m) => { m.rows[0].blockers = []; }, /blocker/);
  reddeder((m) => { m.rows[0].readiness = 'DONE'; }, /readiness/);
});

test('olmayan operationId/schema satirda kayitli olamaz', () => {
  reddeder((m) => { m.rows[0].openapi.operationIds = ['uydurma']; }, /operationId/);
  reddeder((m) => { m.rows[0].openapi.schemas = ['Uydurma']; }, /schema/);
});

test('READY satir tum kanit varsa gecer', () => {
  const { matris } = hazirSatir();
  assert.equal(pilotMatrisDogrula(matris, apiBelgesi()), true);
});

test('READY satir kanit eksikse false-ready olarak reddedilir', () => {
  const dene = (degistir, desen, api = apiBelgesi()) => {
    const { matris, satir } = hazirSatir();
    degistir(satir);
    assert.throws(() => pilotMatrisDogrula(matris, api), desen);
  };
  assert.throws(() => pilotMatrisDogrula(hazirSatir().matris, openapi), /operationId/);
  dene((s) => { s.openapi.operationIds = []; }, /operation/);
  dene((s) => { s.openapi.schemas = []; }, /schema/);
  dene((s) => { s.figma.nodes = []; }, /Figma/);
  dene((s) => { s.figma.nodes[0].status = 'CANDIDATE'; }, /Figma/);
  dene((s) => { s.states.empty.status = 'UNVERIFIED'; }, /state/);
  dene((s) => { s.humanApproval = false; }, /humanApproval/);
  dene((s) => { s.blockers = ['acik']; }, /blocker/);
  dene((s) => { s.testOracle = { status: 'MISSING', ids: [] }; }, /testOracle/);
  dene((s) => { s.testOracle = { status: 'VERIFIED', ids: [] }; }, /testOracle/);
  dene((s) => { s.states.empty.figmaNode = null; }, /figmaNode/);
  dene((s) => { s.apiBehaviors = []; }, /apiBehavior/);
});

test('READY satirdaki behavior OpenAPI ile cozulmeli', () => {
  const { matris, satir } = hazirSatir();
  matris.apiBehaviors.find((d) => d.id === satir.apiBehaviors[0]).operationId = null;
  assert.throws(() => pilotMatrisDogrula(matris, apiBelgesi()), /apiBehavior/);
});

test('READY openapi kumeleri behavior birlesimiyle tam esit olmali', () => {
  const dene = (degistir, desen) => {
    const { matris, satir } = hazirSatir();
    const api = apiBelgesi();
    api.paths['/api/baska'] = { get: { operationId: 'baskaIslem' } };
    api.components.schemas.BaskaSema = { type: 'object' };
    degistir(satir);
    assert.throws(() => pilotMatrisDogrula(matris, api), desen);
  };
  dene((s) => { s.openapi.operationIds = ['girisYap', 'baskaIslem']; }, /operationId/);
  dene((s) => { s.openapi.schemas = ['GirisIstegi', 'BaskaSema']; }, /schema/);
  dene((s) => { s.openapi.operationIds = ['baskaIslem']; }, /operationId/);
  dene((s) => { s.openapi.schemas = ['BaskaSema']; }, /schema/);
});

test('requirements pilotJira ve platformJira icermeli', () => {
  reddeder((m) => { m.rows[0].requirements = [m.rows[0].platformJira]; }, /requirements/);
  reddeder((m) => { m.rows[0].requirements = [m.rows[0].pilotJira]; }, /requirements/);
});

test('humanApproval her durumda boolean, Figma node name dolu', () => {
  reddeder((m) => { delete m.rows[0].humanApproval; }, /humanApproval/);
  reddeder((m) => { m.rows[0].humanApproval = 'evet'; }, /humanApproval/);
  reddeder((m) => { m.rows[0].figma.nodes = [{ id: '1:2', name: '', status: 'CANDIDATE' }]; }, /name/);
  reddeder((m) => { m.rows[0].figma.nodes = [{ id: '1:2', name: '  ', status: 'CANDIDATE' }]; }, /name/);
});

test('requirements Jira kimligi, testOracle durust eksik olmali', () => {
  reddeder((m) => { m.rows[0].requirements = ['gelecekte yazilacak']; }, /requirements/);
  reddeder((m) => { m.rows[0].requirements = []; }, /requirements/);
  reddeder((m) => { m.rows[0].testOracle = { status: 'VERIFIED', ids: [] }; }, /testOracle/);
  reddeder((m) => { m.rows[0].testOracle = { status: 'MISSING', ids: ['TBP-1'] }; }, /testOracle/);
  reddeder((m) => { m.rows[0].testOracle = { status: 'VERIFIED', ids: ['x'] }; }, /testOracle/);
});

test('apiBehaviors katalogu tutarli', () => {
  const m0 = kopya();
  assert.ok(m0.apiBehaviors.length >= 20);
  assert.ok(m0.rows.every((s) => s.apiBehaviors.length > 0));
  reddeder((m) => { m.rows[0].apiBehaviors = ['yok']; }, /apiBehavior/);
  reddeder((m) => { m.apiBehaviors[0].sourceJira = 'x'; }, /apiBehavior/);
  reddeder((m) => { m.apiBehaviors[0].operationId = 'uydurma'; }, /operationId/);
  reddeder((m) => { m.apiBehaviors[1].id = m.apiBehaviors[0].id; }, /apiBehavior/);
});

test('blokeli satirda da state/figma bicimi gecerli, file sabit', () => {
  reddeder((m) => { m.rows[0].states.empty.status = 'DONE'; }, /state/);
  reddeder((m) => { m.rows[0].states.empty.figmaNode = 'abc'; }, /figmaNode/);
  reddeder((m) => { m.rows[0].figma.file = 'baska'; }, /file/);
  reddeder((m) => { m.rows[0].figma.nodes = [{ id: 'x', name: 'n', status: 'VERIFIED' }]; }, /node/);
  reddeder((m) => { m.rows[0].figma.nodes = [{ id: '1:2', name: 'n', status: 'DONE' }]; }, /node/);
});

test('readiness enum ve blocker kurali', () => {
  for (const r of ['SPEC_REQUIRED', 'HUMAN_REQUIRED']) {
    reddeder((m) => { m.rows[0].readiness = r; m.rows[0].blockers = []; }, /blocker/);
    const m = kopya();
    m.rows[0].readiness = r;
    assert.equal(pilotMatrisDogrula(m, openapi), true);
  }
});
