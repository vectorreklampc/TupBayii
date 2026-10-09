import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Yalniz bu modulun sabit, sentetik kodu calisir; repository script'i calismaz.
const KOMUTLAR = Object.freeze({
  BASARILI: Object.freeze({ kod: "process.exit(0)", sureMs: 3000 }),
  SAHTE_PASS: Object.freeze({ kod: "console.log('PASS'); process.exit(7)", sureMs: 3000 }),
  ZAMAN_ASIMI: Object.freeze({ kod: "setInterval(() => {}, 1000)", sureMs: 300 }),
  ORTAM_BOS: Object.freeze({ kod: "process.exit(process.env.TBP36_SENTETIK_SIR === undefined ? 0 : 8)", sureMs: 3000 }),
});

export async function sentetikKomutuCalistir(komutKimligi) {
  if (typeof komutKimligi !== "string" || !Object.hasOwn(KOMUTLAR, komutKimligi)) {
    return karar(null, null, "KOMUT_BILINMIYOR");
  }

  const komut = KOMUTLAR[komutKimligi];
  return new Promise((resolve) => {
    let zamanAsimi = false;
    let tamamlandi = false;
    let sureSiniri;
    let kapanisSiniri;
    let altSurec;

    const bitir = (exitKodu, nedenKodu) => {
      if (tamamlandi) return;
      tamamlandi = true;
      clearTimeout(sureSiniri);
      clearTimeout(kapanisSiniri);
      resolve(karar(komutKimligi, exitKodu, nedenKodu));
    };

    try {
      altSurec = spawn(process.execPath, ["--input-type=module", "--eval", komut.kod], {
        cwd: dirname(fileURLToPath(import.meta.url)),
        env: {},
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      bitir(null, "SUREC_BASLATILAMADI");
      return;
    }

    altSurec.once("error", () => bitir(null, "SUREC_BASLATILAMADI"));
    altSurec.once("close", (exitKodu, sinyal) => {
      bitir(exitKodu, zamanAsimi ? "ZAMAN_ASIMI"
        : sinyal || exitKodu !== 0 ? "KOMUT_BASARISIZ" : null);
    });
    sureSiniri = setTimeout(() => {
      zamanAsimi = true;
      try {
        if (!altSurec.kill()) {
          bitir(null, "SUREC_SONLANDIRILAMADI");
          return;
        }
      } catch {
        bitir(null, "SUREC_SONLANDIRILAMADI");
        return;
      }
      kapanisSiniri = setTimeout(() => bitir(null, "SUREC_SONLANDIRILAMADI"), 500);
    }, komut.sureMs);
  });
}

function karar(komutKimligi, exitKodu, nedenKodu) {
  return {
    komutKimligi,
    sonuc: nedenKodu === null ? "DENEY_PASS" : "BLOCKED",
    exitKodu,
    nedenKodu,
  };
}
