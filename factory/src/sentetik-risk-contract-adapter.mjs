const AZAMI_CIKTI_BYTE = 4096;
const ALANLAR = Object.freeze([
  "riskSeviyesi", "nedenKodlari", "codexOnIncelemeGerekliMi", "insanKapisiGerekliMi",
]);

// Bu saf prototip surec baslatmaz; gozlemin kaynagini veya container kapanisini kanitlamaz.
export function sentetikRiskCiktisiniDogrula(gozlem, beklenen) {
  if (!gozlem || !Buffer.isBuffer(gozlem.stdout) || !Buffer.isBuffer(gozlem.stderr)
    || gozlem.stdout.length > AZAMI_CIKTI_BYTE || gozlem.stderr.length !== 0
    || gozlem.exitKodu !== 0 || gozlem.sinyal !== null
    || gozlem.zamanAsimi !== false || gozlem.kapandiMi !== true) {
    return engel("SUREC_VEYA_BOYUT_GECERSIZ");
  }

  let cikti;
  try {
    if (gozlem.stdout.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
      return engel("CIKTI_BICIMI_GECERSIZ");
    }
    const metin = new TextDecoder("utf-8", { fatal: true }).decode(gozlem.stdout);
    if (!metin.endsWith("\n") || metin.includes("\r") || metin.startsWith("\ufeff")) {
      return engel("CIKTI_BICIMI_GECERSIZ");
    }
    const json = metin.slice(0, -1);
    if (json.includes("\n") || !json.startsWith("{") || !json.endsWith("}")) {
      return engel("CIKTI_BICIMI_GECERSIZ");
    }
    cikti = JSON.parse(json);
    if (!anahtarlarTekilMi(json)) return engel("JSON_ANAHTARI_TEKRARLI");
  } catch {
    return engel("CIKTI_BICIMI_GECERSIZ");
  }

  if (!sonucEsitMi(cikti, beklenen)) return engel("SONUC_UYUSMAZLIGI");
  return { sonuc: "DENEY_ESLESTI", nedenKodu: null };
}

function sonucEsitMi(cikti, beklenen) {
  return [cikti, beklenen].every((sonuc) => sonuc !== null && typeof sonuc === "object"
      && !Array.isArray(sonuc) && Object.keys(sonuc).length === ALANLAR.length
      && ALANLAR.every((alan) => Object.hasOwn(sonuc, alan)))
    && typeof cikti.riskSeviyesi === "string"
    && cikti.riskSeviyesi === beklenen.riskSeviyesi
    && Array.isArray(cikti.nedenKodlari) && Array.isArray(beklenen.nedenKodlari)
    && cikti.nedenKodlari.length === beklenen.nedenKodlari.length
    && cikti.nedenKodlari.every((neden, index) => typeof neden === "string"
      && neden === beklenen.nedenKodlari[index])
    && typeof cikti.codexOnIncelemeGerekliMi === "boolean"
    && cikti.codexOnIncelemeGerekliMi === beklenen.codexOnIncelemeGerekliMi
    && typeof cikti.insanKapisiGerekliMi === "boolean"
    && cikti.insanKapisiGerekliMi === beklenen.insanKapisiGerekliMi;
}

function anahtarlarTekilMi(json) {
  let konum = 0;
  const boslukGec = () => { while (/\s/.test(json[konum] ?? "" ) && konum < json.length) konum++; };
  const stringGec = () => {
    const baslangic = konum++;
    while (konum < json.length) {
      if (json[konum] === "\\") konum += 2;
      else if (json[konum++] === '"') return JSON.parse(json.slice(baslangic, konum));
    }
    throw new Error("Eksik string");
  };
  const degerGec = () => {
    boslukGec();
    if (json[konum] === '"') { stringGec(); return true; }
    if (json[konum] === "{") {
      konum++;
      const anahtarlar = new Set();
      boslukGec();
      while (json[konum] !== "}") {
        const anahtar = stringGec();
        if (anahtarlar.has(anahtar)) return false;
        anahtarlar.add(anahtar);
        boslukGec();
        konum++;
        if (!degerGec()) return false;
        boslukGec();
        if (json[konum] !== ",") break;
        konum++;
        boslukGec();
      }
      konum++;
      return true;
    }
    if (json[konum] === "[") {
      konum++;
      boslukGec();
      while (json[konum] !== "]") {
        if (!degerGec()) return false;
        boslukGec();
        if (json[konum] !== ",") break;
        konum++;
      }
      konum++;
      return true;
    }
    while (konum < json.length && !/[\s,}\]]/.test(json[konum])) konum++;
    return true;
  };
  return degerGec();
}

function engel(nedenKodu) {
  return { sonuc: "BLOCKED", nedenKodu };
}
