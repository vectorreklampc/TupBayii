import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDizini = dirname(fileURLToPath(import.meta.url));
const depoKoku = join(scriptDizini, '..', '..');
const flutterKoku = join(depoKoku, 'flutter');
const paketDizini = join(flutterKoku, 'packages', 'tup_api');
const uretilenDizin = join(paketDizini, 'lib', 'src', 'generated');
const kutuphaneDosyasi = join(paketDizini, 'lib', 'tup_api.dart');
const generatorMetadataDizini = join(paketDizini, '.openapi-generator');
const generatorImage = 'openapitools/openapi-generator-cli@sha256:868b97eb4e5080d2cdfd5b3eeaa4d52e4bbb7c56f14e234b08b0b0bc4f38a78f';

function calistir(komut, argumanlar, calismaDizini) {
  const sonuc = spawnSync(komut, argumanlar, { cwd: calismaDizini, stdio: 'inherit', shell: false });
  if (sonuc.error) throw sonuc.error;
  if (sonuc.status !== 0) throw new Error(`${komut} ${sonuc.status} koduyla sonlandi`);
}

function dartCalistir(argumanlar, calismaDizini) {
  if (process.platform === 'win32') {
    calistir(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'dart', ...argumanlar], calismaDizini);
    return;
  }
  calistir('dart', argumanlar, calismaDizini);
}

await rm(uretilenDizin, { recursive: true, force: true });
await rm(kutuphaneDosyasi, { force: true });
await rm(generatorMetadataDizini, { recursive: true, force: true });

const dockerArgumanlari = [
  'run', '--rm',
  '-v', `${depoKoku}:/local`,
  generatorImage,
  'generate', '-c', '/local/contracts/openapi-generator-flutter.yaml'
];
if (process.platform !== 'win32' && process.getuid) {
  dockerArgumanlari.splice(2, 0, '--user', `${process.getuid()}:${process.getgid()}`);
}

calistir('docker', dockerArgumanlari, depoKoku);
await rm(generatorMetadataDizini, { recursive: true, force: true });
dartCalistir(['pub', 'get'], flutterKoku);
dartCalistir(['run', 'build_runner', 'build'], paketDizini);
dartCalistir(['format', 'lib'], paketDizini);
