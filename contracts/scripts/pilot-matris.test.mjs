import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pilotMatrisDogrula } from './pilot-matris.mjs';

const oku = async (yol) => JSON.parse(await readFile(new URL(yol, import.meta.url), 'utf8'));
const temel = await oku('../../docs/r0-1-pilot-izlenebilirlik.json');
const openapi = await oku('../openapi.json');
const kopya = () => structuredClone(temel);
const durumlar = ['loading', 'empty', 'validation', 'permission', 'networkError', 'success'];

const beklenenOperasyonlar = {
  'login-open': 'login', 'login-close': 'logout', 'login-revoke': 'revokeSession',
  'musteri-create': 'createCustomer', 'musteri-update': 'updateCustomer',
  'musteri-deactivate': 'deactivateCustomer', 'musteri-search-by-phone': 'searchCustomersByPhone',
  'urun-list': 'listProducts', 'urun-current-price': 'getCurrentProductPrice',
  'stok-list': 'listStock', 'stok-movement-history': 'listStockMovements',
  'stok-authorized-correction': 'createStockCorrection', 'stok-sale-effect': 'completeSale',
  'stok-empty-return-effect': 'completeSale', 'satis-complete-cash': 'completeSale',
  'satis-complete-current-account': 'completeSale', 'satis-cancel': 'cancelSale',
  'kasa-daily-summary': 'getDailyCashSummary', 'kasa-opening': 'openCashDay',
  'kasa-day-end-count': 'submitDayEndCount'
};
const beklenenOracle = {
  login: 'TBP-260', musteri: 'TBP-261', urunFiyat: 'TBP-261', stok: 'TBP-262', satis: 'TBP-263', kasaOzeti: 'TBP-264'
};
const idempotentOperasyonlar =['createStockCorrection', 'completeSale', 'cancelSale', 'openCashDay', 'submitDayEndCount'];
const listeOperasyonlari = ['searchCustomersByPhone', 'listProducts', 'listStock', 'listStockMovements'];

function operasyonBul(belge, kimlik) {
  for (const [yol, ogeler] of Object.entries(belge.paths)) {
    for (const [metot, islem] of Object.entries(ogeler)) {
      if (islem?.operationId === kimlik) return { yol, metot, islem };
    }
  }
  throw new Error(`operasyon yok: ${kimlik}`);
}

const apiReddeder = (degistir, desen) => {
  const api = structuredClone(openapi);
  degistir(api);
  assert.throws(() => pilotMatrisDogrula(kopya(), api), desen);
};

function hazirSatir() {
  const matris = kopya();
  const satir = matris.rows[0];
  satir.readiness = 'READY';
  satir.humanApproval = true;
  satir.blockers = [];
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
  assert.equal(pilotMatrisDogrula(matris, openapi), true);
});

test('READY satir kanit eksikse false-ready olarak reddedilir', () => {
  const dene = (degistir, desen) => {
    const { matris, satir } = hazirSatir();
    degistir(satir);
    assert.throws(() => pilotMatrisDogrula(matris, openapi), desen);
  };
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
  assert.throws(() => pilotMatrisDogrula(matris, openapi), /apiBehavior/);
});

test('her readiness icin satir openapi kumeleri behavior birlesimiyle tam esit olmali', () => {
  const ilk = kopya().rows[0].openapi;
  reddeder((m) => { m.rows[0].openapi.operationIds = [...ilk.operationIds, 'listProducts']; }, /operationId/);
  reddeder((m) => { m.rows[0].openapi.schemas = [...ilk.schemas, 'Urun']; }, /schema/);
  reddeder((m) => { m.rows[0].openapi.operationIds = ilk.operationIds.slice(1); }, /operationId/);
  reddeder((m) => { m.rows[0].openapi.schemas = ilk.schemas.slice(1); }, /schema/);
  reddeder((m) => { m.rows[0].openapi.operationIds = [...ilk.operationIds, ilk.operationIds[0]]; }, /operationId/);
  const { matris, satir } = hazirSatir();
  satir.openapi.operationIds = [...satir.openapi.operationIds, 'listProducts'];
  assert.throws(() => pilotMatrisDogrula(matris, openapi), /operationId/);
});

test('20 Jira davranisi kararli operationId ve tipli schema ile bagli', () => {
  const { apiBehaviors } = kopya();
  assert.deepEqual(Object.fromEntries(apiBehaviors.map((d) => [d.id, d.operationId])), beklenenOperasyonlar);
  for (const d of apiBehaviors) assert.ok(d.schemas.length > 0, `${d.id} schema bagli degil`);
  reddeder((m) => { m.apiBehaviors[0].operationId = null; }, /apiBehavior/);
  reddeder((m) => { m.apiBehaviors[0].schemas = []; }, /schema/);
  reddeder((m) => { m.apiBehaviors.find((d) => d.id === 'login-open').schemas = ['OturumAcmaIstegi', 'OturumYaniti', 'Musteri']; }, /schema/);
  reddeder((m) => { m.apiBehaviors.find((d) => d.id === 'login-open').schemas = ['OturumYaniti']; }, /schema/);
  reddeder((m) => { m.apiBehaviors.find((d) => d.id === 'urun-list').schemas = ['Sayfalama']; }, /schema/);
});

test('bagli operasyonlar /api/v1 altinda cogul kaynakta, bearer korumali; yalniz login anonim', () => {
  assert.equal(openapi.components.securitySchemes.bearerAuth.type, 'http');
  assert.equal(openapi.components.securitySchemes.bearerAuth.scheme, 'bearer');
  for (const kimlik of new Set(Object.values(beklenenOperasyonlar))) {
    const { yol, islem } = operasyonBul(openapi, kimlik);
    assert.match(yol, /^\/api\/v1\//, kimlik);
    if (kimlik === 'login') assert.deepEqual(islem.security, []);
    else assert.deepEqual(islem.security, [{ bearerAuth: [] }], kimlik);
  }
  apiReddeder((api) => {
    const { islem } = operasyonBul(api, 'listProducts');
    islem.security = [];
    islem['x-anonymous-reason'] = 'deneme';
  }, /bearer/);
  apiReddeder((api) => { api.components.securitySchemes.bearerAuth = { type: 'apiKey', name: 'k', in: 'header' }; }, /bearer/);
  apiReddeder((api) => {
    api.paths['/api/urunler'] = api.paths['/api/v1/urunler'];
    delete api.paths['/api/v1/urunler'];
  }, /api\/v1/);
  apiReddeder((api) => {
    api.paths['/api/v1/urun'] = api.paths['/api/v1/urunler'];
    delete api.paths['/api/v1/urunler'];
  }, /cogul/);
});

test('client tenant, connection string veya secret gonderemez', () => {
  apiReddeder((api) => { api.components.schemas.MusteriOlusturmaIstegi.properties.tenantId = { type: 'string' }; }, /tenant/);
  apiReddeder((api) => {
    operasyonBul(api, 'listProducts').islem.parameters.push({ name: 'tenantId', in: 'query', schema: { type: 'string' } });
  }, /tenant/);
  apiReddeder((api) => {
    operasyonBul(api, 'completeSale').islem.parameters.push({ name: 'X-Connection-String', in: 'header', schema: { type: 'string' } });
  }, /tenant/);
  apiReddeder((api) => { api.components.schemas.SatisKalemi.properties.clientSecret = { type: 'string' }; }, /tenant/);
});

test('stok/finans yazmalari Idempotency-Key ister; reuse ve in-flight 409 kodlariyla belgelenir', () => {
  for (const kimlik of idempotentOperasyonlar) {
    const { islem } = operasyonBul(openapi, kimlik);
    assert.equal(islem['x-idempotency-required'], true, kimlik);
    assert.ok(islem.parameters.some((p) => p.$ref === '#/components/parameters/IdempotencyKey'), kimlik);
    assert.deepEqual(islem['x-error-codes']['409'].slice(0, 2), ['IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_IN_PROGRESS'], kimlik);
  }
  assert.match(openapi.components.parameters.IdempotencyKey.description, /IDEMPOTENCY_CONFLICT/);
  assert.match(openapi.components.parameters.IdempotencyKey.description, /IDEMPOTENCY_IN_PROGRESS/);
  apiReddeder((api) => {
    const { islem } = operasyonBul(api, 'completeSale');
    islem['x-idempotency-required'] = false;
    islem['x-retry-semantics'] = 'deneme';
    islem.parameters = islem.parameters.filter((p) => p.$ref !== '#/components/parameters/IdempotencyKey');
  }, /Idempotency/);
  apiReddeder((api) => { operasyonBul(api, 'openCashDay').islem['x-error-codes']['409'] = ['IDEMPOTENCY_CONFLICT']; }, /IDEMPOTENCY_IN_PROGRESS/);
  apiReddeder((api) => { operasyonBul(api, 'cancelSale').islem['x-error-codes']['418'] = ['IDEMPOTENCY_CONFLICT']; }, /x-error-codes/);
  apiReddeder((api) => { operasyonBul(api, 'cancelSale').islem['x-error-codes']['409'].push('kucuk-kod'); }, /x-error-codes/);
});

test('liste uclari sayfali, tekil uclar tipli schema dondurur', () => {
  for (const kimlik of listeOperasyonlari) assert.equal(operasyonBul(openapi, kimlik).islem['x-collection'], true, kimlik);
  apiReddeder((api) => { operasyonBul(api, 'listStock').islem['x-collection'] = false; }, /sayfa/);
  apiReddeder((api) => {
    operasyonBul(api, 'getDailyCashSummary').islem.responses['200'].content['application/json'].schema = { type: 'object' };
  }, /schema/);
});

test('girdi ve cikti semalari ayrik ve tipli', () => {
  apiReddeder((api) => {
    operasyonBul(api, 'updateCustomer').islem.responses['200'].content['application/json'].schema =
      { $ref: '#/components/schemas/MusteriGuncellemeIstegi' };
  }, /girdi/);
  apiReddeder((api) => {
    operasyonBul(api, 'createCustomer').islem.requestBody.content['application/json'].schema = { type: 'object' };
  }, /girdi/);
});

test('cozulen OpenAPI ve testOracle blocker kaldirildi; Figma/state/insan onayi eksigi BLOCKED tutar', () => {
  for (const satir of kopya().rows) {
    assert.equal(satir.readiness, 'BLOCKED', satir.id);
    assert.equal(satir.humanApproval, false, satir.id);
    assert.equal(satir.testOracle.status, 'VERIFIED', satir.id);
    assert.deepEqual(satir.testOracle.ids, [beklenenOracle[satir.flow]], satir.id);
    assert.ok(satir.blockers.every((b) => !/paths bos|securitySchemes yok|Jira api davranislari yerel olarak kopyalanmadi/.test(b)), satir.id);
    assert.ok(satir.blockers.every((b) => !/testOracle|Test oracle/.test(b)), satir.id);
    assert.ok(satir.blockers.some((b) => /Figma View kotasi/.test(b)), satir.id);
    assert.ok(durumlar.every((d) => satir.states[d].status === 'UNVERIFIED' && satir.states[d].figmaNode === null), satir.id);
    assert.ok(satir.blockers.some((b) => /humanApproval/.test(b)), satir.id);
    assert.ok(satir.openapi.operationIds.length > 0 && satir.openapi.schemas.length > 0, satir.id);
  }
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
  reddeder((m) => { m.rows[0].testOracle = { status: 'MISSING', ids: [] }; }, /testOracle ids yalniz/);
});

const oracle = (m, id) => m.testOracles.find((o) => o.id === id);

test('testOracles katalogu: her oracle bilinen, tekil, dogru satirlari kapsar; kosu kaniti TBP-258', () => {
  const { testOracles } = kopya();
  assert.deepEqual(testOracles.map((o) => [o.id, o.pilotJira, o.executionJira]), [
    ['TBP-260', 'TBP-249', 'TBP-258'], ['TBP-261', 'TBP-250', 'TBP-258'], ['TBP-262', 'TBP-251', 'TBP-258'],
    ['TBP-263', 'TBP-252', 'TBP-258'], ['TBP-264', 'TBP-253', 'TBP-258']
  ]);
  assert.equal(testOracles.flatMap((o) => o.rows).length, 12);
  // katalog bicimi
  reddeder((m) => { delete m.testOracles; }, /testOracles katalogu/);
  reddeder((m) => { m.testOracles = []; }, /testOracles katalogu/);
  reddeder((m) => { oracle(m, 'TBP-261').id = 'TBP-260'; }, /tekil/);
  reddeder((m) => { oracle(m, 'TBP-260').id = 'oracle-1'; }, /tekil/);
  reddeder((m) => { oracle(m, 'TBP-260').rows = []; }, /rows/);
  // bilinmeyen oracle ID
  reddeder((m) => { m.rows[0].testOracle.ids = ['TBP-999']; }, /katalogunda bulunmali/);
  // yanlis satir kapsami
  reddeder((m) => { oracle(m, 'TBP-260').rows.push('ios-login'); }, /bilinmeyen satir/);
  reddeder((m) => { oracle(m, 'TBP-260').rows.push('windows-musteri'); }, /birden fazla/);
  reddeder((m) => { oracle(m, 'TBP-260').rows = ['android-login']; }, /windows-login: testOracle ids yalniz/);
  reddeder((m) => { m.rows[0].testOracle.ids = ['TBP-261']; }, /windows-login: testOracle ids yalniz/);
  reddeder((m) => { m.rows[0].testOracle.ids = ['TBP-260', 'TBP-261']; }, /testOracle ids yalniz/);
  reddeder((m) => { m.rows[0].id = 'windows-giris'; }, /platform-flow/);
  // yanlis pilotJira sahipligi
  reddeder((m) => { oracle(m, 'TBP-260').pilotJira = 'TBP-250'; }, /TBP-260 pilotJira/);
  reddeder((m) => { oracle(m, 'TBP-260').pilotJira = 'x'; }, /pilotJira gecerli/);
  // yanlis kosu (execution) Jira
  reddeder((m) => { oracle(m, 'TBP-262').executionJira = 'TBP-257'; }, /executionJira TBP-258/);
  reddeder((m) => { delete oracle(m, 'TBP-262').executionJira; }, /executionJira TBP-258/);
});

test('kapsanmayan satir durustce MISSING kalabilir ama READY olamaz', () => {
  const m = kopya();
  oracle(m, 'TBP-260').rows = ['android-login'];
  m.rows[0].testOracle = { status: 'MISSING', ids: [] };
  assert.equal(pilotMatrisDogrula(m, openapi), true);
  const { matris, satir } = hazirSatir();
  oracle(matris, 'TBP-260').rows = ['android-login'];
  satir.testOracle = { status: 'MISSING', ids: [] };
  assert.throws(() => pilotMatrisDogrula(matris, openapi), /READY icin testOracle/);
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
