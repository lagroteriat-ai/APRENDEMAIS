// SR-21 / PEN-026: o que vai para o Worker (dist-legacy/, apps/web/dist/) não pode conter
// docs, planejamento, SQL, configs ou segredos. Falha o build se encontrar algo assim.
import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastas = ['dist-legacy', 'apps/web/dist'];
const proibidoNome = /(^|\/)(wrangler\.toml|package\.json|pnpm-lock\.yaml|\.dev\.vars.*|\.env.*|[^/]+\.(md|sql|toml|vars))$/i;
const proibidoPasta = /(^|\/)(docs|functions|apps|packages|db|data|sprints|migrations|scripts|node_modules|\.git)(\/|$)/i;

async function listar(pasta) {
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true });
  return itens.filter((i) => i.isFile()).map((i) => relative(pasta, join(i.parentPath, i.name)).replaceAll('\\', '/'));
}

let violacoes = 0;
for (const pasta of pastas) {
  let arquivos;
  try {
    arquivos = await listar(join(raiz, pasta));
  } catch {
    console.error(`verificar-dist: ${pasta}/ não existe — rode o build antes.`);
    process.exit(2);
  }
  for (const arquivo of arquivos) {
    if (proibidoNome.test(arquivo) || proibidoPasta.test(arquivo)) {
      console.error(`verificar-dist: ${pasta}/${arquivo} não pode ser publicado.`);
      violacoes++;
    }
  }
}

if (violacoes) process.exit(1);
console.log(`verificar-dist: ok (${pastas.join(', ')}).`);
