// TBP-233 invariant kapisi komut satiri.
//
//   node src/invariant-kapisi-cli.mjs kayit-defteri
//   node src/invariant-kapisi-cli.mjs is-kalemi <girdi.json>
//
// Kanonik kaynaklar import.meta.url'den cozulur; komut her calisma dizininden
// ayni dosyalari dogrular. Cikis kodu: 0 ACCEPTED, 1 BLOCKED, 2 kullanim hatasi.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { jsonDosyasiniOku, kanonikKaynaklariOku, uygunluguDogrula } from "./invariant-kapisi.mjs";
import { kabulTestPlaniOlustur, kaliteKapisiniDegerlendir } from "./kabul-testi-catisi.mjs";

export const CIKIS_KODLARI = Object.freeze({ ACCEPTED: 0, BLOCKED: 1, KULLANIM: 2 });
const KULLANIM = "Kullanim: invariant-kapisi-cli.mjs kayit-defteri | is-kalemi <girdi.json>";

export function cliCalistir(argumanlar, { bugun = utcBugun(), calismaDizini = process.cwd() } = {}) {
  const [mod, ...kalan] = argumanlar;
  if (mod === "kayit-defteri" && kalan.length === 0) {
    return sonuc({ mod, ...uygunluguDogrula(kanonikKaynaklariOku(), bugun) });
  }
  if (mod === "is-kalemi" && kalan.length === 1) {
    return sonuc({ mod, ...isKaleminiDegerlendir(jsonDosyasiniOku(resolve(calismaDizini, kalan[0]))) });
  }
  return { cikisKodu: CIKIS_KODLARI.KULLANIM, cikti: { mod: mod ?? null, hata: KULLANIM } };
}

// Is kalemi girdisindeki plan istemciye birakilmaz; kabul kriterlerinden
// yeniden derlenir ve tamamlama kapisi ilgili invariant kanitini zorunlu tutar.
function isKaleminiDegerlendir(girdi) {
  const alan = (ad) => (girdi !== null && typeof girdi === "object" && Object.hasOwn(girdi, ad)
    ? girdi[ad]
    : undefined);
  const plan = kabulTestPlaniOlustur({
    testOracle: alan("testOracle"),
    kabulKriterleri: alan("kabulKriterleri"),
  });
  if (plan.sonuc !== "HAZIR") return { ...plan, tamamlanabilirMi: false };
  return kaliteKapisiniDegerlendir({
    plan,
    testSonuclari: alan("testSonuclari"),
    isKimligi: alan("isKimligi"),
    calistirmaKimligi: alan("calistirmaKimligi"),
    invariantKanitlari: alan("invariantKanitlari"),
  });
}

function sonuc(cikti) {
  return {
    cikisKodu: cikti.sonuc === "ACCEPTED" ? CIKIS_KODLARI.ACCEPTED : CIKIS_KODLARI.BLOCKED,
    cikti,
  };
}

function utcBugun() {
  return new Date().toISOString().slice(0, 10);
}

function dogrudanCalistirildiMi() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (dogrudanCalistirildiMi()) {
  const { cikisKodu, cikti } = cliCalistir(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(cikti, null, 2)}\n`);
  process.exitCode = cikisKodu;
}
