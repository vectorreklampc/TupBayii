import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const surumEkliOlayAdi = /\.v\d+$/u;

async function jsonOku(dosyaYolu) {
  return JSON.parse(await readFile(dosyaYolu, "utf8"));
}

export async function guvenliJsonOku(kokYolu, goreliYol) {
  const gercekKok = await realpath(kokYolu);
  const cozulmusYol = path.resolve(gercekKok, goreliYol);
  if (!cozulmusYol.startsWith(`${gercekKok}${path.sep}`)) {
    throw new Error(`Registry yolu kok dizin disina cikamaz: ${goreliYol}`);
  }

  const gercekYol = await realpath(cozulmusYol);
  if (!gercekYol.startsWith(`${gercekKok}${path.sep}`)) {
    throw new Error(`Registry yolu kok dizin disina cikamaz: ${goreliYol}`);
  }
  const dosyaBilgisi = await stat(gercekYol);
  if (!dosyaBilgisi.isFile() || dosyaBilgisi.size > 1024 * 1024) {
    throw new Error(
      `Registry JSON dosyasi gecersiz veya cok buyuk: ${goreliYol}`,
    );
  }
  return jsonOku(gercekYol);
}

function registryYapisiniDogrula(registry) {
  if (!Array.isArray(registry.events) || registry.events.length === 0) {
    throw new Error("Registry en az bir olay icermelidir.");
  }

  const anahtarlar = new Set();
  const revisionlar = new Map();

  for (const olay of registry.events) {
    if (typeof olay.name !== "string" || olay.name.length === 0) {
      throw new Error("Her olay anlamli bir name degeri tasimalidir.");
    }
    if (surumEkliOlayAdi.test(olay.name)) {
      throw new Error(`Olay adi surum eki tasiyamaz: ${olay.name}`);
    }
    if (!Number.isInteger(olay.SchemaRevision) || olay.SchemaRevision < 1) {
      throw new Error(
        `${olay.name} SchemaRevision pozitif tam sayi olmalidir.`,
      );
    }
    if (typeof olay.schema !== "string" || typeof olay.example !== "string") {
      throw new Error(`${olay.name} schema ve example yollarini tasimalidir.`);
    }

    const anahtar = `${olay.name}:${olay.SchemaRevision}`;
    if (anahtarlar.has(anahtar)) {
      throw new Error(`Yinelenen olay revision'i: ${anahtar}`);
    }
    anahtarlar.add(anahtar);

    const olayRevisionlari = revisionlar.get(olay.name) ?? [];
    olayRevisionlari.push(olay.SchemaRevision);
    revisionlar.set(olay.name, olayRevisionlari);
  }

  for (const [olayAdi, olayRevisionlari] of revisionlar) {
    olayRevisionlari.sort((sol, sag) => sol - sag);
    olayRevisionlari.forEach((revision, sira) => {
      if (revision !== sira + 1) {
        throw new Error(
          `${olayAdi} SchemaRevision degerleri 1'den baslayan ardisik sayilar olmalidir.`,
        );
      }
    });
  }
}

export async function kayitDefteriniDogrula(
  kokYolu = path.resolve(import.meta.dirname, ".."),
  payloadDegisiklikleri = {},
) {
  const registry = await jsonOku(path.join(kokYolu, "registry.json"));
  registryYapisiniDogrula(registry);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addKeyword({ keyword: "x-schema-revision", schemaType: "number" });
  const sonuclar = [];

  for (const olay of registry.events) {
    const sema = await guvenliJsonOku(kokYolu, olay.schema);
    if (sema.title !== olay.name) {
      throw new Error(
        `${olay.name} schema title degeri olay adiyla ayni olmalidir.`,
      );
    }
    if (sema["x-schema-revision"] !== olay.SchemaRevision) {
      throw new Error(
        `${olay.name} schema revision metadata degeri registry ile ayni olmalidir.`,
      );
    }

    const payloadAnahtari = `${olay.name}:${olay.SchemaRevision}`;
    const payload = Object.hasOwn(payloadDegisiklikleri, payloadAnahtari)
      ? payloadDegisiklikleri[payloadAnahtari]
      : await guvenliJsonOku(kokYolu, olay.example);
    const dogrula = ajv.compile(sema);

    if (!dogrula(payload)) {
      const ayrinti = ajv.errorsText(dogrula.errors, { separator: "; " });
      throw new Error(`${olay.name} payload semaya uymuyor: ${ayrinti}`);
    }

    sonuclar.push({
      name: olay.name,
      SchemaRevision: olay.SchemaRevision,
      valid: true,
    });
  }

  return sonuclar;
}

const dogrudanCalistiriliyor =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (dogrudanCalistiriliyor) {
  try {
    const sonuclar = await kayitDefteriniDogrula();
    console.log(`${sonuclar.length} olay sozlesmesi dogrulandi.`);
  } catch (hata) {
    console.error(hata.message);
    process.exitCode = 1;
  }
}
