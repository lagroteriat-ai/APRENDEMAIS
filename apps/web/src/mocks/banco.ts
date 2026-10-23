import type { AnoEscolar, Escola, Papel, StatusConta } from '@aprendemais/shared-types';

/* "Banco" em memória da API simulada. Só dados FICTÍCIOS (e-mails em @example.test, RFC 2606).
   Não é regra de negócio do produto: imita o suficiente do servidor para exercitar as telas. */

export interface UsuarioMock {
  id: string;
  apelido: string | null;
  nome: string | null;
  /** E-mail do próprio usuário (≥ 18 e professor). */
  email: string | null;
  /** E-mail do responsável (menor). */
  emailResponsavel: string | null;
  nascimento: string | null;
  anoEscolar: AnoEscolar | null;
  senha: string;
  status: StatusConta;
  papeis: Papel[];
  escola: Escola | null;
  menor: boolean;
}

export type TipoToken = 'consentimento' | 'confirmacao-email' | 'recuperacao';

export interface TokenMock {
  valor: string;
  tipo: TipoToken;
  usuarioId: string;
  expiraEm: number;
  usado: boolean;
}

export interface EmailMock {
  id: string;
  tipo: 'E1' | 'E3' | 'E4';
  para: string;
  assunto: string;
  /** Caminho da SPA com `?t=` (o "link" do e-mail). */
  link: string;
  enviadoEm: string;
}

export interface RespostaGuardada {
  hash: string;
  status: number;
  corpo: unknown;
}

export interface BancoMock {
  usuarios: UsuarioMock[];
  tokens: TokenMock[];
  emails: EmailMock[];
  apelidos: Record<string, string>;
  idempotencia: Record<string, RespostaGuardada>;
  sessaoUsuarioId: string | null;
  sessaoPapel: Papel | null;
  falhasLogin: Record<string, number>;
  reenvioAte: Record<string, number>;
}

const CHAVE_STORAGE = 'aprendemais:mock-db';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const DIA_MS = 86_400_000;
export const INTERVALO_REENVIO_MS = 30_000;
export const AVISOS_VERSAO = {
  aluno: 'aluno-2026-10-v1',
  responsavel: 'responsavel-2026-10-v1',
  professor: 'professor-2026-10-v1',
} as const;
export const SENHAS_COMUNS = ['12345678', '123456789', 'senha123', 'password', 'qwertyui', '11111111', 'abcd1234'];

export function aleatorio(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function gerarUlid(): string {
  return Array.from(aleatorio(26), (b) => CROCKFORD[b % 32]).join('');
}

export function gerarToken(): string {
  const bytes = aleatorio(32);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function mascarar(email: string): string {
  const [local = '', dominio = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${dominio}`;
}

/** Contas de teste (todas fictícias). Senhas só valem no modo simulado. */
export const CONTAS_DE_TESTE = [
  { quem: 'Aluno (menor, 5º ano)', entrar: 'LeaoAzul42', senha: 'girafa-lunar-914' },
  { quem: 'Aluno 18+ (3ª série)', entrar: 'aguia.prata@example.test', senha: 'trilha-segura-2026' },
  { quem: 'Professor(a)', entrar: 'ana.professora@example.test', senha: 'professora-ana-2026' },
  { quem: 'Aluno + professor (escolhe papel)', entrar: 'duplo.exemplo@example.test', senha: 'duplo-exemplo-2026' },
  { quem: 'Gestor (área em breve)', entrar: 'gestora.exemplo@example.test', senha: 'gestora-exemplo-2026' },
  { quem: 'Conta em exclusão', entrar: 'NuvemCinza88', senha: 'nuvem-cinza-2026' },
] as const;

const ESCOLA: Escola = { id: '01JC8Z7R5G2H8J0K4M6N8P0Q2S', nome: 'Escola Municipal Exemplo' };

function sementes(): UsuarioMock[] {
  const base = { apelido: null, nome: null, email: null, emailResponsavel: null, nascimento: null, anoEscolar: null, escola: null, menor: false };
  return [
    { ...base, id: gerarUlid(), apelido: 'LeaoAzul42', nascimento: '2015-03', anoEscolar: 'EF5', emailResponsavel: 'responsavel.leao@example.test', senha: 'girafa-lunar-914', status: 'ativa', papeis: ['aluno'], menor: true },
    { ...base, id: gerarUlid(), apelido: 'AguiaPrata77', nascimento: '2008-01', anoEscolar: 'EM3', email: 'aguia.prata@example.test', senha: 'trilha-segura-2026', status: 'ativa', papeis: ['aluno'] },
    { ...base, id: gerarUlid(), nome: 'Ana Souza (exemplo)', email: 'ana.professora@example.test', escola: ESCOLA, senha: 'professora-ana-2026', status: 'ativa', papeis: ['professor'] },
    { ...base, id: gerarUlid(), apelido: 'CoralVerde15', nome: 'Beto Lima (exemplo)', nascimento: '2009-06', anoEscolar: 'EM1', email: 'duplo.exemplo@example.test', escola: ESCOLA, senha: 'duplo-exemplo-2026', status: 'ativa', papeis: ['aluno', 'professor'] },
    { ...base, id: gerarUlid(), nome: 'Gabi Rocha (exemplo)', email: 'gestora.exemplo@example.test', escola: ESCOLA, senha: 'gestora-exemplo-2026', status: 'ativa', papeis: ['gestor'] },
    { ...base, id: gerarUlid(), apelido: 'NuvemCinza88', nascimento: '2014-09', anoEscolar: 'EF6', emailResponsavel: 'responsavel.nuvem@example.test', senha: 'nuvem-cinza-2026', status: 'suspensa_exclusao', papeis: ['aluno'], menor: true },
  ];
}

export function bancoVazio(): BancoMock {
  return {
    usuarios: sementes(),
    tokens: [],
    emails: [],
    apelidos: {},
    idempotencia: {},
    sessaoUsuarioId: null,
    sessaoPapel: null,
    falhasLogin: {},
    reenvioAte: {},
  };
}

/* ---------- Estado único + assinantes (o PainelMock escuta) ---------- */
let banco: BancoMock = bancoVazio();
let persistir = false;
const ouvintes = new Set<() => void>();

export function db(): BancoMock {
  return banco;
}

/** Chame depois de alterar o banco: grava (se ligado) e avisa o painel. */
export function mudou(): void {
  if (persistir) {
    try {
      globalThis.sessionStorage.setItem(CHAVE_STORAGE, JSON.stringify(banco));
    } catch {
      /* armazenamento indisponível: segue só em memória */
    }
  }
  ouvintes.forEach((o) => o());
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function reiniciarBanco(): void {
  banco = bancoVazio();
  ouvintes.forEach((o) => o());
}

/** Liga a persistência na sessão da aba (para os links do "e-mail" sobreviverem à navegação completa). */
export function ativarPersistencia(): void {
  persistir = true;
  try {
    const salvo = globalThis.sessionStorage.getItem(CHAVE_STORAGE);
    if (salvo) banco = JSON.parse(salvo) as BancoMock;
  } catch {
    /* ignora: começa do zero */
  }
}
