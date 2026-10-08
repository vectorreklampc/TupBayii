import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { guvenliJsonOku, kayitDefteriniDogrula } from "./dogrula.mjs";

async function jsonOku(dosyaYolu) {
  return JSON.parse(await readFile(dosyaYolu, "utf8"));
}

function canonicalJson(deger) {
  if (Array.isArray(deger)) {
    return `[${deger.map(canonicalJson).join(",")}]`;
  }
  if (deger && typeof deger === "object") {
    return `{${Object.keys(deger)
      .sort()
      .map(
        (anahtar) =>
          `${JSON.stringify(anahtar)}:${canonicalJson(deger[anahtar])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(deger);
}

export async function uyumluluguDogrula(oncekiKokYolu, guncelKokYolu) {
  await kayitDefteriniDogrula(guncelKokYolu);

  const oncekiRegistry = await jsonOku(
    path.join(oncekiKokYolu, "registry.json"),
  );
  const guncelRegistry = await jsonOku(
    path.join(guncelKokYolu, "registry.json"),
  );
  const guncelOlaylar = new Map(
    guncelRegistry.events.map((olay) => [
      `${olay.name}:${olay.SchemaRevision}`,
      olay,
    ]),
  );

  for (const oncekiOlay of oncekiRegistry.events) {
    const anahtar = `${oncekiOlay.name}:${oncekiOlay.SchemaRevision}`;
    const guncelOlay = guncelOlaylar.get(anahtar);
    if (!guncelOlay) {
      throw new Error(
        `${oncekiOlay.name} SchemaRevision ${oncekiOlay.SchemaRevision} registry'den silinemez.`,
      );
    }

    const [oncekiSema, guncelSema] = await Promise.all([
      guvenliJsonOku(oncekiKokYolu, oncekiOlay.schema),
      guvenliJsonOku(guncelKokYolu, guncelOlay.schema),
    ]);
    if (canonicalJson(oncekiSema) !== canonicalJson(guncelSema)) {
      throw new Error(
        `${oncekiOlay.name} SchemaRevision ${oncekiOlay.SchemaRevision} altinda sema degistirilemez.`,
      );
    }
  }
}

const dogrudanCalistiriliyor =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (dogrudanCalistiriliyor) {
  const [
    ,
    ,
    oncekiKokYolu,
    guncelKokYolu = path.resolve(import.meta.dirname, ".."),
  ] = process.argv;
  if (!oncekiKokYolu) {
    console.error(
      "Kullanim: node scripts/uyumluluk-kontrolu.mjs <onceki-kok> [guncel-kok]",
    );
    process.exitCode = 1;
  } else {
    try {
      await uyumluluguDogrula(
        path.resolve(oncekiKokYolu),
        path.resolve(guncelKokYolu),
      );
      console.log("Olay sozlesmesi revision uyumlulugu dogrulandi.");
    } catch (hata) {
      console.error(hata.message);
      process.exitCode = 1;
    }
  }
}
