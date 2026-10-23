// Gera dist-legacy/ com SOMENTE os arquivos públicos da landing (PEN-016).
// Lista explícita (allowlist): docs/, apps/, functions/, *.sql e *.md nunca são publicados.
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'dist-legacy');
const publicos = [
  'index.html',
  'style.css',
  'script.js',
  'admin.html',
  'admin.css',
  'admin.js',
  'assets',
];

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

for (const item of publicos) {
  const origem = join(raiz, 'public', item);
  try {
    await access(origem);
  } catch {
    throw new Error(`build-legacy: arquivo público ausente: ${item}`);
  }
  await cp(origem, join(destino, item), { recursive: true });
}

// Sitekey do Turnstile (pública) vem do ambiente, nunca do repositório (PEN-004).
// Sem TURNSTILE_SITEKEY usa a chave de teste da Cloudflare (sempre passa no widget, mas o
// servidor com segredo real recusa o token → cadastro bloqueia). Defina-a antes de publicar.
const CHAVE_TESTE = '1x00000000000000000000AA';
const sitekey = process.env.TURNSTILE_SITEKEY || CHAVE_TESTE;
if (!process.env.TURNSTILE_SITEKEY) {
  console.warn('build-legacy: TURNSTILE_SITEKEY ausente; usando a chave de teste (não publique assim).');
}
const indexDestino = join(destino, 'index.html');
const html = await readFile(indexDestino, 'utf8');
if (!html.includes('COLOQUE_TURNSTILE_SITEKEY')) {
  throw new Error('build-legacy: placeholder COLOQUE_TURNSTILE_SITEKEY não encontrado em index.html');
}
await writeFile(indexDestino, html.replaceAll('COLOQUE_TURNSTILE_SITEKEY', sitekey));

console.log(`dist-legacy/ pronto (${publicos.length} itens).`);
