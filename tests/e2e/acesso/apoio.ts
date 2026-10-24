import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { esperarSemViolacoesAxe, expect, type Api } from './base';
import { DIR_API, DIR_ESTADO } from './constantes';

// ---------- dados sintéticos (nunca dados reais: e-mails @example.test, estratégia §3) ----------

const sufixo = () => randomBytes(4).toString('hex');

export interface DadosAluno {
  /** Menor de 18: o e-mail é o do responsável (DC-04). Maior: o do próprio aluno. */
  menor: boolean;
  email: string;
  senha: string;
  mes: string;
  ano: string;
  anoEscolar: 'EF5' | 'EM3';
}

export function novoAluno(tipo: 'menor' | 'maior'): DadosAluno {
  const agora = new Date();
  const menor = tipo === 'menor';
  return {
    menor,
    email: `${menor ? 'responsavel' : 'aluno'}.${sufixo()}@example.test`,
    senha: `trilho-${sufixo()}-violeta`,
    mes: '05',
    ano: String(agora.getFullYear() - (menor ? 10 : 20)),
    anoEscolar: menor ? 'EF5' : 'EM3'
  };
}

export const novoEmail = (rotulo: string): string => `${rotulo}.${sufixo()}@example.test`;
/**
 * Apelido que não existe. Sempre novo: o limite de login por conta conta também contas inexistentes (SR-09), então
 * reaproveitar o mesmo nome entre testes ou execuções esgota as 3 tentativas e devolve 428.
 */
export const apelidoInexistente = (): string => `Fantasma${sufixo()}`;
/** Token com cara de token de link (43 caracteres base64url), mas que nunca foi emitido. */
export const tokenFalso = (): string => randomBytes(32).toString('base64url');

// ---------- caixa de saída de e-mail (dev/local) ----------

export interface Email {
  para: string;
  tipo: 'E1' | 'E2' | 'E3' | 'E4' | 'E6';
  link: string;
  assunto: string;
  texto: string;
}

export async function listarEmails(api: Api, para: string): Promise<Email[]> {
  const r = await api.get(`/dev/outbox?para=${encodeURIComponent(para)}`, { chave: false });
  expect(r.status, 'caixa de saída indisponível neste ambiente').toBe(200);
  return r.corpo.data as Email[];
}

/** Espera o e-mail (enviado depois da resposta, via waitUntil) e devolve o `n`-ésimo do tipo. */
export async function esperarEmail(api: Api, para: string, tipo: Email['tipo'], n = 1): Promise<Email> {
  let achados: Email[] = [];
  await expect
    .poll(async () => (achados = (await listarEmails(api, para)).filter((e) => e.tipo === tipo)).length, {
      message: `e-mail ${tipo} para ${para}`,
      timeout: 10_000
    })
    .toBeGreaterThanOrEqual(n);
  return achados[n - 1]!;
}

/** Garante que NENHUM e-mail do tipo chegou (espera um pouco, pois o envio roda depois da resposta). */
export async function esperarSemEmail(api: Api, para: string, tipo: Email['tipo']): Promise<void> {
  await new Promise((r) => setTimeout(r, 1500));
  expect((await listarEmails(api, para)).filter((e) => e.tipo === tipo)).toHaveLength(0);
}

/** Token do link: hoje em `?t=`; aceita também `#t=` (PEN-054 propõe mover para o fragmento). */
export const tokenDoLink = (e: Email): string => {
  const u = new URL(e.link);
  const t = u.searchParams.get('t') ?? new URLSearchParams(u.hash.slice(1)).get('t');
  if (!t) throw new Error(`link sem token: ${e.tipo}`);
  return t;
};
/** Caminho + query do link do e-mail (a base do e-mail é a do ambiente; o teste navega pelo `baseURL`). */
export const caminhoDoLink = (e: Email): string => {
  const u = new URL(e.link);
  return u.pathname + u.search + u.hash;
};

// ---------- telas ----------

export async function axe(page: Page, regrasDesligadas: string[] = []) {
  await esperarSemViolacoesAxe(page, { desativarRegras: regrasDesligadas });
}

/** Campo de senha pelo rótulo ("Senha" no login; "Senha (obrigatório)" quando é exigida, como no cadastro). */
export const campoSenha = (page: Page, rotulo = 'Senha'): Locator =>
  page.getByLabel(new RegExp(`^${rotulo}( \\(obrigatório\\))?$`));

/** T01 pelo navegador. Não espera destino: cada teste decide o que esperar. */
export async function entrar(page: Page, identificador: string, senha: string) {
  await page.goto('/entrar');
  await page.getByLabel('Usuário ou e-mail').fill(identificador);
  await campoSenha(page).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** T02–T04 pelo navegador. Devolve o apelido sorteado. Termina em T05 (`/cadastro/aguardando`). */
export async function cadastrarPelaTela(page: Page, d: DadosAluno, opcoes: { verificarAxe?: boolean } = {}): Promise<string> {
  await page.goto('/cadastro');
  await expect(page.getByRole('heading', { level: 1, name: 'Sobre você' })).toBeVisible();
  const apelido = await page.getByLabel('Seu apelido').inputValue();
  expect(apelido).toMatch(/^[A-Za-z]+\d{2,3}$/);
  await page.getByLabel('Mês').selectOption(d.mes);
  await page.getByLabel('Ano', { exact: true }).selectOption(d.ano);
  await page.getByLabel('Em que ano você estuda?').selectOption(d.anoEscolar);
  if (opcoes.verificarAxe) await axe(page);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: d.menor ? 'Seu responsável' : 'Seu e-mail' })).toBeVisible();
  await page.getByLabel(d.menor ? 'E-mail do responsável' : 'E-mail').fill(d.email);
  if (opcoes.verificarAxe) await axe(page);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Crie sua senha' })).toBeVisible();
  await campoSenha(page).fill(d.senha);
  await page.getByRole('checkbox', { name: /Li o aviso de privacidade/ }).check();
  if (opcoes.verificarAxe) await axe(page);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/cadastro\/aguardando$/);
  return apelido;
}

export async function sairPeloMenu(page: Page, rotuloDoMenu: string | RegExp) {
  await page.getByRole('button', { name: rotuloDoMenu }).click();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
}

// ---------- cadastro e consentimento pela API (preparo de cenário rápido) ----------

export const AVISO = {
  aluno: { versao: 'aluno-2026-10-v1' },
  responsavel: { versao: 'responsavel-2026-10-v1' },
  professor: { versao: 'professor-2026-10-v1' }
} as const;

export async function cadastrarAlunoPorApi(api: Api, d: DadosAluno): Promise<{ apelido: string; status: number; corpo: Record<string, any> }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = await api.get('/cadastro/apelido-sugerido');
  expect(s.status).toBe(200);
  const r = await api.post('/cadastro/aluno', {
    apelidoToken: s.corpo.data.apelidoToken,
    nascimento: `${d.ano}-${d.mes}`,
    anoEscolar: d.anoEscolar,
    email: d.email,
    senha: d.senha,
    aviso: AVISO.aluno
  });
  return { apelido: s.corpo.data.apelido as string, status: r.status, corpo: r.corpo };
}

export interface AlunoAtivo extends DadosAluno {
  apelido: string;
  /** Link de gestão (E2) do responsável. */
  tokenGestao: string;
}

/** Aluno menor com cadastro feito e autorizado pelo responsável: conta `ativa`, pronta para login. */
export async function criarAlunoMenorAtivo(api: Api, responsavel: Api): Promise<AlunoAtivo> {
  const d = novoAluno('menor');
  const { apelido, status } = await cadastrarAlunoPorApi(api, d);
  expect(status).toBe(201);
  const e1 = await esperarEmail(api, d.email, 'E1');
  const r = await responsavel.post('/consentimentos/concessao', {
    token: tokenDoLink(e1), nomeResponsavel: 'Responsável de Teste', declaracao: true, aviso: AVISO.responsavel
  });
  expect(r.status).toBe(200);
  const e2 = await esperarEmail(api, d.email, 'E2');
  return { ...d, apelido, tokenGestao: tokenDoLink(e2) };
}

/** Aluno ≥18 com e-mail confirmado: conta `ativa`. */
export async function criarAlunoMaiorAtivo(api: Api): Promise<DadosAluno & { apelido: string }> {
  const d = novoAluno('maior');
  const { apelido, status } = await cadastrarAlunoPorApi(api, d);
  expect(status).toBe(201);
  const e3 = await esperarEmail(api, d.email, 'E3');
  const r = await api.post('/email/confirmacao', { token: tokenDoLink(e3) });
  expect(r.status).toBe(200);
  return { ...d, apelido };
}

// ---------- banco e KV locais (só ambiente local: scripts/e2e-acesso.mjs) ----------
// O `wrangler dev` em execução enxerga o que um `d1 execute`/`kv key put` externo grava na mesma pasta de estado.

/** Roda o wrangler local. Os workers do Playwright escrevem no mesmo SQLite: repete se o arquivo estiver travado. */
function wrangler(args: string[]): string {
  const pasta = join(DIR_API, 'node_modules', 'wrangler');
  const { bin } = JSON.parse(readFileSync(join(pasta, 'package.json'), 'utf8')) as { bin: Record<string, string> };
  const comando = [join(pasta, bin.wrangler!), ...args, '--local', '--persist-to', DIR_ESTADO];
  for (let tentativa = 1; ; tentativa++) {
    try {
      return execFileSync(process.execPath, comando, { cwd: DIR_API, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (erro) {
      const saida = `${(erro as { stdout?: string }).stdout ?? ''}${(erro as { stderr?: string }).stderr ?? ''}`.trim();
      if (tentativa >= 5) throw new Error(`wrangler ${args.slice(0, 3).join(' ')} falhou após ${tentativa} tentativas:\n${saida}`, { cause: erro });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400 * tentativa);
    }
  }
}

export function sqlLocal(comando: string): Record<string, unknown>[] {
  const saida = wrangler(['d1', 'execute', 'DB', '--json', '--command', comando]);
  const lotes = JSON.parse(saida.slice(saida.indexOf('['))) as { results: Record<string, unknown>[] }[];
  return lotes[0]?.results ?? [];
}

const PASSADO = '2020-01-01T00:00:00.000Z';
const aspas = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Faz vencer (prazo no passado) os links ainda abertos de uma conta, achada pelo apelido ou pelo e-mail. */
export function vencerLinksDe(identificador: string, tipo?: string) {
  const dono = identificador.includes('@') ? `email = ${aspas(identificador)}` : `apelido = ${aspas(identificador)}`;
  sqlLocal(
    `UPDATE tokens_acao SET expira_em = ${aspas(PASSADO)} WHERE consumido_em IS NULL${tipo ? ` AND tipo = ${aspas(tipo)}` : ''} ` +
    `AND usuario_id IN (SELECT id FROM usuarios WHERE ${dono})`
  );
}

/** Faz a sessão (valor do cookie) passar do limite absoluto no KV, como se o prazo (SR-07) tivesse acabado. */
export function vencerSessao(valorDoCookie: string) {
  const chave = `sess:${createHash('sha256').update(valorDoCookie).digest('hex')}`;
  const saida = wrangler(['kv', 'key', 'get', chave, '--binding', 'KV', '--text']);
  const atual = JSON.parse(saida.slice(saida.indexOf('{'))) as Record<string, unknown>;
  atual.abs = Date.now() - 1000;
  wrangler(['kv', 'key', 'put', chave, JSON.stringify(atual), '--binding', 'KV', '--ttl', '3600']);
}
