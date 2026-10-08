import assert from "node:assert/strict";
import {
  copyFile,
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { kayitDefteriniDogrula } from "../scripts/dogrula.mjs";
import { uyumluluguDogrula } from "../scripts/uyumluluk-kontrolu.mjs";

const kokYolu = path.resolve(import.meta.dirname, "..");
const baslangicOlaylari = [
  "SaleCompleted",
  "DeliveryCompleted",
  "PaymentReceived",
  "CylinderTransferred",
  "CollectionPosted",
];

async function geciciKayitDefteriOlustur(testBaglami, onEk) {
  const geciciKok = await mkdtemp(path.join(tmpdir(), onEk));
  await Promise.all([
    copyFile(
      path.join(kokYolu, "registry.json"),
      path.join(geciciKok, "registry.json"),
    ),
    cp(path.join(kokYolu, "schemas"), path.join(geciciKok, "schemas"), {
      recursive: true,
    }),
    cp(path.join(kokYolu, "examples"), path.join(geciciKok, "examples"), {
      recursive: true,
    }),
  ]);
  testBaglami.after(() => rm(geciciKok, { recursive: true, force: true }));
  return geciciKok;
}

test("baslangic olaylari surum eki olmadan kayitlidir", async () => {
  const kayitDefteri = JSON.parse(
    await readFile(path.join(kokYolu, "registry.json"), "utf8"),
  );

  assert.deepEqual(
    kayitDefteri.events.map((olay) => olay.name).sort(),
    [...baslangicOlaylari].sort(),
  );
  assert.ok(kayitDefteri.events.every((olay) => olay.SchemaRevision === 1));
  assert.ok(kayitDefteri.events.every((olay) => !/\.v\d+$/u.test(olay.name)));
});

for (const surumEkliAd of [
  "SaleCompleted.v1",
  "SaleCompleted.V1",
  "SaleCompletedV2",
  "SaleCompleted_v1",
  "SaleCompleted-v1",
  "SaleCompleted2",
]) {
  test(`${surumEkliAd} surum ekli olay adi reddedilir`, async (t) => {
    const geciciKok = await geciciKayitDefteriOlustur(t, "tbp-26-ad-");

    const registryYolu = path.join(geciciKok, "registry.json");
    const registry = JSON.parse(await readFile(registryYolu, "utf8"));
    registry.events[0].name = surumEkliAd;
    await writeFile(registryYolu, `${JSON.stringify(registry, null, 2)}\n`);

    await assert.rejects(
      kayitDefteriniDogrula(geciciKok),
      /Olay adi surum eki tasiyamaz/u,
    );
  });
}

test("her baslangic olayinin ornek payloadi semasina uyar", async () => {
  const sonuc = await kayitDefteriniDogrula(kokYolu);

  assert.equal(sonuc.length, baslangicOlaylari.length);
  assert.ok(sonuc.every((olay) => olay.valid));
});

for (const olayAdi of baslangicOlaylari) {
  test(`${olayAdi} gecersiz payloadi reddedilir`, async () => {
    await assert.rejects(
      kayitDefteriniDogrula(kokYolu, {
        [`${olayAdi}:1`]: { kaynakVersion: 0 },
      }),
      new RegExp(`${olayAdi}.*payload`, "u"),
    );
  });
}

test("ayni SchemaRevision altindaki sema degisikligi reddedilir", async (t) => {
  const geciciKok = await geciciKayitDefteriOlustur(t, "tbp-26-kirici-");

  const semaYolu = path.join(geciciKok, "schemas", "SaleCompleted.schema.json");
  const sema = JSON.parse(await readFile(semaYolu, "utf8"));
  sema.properties.sonradanEklenenZorunluAlan = { type: "string" };
  sema.required.push("sonradanEklenenZorunluAlan");
  await writeFile(semaYolu, `${JSON.stringify(sema, null, 2)}\n`);
  const ornekYolu = path.join(geciciKok, "examples", "SaleCompleted.json");
  const ornek = JSON.parse(await readFile(ornekYolu, "utf8"));
  ornek.sonradanEklenenZorunluAlan = "kirici";
  await writeFile(ornekYolu, `${JSON.stringify(ornek, null, 2)}\n`);

  await assert.rejects(
    uyumluluguDogrula(kokYolu, geciciKok),
    /SaleCompleted.*SchemaRevision 1/u,
  );
});

test("yeni SchemaRevision ile sema evrimine izin verilir", async (t) => {
  const geciciKok = await geciciKayitDefteriOlustur(t, "tbp-26-revision-");

  const registryYolu = path.join(geciciKok, "registry.json");
  const registry = JSON.parse(await readFile(registryYolu, "utf8"));
  const satisOlayi = registry.events.find(
    (olay) => olay.name === "SaleCompleted",
  );
  const ikinciRevision = {
    ...satisOlayi,
    SchemaRevision: 2,
    schema: "schemas/SaleCompleted.revision-2.schema.json",
  };
  await copyFile(
    path.join(geciciKok, satisOlayi.schema),
    path.join(geciciKok, ikinciRevision.schema),
  );
  const ikinciSema = JSON.parse(
    await readFile(path.join(geciciKok, ikinciRevision.schema), "utf8"),
  );
  ikinciSema["x-schema-revision"] = 2;
  ikinciSema.$id = ikinciSema.$id.replace("revision-1", "revision-2");
  await writeFile(
    path.join(geciciKok, ikinciRevision.schema),
    `${JSON.stringify(ikinciSema, null, 2)}\n`,
  );
  registry.events.push(ikinciRevision);
  await writeFile(registryYolu, `${JSON.stringify(registry, null, 2)}\n`);

  await assert.doesNotReject(uyumluluguDogrula(kokYolu, geciciKok));
});

test("uyumluluk kontrolu registry kokunun disindaki dosyayi okumaz", async (t) => {
  const geciciKok = await geciciKayitDefteriOlustur(t, "tbp-26-yol-");

  const registryYolu = path.join(geciciKok, "registry.json");
  const registry = JSON.parse(await readFile(registryYolu, "utf8"));
  registry.events[0].schema = "../package.json";
  await writeFile(registryYolu, `${JSON.stringify(registry, null, 2)}\n`);

  await assert.rejects(
    uyumluluguDogrula(geciciKok, kokYolu),
    /Registry yolu kok dizin disina cikamaz/u,
  );
});
