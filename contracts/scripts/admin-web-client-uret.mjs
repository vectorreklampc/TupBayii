import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDizini = dirname(fileURLToPath(import.meta.url));
const depoKoku = join(scriptDizini, '..', '..');
const uretilenDizin = join(depoKoku, 'admin-web', 'src', 'api', 'uretilen');
const generatorImage = 'openapitools/openapi-generator-cli@sha256:868b97eb4e5080d2cdfd5b3eeaa4d52e4bbb7c56f14e234b08b0b0bc4f38a78f';

function calistir(komut, argumanlar, calismaDizini = depoKoku) {
  const sonuc = spawnSync(komut, argumanlar, {
    cwd: calismaDizini,
    stdio: 'inherit',
    shell: false,
  });
  if (sonuc.error) throw sonuc.error;
  if (sonuc.status !== 0) throw new Error(`${komut} ${sonuc.status} koduyla sonlandi`);
}

function prettierCalistir() {
  const adminWebKoku = join(depoKoku, 'admin-web');
  const prettier = join(adminWebKoku, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  calistir(process.execPath, [prettier, '--write', 'src/api/uretilen'], adminWebKoku);
}

await rm(uretilenDizin, { recursive: true, force: true });

const dockerArgumanlari = [
  'run',
  '--rm',
  '-v',
  `${depoKoku}:/local`,
  generatorImage,
  'generate',
  '-c',
  '/local/contracts/openapi-generator-admin-web.yaml',
];
if (process.platform !== 'win32' && process.getuid) {
  dockerArgumanlari.splice(2, 0, '--user', `${process.getuid()}:${process.getgid()}`);
}

calistir('docker', dockerArgumanlari);
await rm(join(uretilenDizin, '.openapi-generator'), { recursive: true, force: true });
prettierCalistir();
