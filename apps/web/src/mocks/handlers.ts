import { http, HttpResponse, type HttpHandler } from 'msw';
import {
  OPERACOES_AUTH,
  STATUS_HTTP_POR_CODIGO,
  type CampoErro,
  type CodigoCampo,
  type CodigoErro,
  type Me,
  type Pendencia,
} from '@aprendemais/shared-types';
import {
  AVISOS_VERSAO,
  DIA_MS,
  INTERVALO_REENVIO_MS,
  SENHAS_COMUNS,
  db,
  gerarToken,
  gerarUlid,
  mascarar,
  mudou,
  type TipoToken,
  type TokenMock,
  type UsuarioMock,
} from './banco';

/* Handlers MSW da API v1 (auth.yaml). Cada resposta de sucesso é conferida contra o schema do contrato
   (`OPERACOES_AUTH[op].resposta`): se o mock divergir do contrato, a chamada falha na hora e o teste acusa. */

type Op = keyof typeof OPERACOES_AUTH;
export const TOKEN_DESAFIO = 'mock-turnstile-token';
const BASE = '*/api/v1';
const MENSAGEM: Record<CodigoErro, string> = {
  VALIDATION_ERROR: 'Há campos para corrigir.',
  TOKEN_INVALIDO: 'Este link não funciona. Ele pode ter expirado ou já ter sido usado.',
  UNAUTHENTICATED: 'Sua sessão acabou. Entre de novo.',
  FORBIDDEN: 'Você não tem acesso a esta página.',
  NOT_FOUND: 'Você não tem acesso a esta página.',
  CONFLICT: 'Já existe um cadastro com estes dados.',
  IDEMPOTENCY_CONFLICT: 'Esta tentativa já foi usada com outros dados.',
  DESAFIO_REQUERIDO: 'Confirme que você não é um robô para continuar.',
  RATE_LIMITED: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  INTERNAL: 'Algo deu errado. Tente de novo.',
};

/* ---------- Respostas ---------- */
function cabecalhos(extra: Record<string, string> = {}) {
  return { 'X-Request-Id': gerarUlid(), 'Cache-Control': 'no-store', ...extra };
}

function sucesso(op: Op, data: unknown, status: number = OPERACOES_AUTH[op].sucesso) {
  const corpo = { ok: true, data };
  const conferido = OPERACOES_AUTH[op].resposta.safeParse(corpo);
  if (!conferido.success) {
    console.error(`[mock] resposta de ${op} fora do contrato`, conferido.error.issues);
    return erro('INTERNAL');
  }
  return HttpResponse.json(corpo, { status, headers: cabecalhos() });
}

function erro(code: CodigoErro, details?: CampoErro[], extra?: Record<string, string>) {
  return HttpResponse.json(
    { ok: false, error: { code, message: MENSAGEM[code], ...(details ? { details } : {}) } },
    { status: STATUS_HTTP_POR_CODIGO[code], headers: cabecalhos(extra) },
  );
}

const limite = () => erro('RATE_LIMITED', undefined, { 'Retry-After': '60' });

/* ---------- Entrada ---------- */
const CODIGO_POR_CAMPO: Record<string, CodigoCampo> = {
  email: 'EMAIL_INVALIDO',
  nascimento: 'NASCIMENTO_INVALIDO',
  anoEscolar: 'ANO_ESCOLAR_INVALIDO',
  apelidoToken: 'APELIDO_INVALIDO',
  nomeResponsavel: 'NOME_INVALIDO',
  declaracao: 'DECLARACAO_OBRIGATORIA',
};

function detalhes(issues: ReadonlyArray<{ path: PropertyKey[]; code: string; input?: unknown }>): CampoErro[] {
  return issues.map((i) => {
    const path = i.path.map(String).join('.');
    const campo = path.split('.')[0] ?? '';
    let code: CodigoCampo = CODIGO_POR_CAMPO[campo] ?? 'FORMATO_INVALIDO';
    if (i.input === undefined) code = 'OBRIGATORIO';
    else if (i.code === 'too_small' && /senha/i.test(campo)) code = 'SENHA_CURTA';
    else if (i.code === 'too_big' && /senha/i.test(campo)) code = 'SENHA_LONGA';
    return { path, code };
  });
}

type Lido<T> = { corpo: T } | { resposta: Response };

async function lerCorpo<T = unknown>(op: Op, request: Request): Promise<Lido<T>> {
  const schema = (OPERACOES_AUTH[op] as { corpo?: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: { issues: never[] } } } }).corpo;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { resposta: erro('VALIDATION_ERROR') };
  }
  if (!schema) return { corpo: json as T };
  const r = schema.safeParse(json);
  if (!r.success) return { resposta: erro('VALIDATION_ERROR', detalhes(r.error?.issues ?? [])) };
  return { corpo: r.data as T };
}

/* ---------- Domínio simulado ---------- */
const achar = (id: string | null) => db().usuarios.find((u) => u.id === id);
const sessaoDe = () => achar(db().sessaoUsuarioId);
const pendente = (u: UsuarioMock) => u.status === 'pendente_responsavel' || u.status === 'pendente_email';

function emitirToken(u: UsuarioMock, tipo: TipoToken, ttl: number): TokenMock {
  const b = db();
  // Um link novo invalida os anteriores do mesmo tipo (T05: "corrigir o e-mail renova o link").
  b.tokens.filter((t) => t.usuarioId === u.id && t.tipo === tipo && !t.usado).forEach((t) => (t.usado = true));
  const token: TokenMock = { valor: gerarToken(), tipo, usuarioId: u.id, expiraEm: Date.now() + ttl, usado: false };
  b.tokens.push(token);
  return token;
}

function enviarEmail(tipo: 'E1' | 'E3' | 'E4', para: string, assunto: string, caminho: string, token: TokenMock) {
  db().emails.push({
    id: gerarUlid(),
    tipo,
    para,
    assunto,
    link: `${caminho}?t=${token.valor}`,
    enviadoEm: new Date().toISOString(),
  });
}

function emitirPedido(u: UsuarioMock): TokenMock {
  if (u.menor) {
    const t = emitirToken(u, 'consentimento', 7 * DIA_MS);
    enviarEmail('E1', u.emailResponsavel ?? '', `Autorize o uso do Aprende+ por ${u.apelido}`, '/responsavel/autorizar', t);
    return t;
  }
  const t = emitirToken(u, 'confirmacao-email', 7 * DIA_MS);
  enviarEmail('E3', u.email ?? '', 'Confirme seu e-mail', '/confirmar-email', t);
  return t;
}

function pendenciaDe(u: UsuarioMock): Pendencia {
  const tipo: TipoToken = u.menor ? 'consentimento' : 'confirmacao-email';
  const t = [...db().tokens].reverse().find((x) => x.usuarioId === u.id && x.tipo === tipo && !x.usado);
  return {
    tipo: u.menor ? 'responsavel' : 'email',
    emailMascarado: mascarar((u.menor ? u.emailResponsavel : u.email) ?? ''),
    expiraEm: new Date(t?.expiraEm ?? Date.now() + 7 * DIA_MS).toISOString(),
    proximoReenvioEm: new Date(db().reenvioAte[u.id] ?? Date.now()).toISOString(),
  };
}

function meDe(u: UsuarioMock): Me {
  const pend = pendente(u);
  const papelAtivo = pend ? null : (db().sessaoPapel ?? (u.papeis.length === 1 ? (u.papeis[0] ?? null) : null));
  return {
    id: u.id,
    status: u.status,
    escopoSessao: pend ? 'pendente' : 'completa',
    apelido: u.apelido,
    nome: pend ? null : u.nome,
    email: pend || u.menor ? null : u.email,
    papeis: pend ? [] : u.papeis,
    papelAtivo,
    anoEscolar: pend ? null : u.anoEscolar,
    escola: pend ? null : u.escola,
    pendencia: pend ? pendenciaDe(u) : null,
  };
}

/** Só no mock: ≤ 18 anos completos no mês = menor (mesma regra de dúvida do contrato, DC-04). */
function ehMenor(nascimento: string): boolean {
  const [a = 0, m = 0] = nascimento.split('-').map(Number);
  const hoje = new Date();
  return (hoje.getUTCFullYear() - a) * 12 + (hoje.getUTCMonth() + 1 - m) <= 18 * 12;
}

function tokenValido(valor: string, tipo: TipoToken): TokenMock | undefined {
  return db().tokens.find((t) => t.valor === valor && t.tipo === tipo && !t.usado && t.expiraEm > Date.now());
}

function regraDeSenha(senha: string, apelido: string | null): CampoErro | undefined {
  if (SENHAS_COMUNS.includes(senha.toLowerCase())) return { path: 'senha', code: 'SENHA_COMUM' };
  if (apelido && senha.toLowerCase() === apelido.toLowerCase()) return { path: 'senha', code: 'SENHA_IGUAL_APELIDO' };
  return undefined;
}

/** Idempotency-Key (DC-09): repetição devolve a resposta guardada; mesma chave com corpo diferente → 409. */
async function idempotente(op: Op, request: Request, corpo: unknown, fn: () => Response): Promise<Response> {
  const chave = request.headers.get('Idempotency-Key');
  if (!chave) return erro('VALIDATION_ERROR', [{ path: 'Idempotency-Key', code: 'OBRIGATORIO' }]);
  const id = `${op}:${chave}`;
  const hash = JSON.stringify(corpo);
  const guardada = db().idempotencia[id];
  if (guardada) {
    if (guardada.hash !== hash) return erro('IDEMPOTENCY_CONFLICT');
    return HttpResponse.json(guardada.corpo as never, { status: guardada.status, headers: cabecalhos() });
  }
  const resposta = fn();
  if (resposta.ok) {
    db().idempotencia[id] = { hash, status: resposta.status, corpo: await resposta.clone().json() };
    mudou();
  }
  return resposta;
}

const caminho = (op: Op) => `${BASE}${OPERACOES_AUTH[op].caminho}`;

/* ---------- Handlers ---------- */
export const handlers: HttpHandler[] = [
  http.get(caminho('obterAvisosVigentes'), () => {
    const publicadoEm = '2026-10-22T00:00:00.000Z';
    return sucesso('obterAvisosVigentes', {
      aluno: { versao: AVISOS_VERSAO.aluno, publicadoEm },
      responsavel: { versao: AVISOS_VERSAO.responsavel, publicadoEm },
      professor: { versao: AVISOS_VERSAO.professor, publicadoEm },
    });
  }),

  http.get(caminho('sortearApelido'), () => {
    const adjetivos = ['Leao', 'Coral', 'Tigre', 'Nuvem', 'Pipa', 'Arara', 'Lobo', 'Falcao'];
    const cores = ['Azul', 'Verde', 'Prata', 'Dourado', 'Rubi', 'Lilas', 'Cinza', 'Bravo'];
    const n = (l: number) => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]! % l;
    let apelido = '';
    do {
      apelido = `${adjetivos[n(adjetivos.length)]}${cores[n(cores.length)]}${10 + n(90)}`;
    } while (db().usuarios.some((u) => u.apelido === apelido));
    const apelidoToken = gerarToken();
    db().apelidos[apelidoToken] = apelido;
    mudou();
    return sucesso('sortearApelido', { apelido, apelidoToken, expiraEm: new Date(Date.now() + 30 * 60_000).toISOString() });
  }),

  http.post(caminho('cadastrarAluno'), async ({ request }) => {
    const lido = await lerCorpo<{
      apelidoToken: string; nascimento: string; anoEscolar: UsuarioMock['anoEscolar']; email: string;
      senha: string; aviso: { versao: string }; turnstileToken?: string;
    }>('cadastrarAluno', request);
    if ('resposta' in lido) return lido.resposta;
    const c = lido.corpo;
    return idempotente('cadastrarAluno', request, c, () => {
      // Gatilhos para testar estados à mão (documentados em mocks/README.md).
      if (c.email.startsWith('limite@')) return limite();
      if (c.email.startsWith('falha@')) return erro('INTERNAL');
      if (c.email.startsWith('desafio@') && c.turnstileToken !== TOKEN_DESAFIO) return erro('DESAFIO_REQUERIDO');

      const apelido = db().apelidos[c.apelidoToken];
      if (!apelido) return erro('VALIDATION_ERROR', [{ path: 'apelidoToken', code: 'APELIDO_INVALIDO' }]);
      if (db().usuarios.some((u) => u.apelido === apelido)) {
        return erro('CONFLICT', [{ path: 'apelidoToken', code: 'APELIDO_EM_USO' }]);
      }
      const invalidos: CampoErro[] = [];
      const senhaRuim = regraDeSenha(c.senha, apelido);
      if (senhaRuim) invalidos.push(senhaRuim);
      if (c.aviso.versao !== AVISOS_VERSAO.aluno) invalidos.push({ path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' });
      if (invalidos.length) return erro('VALIDATION_ERROR', invalidos);

      const menor = ehMenor(c.nascimento);
      const u: UsuarioMock = {
        id: gerarUlid(), apelido, nome: null, nascimento: c.nascimento, anoEscolar: c.anoEscolar,
        email: menor ? null : c.email, emailResponsavel: menor ? c.email : null, senha: c.senha,
        status: menor ? 'pendente_responsavel' : 'pendente_email', papeis: [], escola: null, menor,
      };
      db().usuarios.push(u);
      db().reenvioAte[u.id] = Date.now() + INTERVALO_REENVIO_MS;
      emitirPedido(u);
      db().sessaoUsuarioId = u.id; // sessão de escopo restrito (DC-01)
      db().sessaoPapel = null;
      mudou();
      return sucesso('cadastrarAluno', {
        usuario: { id: u.id, apelido },
        status: u.status === 'pendente_responsavel' ? 'pendente_responsavel' : 'pendente_email',
        menor,
        pendencia: pendenciaDe(u),
      }) as Response;
    });
  }),

  http.post(caminho('reenviarPendencia'), () => {
    const u = sessaoDe();
    if (!u) return erro('UNAUTHENTICATED');
    if (!pendente(u)) return erro('FORBIDDEN');
    if (Date.now() < (db().reenvioAte[u.id] ?? 0)) return limite();
    emitirPedido(u);
    db().reenvioAte[u.id] = Date.now() + INTERVALO_REENVIO_MS;
    mudou();
    return sucesso('reenviarPendencia', pendenciaDe(u));
  }),

  http.put(caminho('corrigirEmailPendencia'), async ({ request }) => {
    const u = sessaoDe();
    if (!u) return erro('UNAUTHENTICATED');
    if (!pendente(u)) return erro('FORBIDDEN');
    const lido = await lerCorpo<{ email: string }>('corrigirEmailPendencia', request);
    if ('resposta' in lido) return lido.resposta;
    if (u.menor) u.emailResponsavel = lido.corpo.email;
    else u.email = lido.corpo.email;
    emitirPedido(u);
    db().reenvioAte[u.id] = Date.now() + INTERVALO_REENVIO_MS;
    mudou();
    return sucesso('corrigirEmailPendencia', pendenciaDe(u));
  }),

  http.post(caminho('confirmarEmail'), async ({ request }) => {
    const lido = await lerCorpo<{ token: string }>('confirmarEmail', request);
    if ('resposta' in lido) return lido.resposta;
    const t = tokenValido(lido.corpo.token, 'confirmacao-email');
    const u = t && achar(t.usuarioId);
    if (!t || !u) return erro('TOKEN_INVALIDO');
    t.usado = true;
    u.status = 'ativa';
    u.papeis = ['aluno'];
    mudou();
    return sucesso('confirmarEmail', { status: 'ativa' });
  }),

  http.post(caminho('consultarPedidoConsentimento'), async ({ request }) => {
    const lido = await lerCorpo<{ token: string }>('consultarPedidoConsentimento', request);
    if ('resposta' in lido) return lido.resposta;
    const t = tokenValido(lido.corpo.token, 'consentimento');
    const u = t && achar(t.usuarioId);
    if (!t || !u?.apelido) return erro('TOKEN_INVALIDO');
    return sucesso('consultarPedidoConsentimento', {
      apelido: u.apelido,
      aviso: { versao: AVISOS_VERSAO.responsavel, publicadoEm: '2026-10-22T00:00:00.000Z' },
      rankingDisponivel: false, // sem ranking no Sprint 1 (fluxos.md T06)
      expiraEm: new Date(t.expiraEm).toISOString(),
    });
  }),

  http.post(caminho('concederConsentimento'), async ({ request }) => {
    const lido = await lerCorpo<{ token: string; nomeResponsavel: string; aviso: { versao: string }; rankingAutorizado: boolean }>(
      'concederConsentimento',
      request,
    );
    if ('resposta' in lido) return lido.resposta;
    const c = lido.corpo;
    return idempotente('concederConsentimento', request, c, () => {
      const t = tokenValido(c.token, 'consentimento');
      const u = t && achar(t.usuarioId);
      if (!t || !u?.apelido) return erro('TOKEN_INVALIDO');
      if (c.aviso.versao !== AVISOS_VERSAO.responsavel) {
        return erro('VALIDATION_ERROR', [{ path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' }]);
      }
      if (c.rankingAutorizado) return erro('VALIDATION_ERROR', [{ path: 'rankingAutorizado', code: 'RANKING_INDISPONIVEL' }]);
      t.usado = true;
      u.status = 'ativa';
      u.papeis = ['aluno'];
      mudou();
      return sucesso('concederConsentimento', {
        resultado: 'autorizado',
        protocolo: gerarUlid(),
        apelido: u.apelido,
        registradoEm: new Date().toISOString(),
      }) as Response;
    });
  }),

  http.post(caminho('recusarConsentimento'), async ({ request }) => {
    const lido = await lerCorpo<{ token: string }>('recusarConsentimento', request);
    if ('resposta' in lido) return lido.resposta;
    const t = tokenValido(lido.corpo.token, 'consentimento');
    if (!t) return erro('TOKEN_INVALIDO');
    const b = db();
    b.usuarios = b.usuarios.filter((u) => u.id !== t.usuarioId); // recusa apaga o pré-cadastro (RQ-05)
    b.tokens = b.tokens.filter((x) => x.usuarioId !== t.usuarioId);
    if (b.sessaoUsuarioId === t.usuarioId) b.sessaoUsuarioId = null;
    mudou();
    return sucesso('recusarConsentimento', { resultado: 'recusado' });
  }),

  http.post(caminho('entrar'), async ({ request }) => {
    const lido = await lerCorpo<{ identificador: string; senha: string; turnstileToken?: string }>('entrar', request);
    if ('resposta' in lido) return lido.resposta;
    const { identificador, senha, turnstileToken } = lido.corpo;
    const chave = identificador.trim().toLowerCase();
    const falhas = db().falhasLogin[chave] ?? 0;
    if (falhas >= 10) return limite();
    if (falhas >= 3 && turnstileToken !== TOKEN_DESAFIO) return erro('DESAFIO_REQUERIDO');

    const u = db().usuarios.find((x) => x.apelido?.toLowerCase() === chave || x.email?.toLowerCase() === chave);
    if (!u || u.senha !== senha) {
      db().falhasLogin[chave] = falhas + 1;
      mudou();
      return HttpResponse.json(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Usuário ou senha incorretos.' } },
        { status: 401, headers: cabecalhos() },
      );
    }
    delete db().falhasLogin[chave];
    db().sessaoPapel = null;
    if (u.status === 'suspensa_exclusao') {
      db().sessaoUsuarioId = null;
      mudou();
      return sucesso('entrar', { status: u.status, escopoSessao: 'nenhuma', me: null });
    }
    db().sessaoUsuarioId = u.id;
    mudou();
    const me = meDe(u);
    return sucesso('entrar', { status: u.status, escopoSessao: me.escopoSessao, me });
  }),

  http.delete(caminho('sair'), () => {
    db().sessaoUsuarioId = null;
    db().sessaoPapel = null;
    mudou();
    return sucesso('sair', {});
  }),

  http.put(caminho('escolherPapel'), async ({ request }) => {
    const u = sessaoDe();
    if (!u) return erro('UNAUTHENTICATED');
    if (pendente(u)) return erro('FORBIDDEN');
    const lido = await lerCorpo<{ papel: UsuarioMock['papeis'][number] }>('escolherPapel', request);
    if ('resposta' in lido) return lido.resposta;
    if (!u.papeis.includes(lido.corpo.papel)) return erro('FORBIDDEN');
    db().sessaoPapel = lido.corpo.papel;
    mudou();
    return sucesso('escolherPapel', meDe(u));
  }),

  http.get(caminho('obterMe'), () => {
    const u = sessaoDe();
    return u ? sucesso('obterMe', meDe(u)) : erro('UNAUTHENTICATED');
  }),

  http.post(caminho('solicitarRecuperacao'), async ({ request }) => {
    const lido = await lerCorpo<{ identificador: string; turnstileToken?: string }>('solicitarRecuperacao', request);
    if ('resposta' in lido) return lido.resposta;
    const chave = lido.corpo.identificador.trim().toLowerCase();
    if (chave.startsWith('limite')) return limite();
    if (chave.startsWith('desafio') && lido.corpo.turnstileToken !== TOKEN_DESAFIO) return erro('DESAFIO_REQUERIDO');
    const u = db().usuarios.find((x) => x.apelido?.toLowerCase() === chave || x.email?.toLowerCase() === chave);
    // Sempre 202, exista a conta ou não (DU-06). Conta pendente ou em exclusão: não envia nada.
    if (u && u.status === 'ativa') {
      const para = u.menor ? u.emailResponsavel : u.email;
      if (para) {
        const t = emitirToken(u, 'recuperacao', 30 * 60_000);
        enviarEmail('E4', para, 'Crie uma nova senha', '/recuperar/nova', t);
        mudou();
      }
    }
    return sucesso('solicitarRecuperacao', {});
  }),

  http.post(caminho('consultarRecuperacao'), async ({ request }) => {
    const lido = await lerCorpo<{ token: string }>('consultarRecuperacao', request);
    if ('resposta' in lido) return lido.resposta;
    const t = tokenValido(lido.corpo.token, 'recuperacao');
    const u = t && achar(t.usuarioId);
    if (!t || !u) return erro('TOKEN_INVALIDO');
    return sucesso('consultarRecuperacao', { apelido: u.menor ? u.apelido : null, expiraEm: new Date(t.expiraEm).toISOString() });
  }),

  http.post(caminho('definirNovaSenha'), async ({ request }) => {
    const lido = await lerCorpo<{ token: string; novaSenha: string }>('definirNovaSenha', request);
    if ('resposta' in lido) return lido.resposta;
    const t = tokenValido(lido.corpo.token, 'recuperacao');
    const u = t && achar(t.usuarioId);
    if (!t || !u) return erro('TOKEN_INVALIDO');
    const ruim = regraDeSenha(lido.corpo.novaSenha, u.apelido);
    if (ruim) return erro('VALIDATION_ERROR', [{ ...ruim, path: 'novaSenha' }]);
    u.senha = lido.corpo.novaSenha;
    t.usado = true;
    if (db().sessaoUsuarioId === u.id) db().sessaoUsuarioId = null; // encerra as sessões (RQ-12)
    mudou();
    return sucesso('definirNovaSenha', { senhaAlterada: true });
  }),
];
