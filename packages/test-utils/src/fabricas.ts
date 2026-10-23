import type { AnoEscolar, CadastroAlunoRequest, LoginRequest, Papel, StatusConta } from '@aprendemais/shared-types';
import { INSTANTE_FIXO, proximo, ulidFixo } from './sequencia';

// Todos os dados são FICTÍCIOS (docs/qa/estrategia.md §3): nomes inventados, e-mails em
// `@example.test` (domínio reservado, RFC 2606) e telefones em faixa 0000 que não existe.
// Cada fábrica aceita `sobrescrever` e devolve um objeto novo (sem estado compartilhado).

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fabio', 'Gabi', 'Heitor'];
const SOBRENOMES = ['Teste', 'Exemplo', 'Ficticio', 'Amostra'];

/** Nascimento (AAAA-MM, RQ-02) de quem é menor/maior de idade em INSTANTE_FIXO (2026-10). */
export const NASCIMENTO_MENOR = '2014-05';
export const NASCIMENTO_MAIOR = '2000-03';

export const SENHA_TESTE = 'Senha-de-Teste-123';

export function emailFicticio(prefixo: string, n = proximo(`email:${prefixo}`)): string {
  return `${prefixo}${n}@example.test`;
}

export function telefoneFicticio(n = proximo('telefone')): string {
  return `819000${String(n % 10000).padStart(4, '0')}`;
}

export interface Escola {
  id: string;
  nome: string;
}
export function fabricarEscola(sobrescrever: Partial<Escola> = {}): Escola {
  const n = proximo('escola');
  return { id: ulidFixo(1000 + n), nome: `Escola Fictícia ${n}`, ...sobrescrever };
}

export interface Turma {
  id: string;
  escolaId: string;
  nome: string;
  anoEscolar: AnoEscolar;
}
export function fabricarTurma(sobrescrever: Partial<Turma> = {}): Turma {
  const n = proximo('turma');
  return { id: ulidFixo(2000 + n), escolaId: ulidFixo(1001), nome: `Turma ${n}A`, anoEscolar: 'EF5', ...sobrescrever };
}

export interface Usuario {
  id: string;
  papel: Papel;
  status: StatusConta;
  /** Aluno não tem nome nem e-mail próprio (menor): só apelido (RQ-02). */
  apelido?: string;
  nome?: string;
  email?: string;
  nascimento?: string;
  anoEscolar?: AnoEscolar;
  criadoEm: string;
}

export function fabricarAluno(sobrescrever: Partial<Usuario> = {}): Usuario {
  const n = proximo('aluno');
  return {
    id: ulidFixo(3000 + n),
    papel: 'aluno',
    status: 'ativa',
    apelido: `${NOMES[n % NOMES.length]}${String(10 + (n % 90))}`,
    nascimento: NASCIMENTO_MENOR,
    anoEscolar: 'EF5',
    criadoEm: INSTANTE_FIXO,
    ...sobrescrever
  };
}

export const fabricarAlunoMenor = (s: Partial<Usuario> = {}) => fabricarAluno({ nascimento: NASCIMENTO_MENOR, ...s });
export const fabricarAlunoMaior = (s: Partial<Usuario> = {}) =>
  fabricarAluno({ nascimento: NASCIMENTO_MAIOR, anoEscolar: 'EM3', email: emailFicticio('aluno.maior'), ...s });

export function fabricarResponsavel(sobrescrever: Partial<Usuario> = {}): Usuario {
  const n = proximo('responsavel');
  return {
    id: ulidFixo(4000 + n),
    papel: 'responsavel',
    status: 'ativa',
    nome: `${NOMES[n % NOMES.length]} ${SOBRENOMES[n % SOBRENOMES.length]}`,
    email: emailFicticio('responsavel'),
    criadoEm: INSTANTE_FIXO,
    ...sobrescrever
  };
}

export function fabricarProfessor(sobrescrever: Partial<Usuario> = {}): Usuario {
  const n = proximo('professor');
  return {
    id: ulidFixo(5000 + n),
    papel: 'professor',
    status: 'ativa',
    nome: `Prof. ${NOMES[n % NOMES.length]} ${SOBRENOMES[n % SOBRENOMES.length]}`,
    email: emailFicticio('professor'),
    criadoEm: INSTANTE_FIXO,
    ...sobrescrever
  };
}

/** Corpo válido de `POST` de cadastro de aluno (contrato: shared-types). */
export function fabricarCadastroAluno(sobrescrever: Partial<CadastroAlunoRequest> = {}): CadastroAlunoRequest {
  return {
    apelidoToken: 'token-de-apelido-ficticio-0123456789abcdef',
    nascimento: NASCIMENTO_MENOR,
    anoEscolar: 'EF5',
    email: emailFicticio('responsavel'),
    senha: SENHA_TESTE,
    aviso: { versao: '2026-10-22' },
    ...sobrescrever
  };
}

export function fabricarLogin(sobrescrever: Partial<LoginRequest> = {}): LoginRequest {
  return { identificador: 'Ana10', senha: SENHA_TESTE, ...sobrescrever };
}

/** Corpo de `POST /api/leads` da landing legada. */
export interface LeadLegado {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  perfil: string;
  consentimento: boolean;
  turnstileToken: string;
}
export function fabricarLead(sobrescrever: Partial<LeadLegado> = {}): LeadLegado {
  const n = proximo('lead');
  return {
    nome: NOMES[n % NOMES.length] as string,
    sobrenome: SOBRENOMES[n % SOBRENOMES.length] as string,
    email: emailFicticio('lead'),
    telefone: telefoneFicticio(),
    perfil: 'Estudante',
    consentimento: true,
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    ...sobrescrever
  };
}
