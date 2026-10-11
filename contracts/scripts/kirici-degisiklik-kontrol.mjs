import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { runOasdiffBreaking, runOasdiffBreakingFromSpecs } from '@oasdiff-js/oasdiff-js';

function sonucDogrula(sonuc) {
  if (sonuc.exitCode === 0) {
    return { kirici: false, rapor: sonuc.stdout.trim() };
  }
  if (sonuc.exitCode === 1 && sonuc.changes.length > 0) {
    return { kirici: true, rapor: sonuc.stdout.trim() };
  }

  const ayrinti = sonuc.stderr.trim() || sonuc.stdout.trim() || `exit code ${sonuc.exitCode}`;
  throw new Error(`OpenAPI compatibility araci calismadi: ${ayrinti}`);
}

export async function kiriciDegisiklikKontrol(onceki, yeni) {
  const secenekler = { format: 'json', failOn: 'WARN', allowExternalRefs: false };
  const sonuc = typeof onceki === 'string' && typeof yeni === 'string'
    ? await runOasdiffBreaking(onceki, yeni, secenekler)
    : await runOasdiffBreakingFromSpecs(onceki, yeni, secenekler);

  return sonucDogrula(sonuc);
}

async function komutSatiriCalistir() {
  const [oncekiYol, yeniYol] = process.argv.slice(2);
  if (!oncekiYol || !yeniYol) {
    throw new Error('Kullanim: node kirici-degisiklik-kontrol.mjs <onceki-openapi> <yeni-openapi>');
  }

  const sonuc = await kiriciDegisiklikKontrol(oncekiYol, yeniYol);
  if (sonuc.rapor) console.log(sonuc.rapor);
  else console.log('Breaking OpenAPI degisikligi bulunmadi.');

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `kirici=${sonuc.kirici}\n`, 'utf8');
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await komutSatiriCalistir();
}
