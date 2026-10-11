import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const markdownBasligi = /^#{1,6}\s+(.+?)\s*$/gm;
const gerekliBolumler = new Set(['api breaking change etkisi', 'gecis plani']);
const yerTutucu = /^(?:[-*+]\s*)?(?:tbd|todo|daha sonra|yok|n\/?a|none|[-_\s]*)$/i;
const yonlendiriciMetin = /^breaking openapi değişikliği yoksa `n\/?a`;\s*varsa .+ yazın\.?$/i;

function bolumleriOku(govde) {
  const eslesmeler = [...govde.matchAll(markdownBasligi)];
  const bolumler = new Map();
  for (const [sira, eslesme] of eslesmeler.entries()) {
    const ad = eslesme[1].toLowerCase();
    if (!gerekliBolumler.has(ad)) continue;
    const baslangic = eslesme.index + eslesme[0].length;
    const bitis = eslesmeler[sira + 1]?.index ?? govde.length;
    bolumler.set(ad, govde.slice(baslangic, bitis).replace(/<!--.*?-->/gs, '').trim());
  }
  return bolumler;
}

function gecerliBolumMu(deger) {
  return typeof deger === 'string' && deger.length > 0 &&
    !yerTutucu.test(deger) && !yonlendiriciMetin.test(deger);
}

function zaman(review) {
  const deger = Date.parse(review.submitted_at ?? '');
  return Number.isNaN(deger) ? 0 : deger;
}

function sonReviewKararlari(reviews) {
  const kararlar = new Map();
  for (const review of reviews) {
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    const kullanici = review.user.login.toLocaleLowerCase('en-US');
    const onceki = kararlar.get(kullanici);
    if (!onceki || zaman(review) >= zaman(onceki)) kararlar.set(kullanici, review);
  }
  return [...kararlar.values()];
}

export function onayDogrula({ body, author, sha, reviews }) {
  if (typeof author !== 'string' || !author || typeof sha !== 'string' || !sha || !Array.isArray(reviews)) {
    throw new Error('Pull request yazari, head SHA ve review listesi gereklidir.');
  }
  const bolumler = bolumleriOku(body ?? '');
  if (!gecerliBolumMu(bolumler.get('api breaking change etkisi')) ||
      !gecerliBolumMu(bolumler.get('gecis plani'))) {
    throw new Error('API breaking change etki ve gecis plani dolu olmalidir.');
  }

  const yazar = author?.toLocaleLowerCase('en-US');
  const guncelReviewler = (reviews ?? []).filter((review) =>
    review?.commit_id === sha && review?.user?.login?.toLocaleLowerCase('en-US') !== yazar);
  const sonKararlar = sonReviewKararlari(guncelReviewler);
  const gecerliOnay = sonKararlar.some((review) => review.state === 'APPROVED') &&
    !sonKararlar.some((review) => review.state === 'CHANGES_REQUESTED');

  if (!gecerliOnay) {
    throw new Error('Mevcut head SHA icin yazardan farkli ve gecerli bir onay gereklidir.');
  }
  return true;
}

async function komutSatiriCalistir() {
  const [reviewYolu] = process.argv.slice(2);
  const olayYolu = process.env.GITHUB_EVENT_PATH;
  if (!reviewYolu || !olayYolu) {
    throw new Error('Review dosyasi ve GITHUB_EVENT_PATH gereklidir.');
  }

  const [olay, reviews] = await Promise.all([
    readFile(olayYolu, 'utf8').then(JSON.parse),
    readFile(reviewYolu, 'utf8').then(JSON.parse)
  ]);
  const pr = olay.pull_request;
  if (!pr) throw new Error('Breaking change onayi yalniz pull_request olayinda dogrulanabilir.');

  onayDogrula({
    body: pr.body,
    author: pr.user?.login,
    sha: pr.head?.sha,
    reviews
  });
  console.log('Breaking OpenAPI degisikligi icin etki, gecis plani ve guncel onay PASS');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await komutSatiriCalistir();
}
