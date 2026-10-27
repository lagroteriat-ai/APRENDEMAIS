import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import { SENHA_TESTE, cadastrarAluno, criarContexto, emailFicticio, semearUsuario, um, type Cliente } from './ajuda';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const avancar = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};

const entrar = (c: Cliente, identificador: string, senha = SENHA_TESTE, extra: Record<string, unknown> = {}) =>
  c.post('/sessoes', { identificador, senha, ...extra });

describe('POST /sessoes (login)', () => {
  it('aluno ativo: abre sessão completa com cookie seguro e devolve /me', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'LeaoAzul42' });
    const r = await entrar(cliente, 'LeaoAzul42');
    expect(r.status).toBe(200);
    expect(r.corpo.data).toMatchObject({
      status: 'ativa',
      escopoSessao: 'completa',
      me: {
        status: 'ativa', escopoSessao: 'completa', apelido: 'LeaoAzul42', nome: null, email: null,
        papeis: ['aluno'], papelAtivo: 'aluno', anoEscolar: 'EM3', escola: null, pendencia: null
      }
    });
    expect(JSON.stringify(r.corpo)).not.toMatch(/credencial|argon2|nascimento/);
    const cookie = r.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/^__Host-sid=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
    expect(await um('SELECT ultimo_acesso_em FROM usuarios')).toEqual({ ultimo_acesso_em: INSTANTE_FIXO });

    // o KV guarda só o hash do token (nunca o valor do cookie)
    const token = cookie.split('=')[1]!.split(';')[0]!;
    const { keys } = await env.KV.list({ prefix: 'sess:' });
    expect(keys).toHaveLength(1);
    expect(keys[0]!.name).not.toContain(token);
  });

  it('aceita apelido sem diferenciar maiúsculas e, para quem tem e-mail, o e-mail', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'TucanoVerde07' });
    const email = emailFicticio('adulto');
    await semearUsuario({ papel: 'professor', email, nome: 'Profa. Fictícia' });
    expect((await entrar(cliente, 'tucanoverde07')).status).toBe(200);
    expect((await entrar(cliente, `  ${email.toUpperCase()} `)).corpo.data.me).toMatchObject({ nome: 'Profa. Fictícia', email, papeis: ['professor'] });
  });

  it('mesma resposta para senha errada e conta inexistente (SR-08)', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'PandaCalmo11' });
    const errada = await entrar(cliente, 'PandaCalmo11', 'senha-errada-123');
    const inexistente = await entrar(cliente.novoNavegador(), 'NaoExiste99', 'senha-errada-123');
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(errada.status);
    expect(inexistente.corpo).toEqual(errada.corpo);
    expect(errada.corpo.error).toEqual({ code: 'UNAUTHENTICATED', message: 'Usuário ou senha incorretos.' });
    expect(errada.headers.get('Set-Cookie')).toBeNull();
  });

  it('conta pendente: entra só com sessão restrita e o status só aparece com a senha certa (DU-06)', async () => {
    const { cliente } = criarContexto();
    const { r } = await cadastrarAluno(cliente);
    const apelido = r.corpo.data.usuario.apelido as string;
    const outro = cliente.novoNavegador();
    expect((await entrar(outro, apelido, 'senha-errada-123')).corpo.error.code).toBe('UNAUTHENTICATED'); // sem pista do status
    const ok = await entrar(outro, apelido);
    expect(ok.status).toBe(200);
    expect(ok.corpo.data).toMatchObject({
      status: 'pendente_responsavel', escopoSessao: 'pendente',
      me: { escopoSessao: 'pendente', papeis: [], pendencia: { tipo: 'responsavel', emailMascarado: 're***@example.test' } }
    });
    expect((await outro.put('/sessoes/atual/papel-ativo', { papel: 'aluno' })).status).toBe(403);
  });

  it('valida o corpo', async () => {
    const { cliente } = criarContexto();
    expect((await cliente.post('/sessoes', { identificador: 'ab', senha: 'x' })).corpo.error.details).toEqual([{ path: 'identificador', code: 'FORMATO_INVALIDO' }]);
    expect((await cliente.post('/sessoes', { identificador: 'LeaoAzul42' })).corpo.error.details).toEqual([{ path: 'senha', code: 'OBRIGATORIO' }]);
    expect((await cliente.post('/sessoes', { identificador: 'LeaoAzul42', senha: 'x', papel: 'admin' })).status).toBe(400);
  });

  it('cada login emite um cookie novo e invalida o anterior do mesmo navegador (SR-05)', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'RaposaForte21' });
    await entrar(cliente, 'RaposaForte21');
    const antigo = cliente.cookie!;
    await entrar(cliente, 'RaposaForte21');
    expect(cliente.cookie).not.toBe(antigo);
    expect((await cliente.get('/me')).status).toBe(200);
    const velho = cliente.novoNavegador();
    velho.cookie = antigo;
    expect((await velho.get('/me')).status).toBe(401);
  });
});

describe('POST /sessoes — limites e desafio (SR-09)', () => {
  it('após 3 falhas na conta exige Turnstile; com o token bom a senha certa entra', async () => {
    const { cliente, turnstileChamadas } = criarContexto();
    await semearUsuario({ apelido: 'LobaBrava33' });
    for (let i = 0; i < 3; i++) expect((await entrar(cliente, 'LobaBrava33', 'errada-1234')).status).toBe(401);
    const sem = await entrar(cliente, 'LobaBrava33');
    expect(sem.status).toBe(428);
    expect(sem.corpo.error.code).toBe('DESAFIO_REQUERIDO');
    expect((await entrar(cliente, 'LobaBrava33', SENHA_TESTE, { turnstileToken: 'ruim' })).status).toBe(428);
    const ok = await entrar(cliente, 'LobaBrava33', SENHA_TESTE, { turnstileToken: 'ok' });
    expect(ok.status).toBe(200);
    expect(turnstileChamadas).toEqual(['ruim', 'ok']);
  });

  it('o desafio vale também para conta inexistente (não revela quais contas existem)', async () => {
    const { cliente } = criarContexto();
    for (let i = 0; i < 3; i++) await entrar(cliente, 'NaoExiste01', 'errada-1234');
    expect((await entrar(cliente, 'NaoExiste01', 'errada-1234')).status).toBe(428);
  });

  it('10 falhas na conta → 429 com Retry-After, mesmo com a senha certa e vindo de outro IP', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'UrsoGentil44' });
    for (let i = 0; i < 3; i++) await entrar(cliente, 'UrsoGentil44', 'errada-1234');
    for (let i = 0; i < 7; i++) expect((await entrar(cliente, 'UrsoGentil44', 'errada-1234', { turnstileToken: 'ok' })).status).toBe(401);
    const bloqueada = await entrar(cliente, 'UrsoGentil44', SENHA_TESTE, { turnstileToken: 'ok' });
    expect(bloqueada.status).toBe(429);
    expect(Number(bloqueada.headers.get('Retry-After'))).toBeGreaterThan(0);
    const outroIp = await entrar(cliente.novoNavegador(), 'UrsoGentil44', SENHA_TESTE, { turnstileToken: 'ok' });
    expect(outroIp.status).toBe(429);
    // passada a janela de 15 min, volta ao normal
    avancar(16 * MIN);
    expect((await entrar(cliente, 'UrsoGentil44')).status).toBe(200);
  });

  it('F-01: 30 logins errados em paralelo → 3 senhas verificadas sem desafio, 7 pedem Turnstile, 20 levam 429', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'LinceRapido77' });
    const respostas = await Promise.all(Array.from({ length: 30 }, (_, i) => entrar(cliente.novoNavegador(), 'LinceRapido77', `errada-${i}-xyz`)));
    const por = (s: number) => respostas.filter(r => r.status === s).length;
    expect(por(401)).toBeLessThanOrEqual(3);
    expect(por(401) + por(428) + por(429)).toBe(30);
    expect(por(428)).toBe(7); // tentativas 4..10 pedem desafio; da 11ª em diante é 429
    expect(por(429)).toBe(20);

    // com Turnstile válido, a rajada também para em 10 verificações (o resto 429), mesmo vinda de IPs diferentes
    const c2 = criarContexto();
    await semearUsuario({ apelido: 'LinceRapido78' });
    const com = await Promise.all(Array.from({ length: 30 }, (_, i) => entrar(c2.cliente.novoNavegador(), 'LinceRapido78', `errada-${i}-xyz`, { turnstileToken: 'ok' })));
    expect(com.filter(r => r.status === 401).length).toBeLessThanOrEqual(10);
    expect(com.filter(r => r.status === 429).length).toBeGreaterThanOrEqual(20);
    // a senha certa também fica barrada durante o bloqueio
    expect((await entrar(c2.cliente, 'LinceRapido78', SENHA_TESTE, { turnstileToken: 'ok' })).status).toBe(429);
  });

  it('login bem-sucedido zera o contador da conta', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'CoalaSereno55' });
    for (let i = 0; i < 2; i++) await entrar(cliente, 'CoalaSereno55', 'errada-1234');
    expect((await entrar(cliente, 'CoalaSereno55')).status).toBe(200);
    // outro IP (o contador do IP não zera): sem o reset da conta, a 2ª falha já pediria desafio (2 + 2 ≥ 3)
    const outro = cliente.novoNavegador();
    for (let i = 0; i < 2; i++) expect((await entrar(outro, 'CoalaSereno55', 'errada-1234')).status).toBe(401);
    expect((await entrar(outro, 'CoalaSereno55')).status).toBe(200);
  });

  it('muitas falhas vindas do mesmo IP pedem desafio também para outras contas', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'FocaAlegre66' });
    for (let i = 0; i < 3; i++) await entrar(cliente, `Fantasma${i}00`, 'errada-1234');
    expect((await entrar(cliente, 'FocaAlegre66')).status).toBe(428);
    expect((await entrar(cliente.novoNavegador(), 'FocaAlegre66')).status).toBe(200); // outro IP não é afetado
  });
});

describe('DELETE /sessoes/atual (logout)', () => {
  it('encerra a sessão e expira o cookie', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'PatoLeal77' });
    await entrar(cliente, 'PatoLeal77');
    const r = await cliente.del('/sessoes/atual');
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ ok: true, data: {} });
    expect(r.headers.get('Set-Cookie')).toMatch(/^__Host-sid=; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=0$/);
    expect((await cliente.get('/me')).status).toBe(401);
    expect((await env.KV.list({ prefix: 'sess:' })).keys).toHaveLength(0);
  });

  it('é idempotente: sem sessão ou com cookie inválido também responde 200', async () => {
    const { cliente } = criarContexto();
    expect((await cliente.del('/sessoes/atual')).status).toBe(200);
    expect((await cliente.del('/sessoes/atual', { headers: { Cookie: '__Host-sid=lixo' } })).status).toBe(200);
  });

  it('recusa Origin estranha (CSRF) sem encerrar a sessão', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'CisneLigeiro88' });
    await entrar(cliente, 'CisneLigeiro88');
    const r = await cliente.del('/sessoes/atual', { headers: { Origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
    expect((await cliente.get('/me')).status).toBe(200);
  });
});

describe('GET /me e validade da sessão', () => {
  it('sem cookie ou com cookie inventado → 401 UNAUTHENTICATED', async () => {
    const { cliente } = criarContexto();
    const r = await cliente.get('/me');
    expect(r.status).toBe(401);
    expect(r.corpo.error.code).toBe('UNAUTHENTICATED');
    expect((await cliente.get('/me', { headers: { Cookie: `__Host-sid=${'A'.repeat(43)}` } })).status).toBe(401);
  });

  it('sessão do aluno: expira após 7 dias parada', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'EsquiloFofo12' });
    await entrar(cliente, 'EsquiloFofo12');
    avancar(6 * DIA);
    expect((await cliente.get('/me')).status).toBe(200); // renova o "último uso"
    avancar(12 * DIA); // 6 dias desde o último uso: ainda vale
    expect((await cliente.get('/me')).status).toBe(200);
    avancar(20 * DIA); // 8 dias parada
    expect((await cliente.get('/me')).status).toBe(401);
  });

  it('sessão do aluno: 30 dias no máximo, mesmo usando sempre', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'EsquiloFofo13' });
    await entrar(cliente, 'EsquiloFofo13');
    for (const dia of [6, 12, 18, 24, 29]) {
      avancar(dia * DIA);
      expect((await cliente.get('/me')).status, `dia ${dia}`).toBe(200);
    }
    avancar(31 * DIA);
    expect((await cliente.get('/me')).status).toBe(401);
  });

  it('sessão do professor: 12 h ociosa', async () => {
    const { cliente } = criarContexto();
    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    await entrar(cliente, email);
    avancar(11 * HORA);
    expect((await cliente.get('/me')).status).toBe(200);
    avancar(24 * HORA); // 13 h desde o último uso
    expect((await cliente.get('/me')).status).toBe(401);
  });

  it('sessão do admin: 8 h absolutas, mesmo com atividade', async () => {
    const { cliente } = criarContexto();
    const email = emailFicticio('admin');
    await semearUsuario({ papel: 'admin', email });
    await entrar(cliente, email);
    avancar(7 * HORA);
    expect((await cliente.get('/me')).status).toBe(200);
    avancar(8 * HORA + MIN);
    expect((await cliente.get('/me')).status).toBe(401);
  });

  it('mudar sessao_versao ou o status da conta derruba a sessão na hora, sem esperar o KV (SR-06)', async () => {
    const { cliente } = criarContexto();
    const id = await semearUsuario({ apelido: 'ZebraAtenta90' });
    await entrar(cliente, 'ZebraAtenta90');
    expect((await cliente.get('/me')).status).toBe(200);
    await env.DB.prepare('UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE id = ?').bind(id).run();
    expect((await cliente.get('/me')).status).toBe(401);

    const c2 = criarContexto().cliente;
    const id2 = await semearUsuario({ apelido: 'GirafaCalma91' });
    await entrar(c2, 'GirafaCalma91');
    await env.DB.prepare("UPDATE usuarios SET status = 'suspensa_exclusao', exclusao_solicitada_em = ? WHERE id = ?").bind(INSTANTE_FIXO, id2).run();
    expect((await c2.get('/me')).status).toBe(401);
  });
});

describe('PUT /sessoes/atual/papel-ativo', () => {
  async function professorComDoisPapeis() {
    const ctx = criarContexto();
    const email = emailFicticio('multi');
    await semearUsuario({ papel: 'professor', email, papeisExtras: ['aluno'] });
    const login = await entrar(ctx.cliente, email);
    return { ...ctx, login };
  }

  it('com mais de um papel o login não escolhe: papelAtivo null até o usuário decidir (T15)', async () => {
    const { login } = await professorComDoisPapeis();
    expect(login.corpo.data.me.papeis.sort()).toEqual(['aluno', 'professor']);
    expect(login.corpo.data.me.papelAtivo).toBeNull();
  });

  it('troca o papel, rotaciona o cookie (SR-05) e não prolonga o prazo da sessão', async () => {
    const { cliente } = await professorComDoisPapeis();
    const antigo = cliente.cookie!;
    const r = await cliente.put('/sessoes/atual/papel-ativo', { papel: 'professor' });
    expect(r.status).toBe(200);
    expect(r.corpo.data.papelAtivo).toBe('professor');
    expect(cliente.cookie).not.toBe(antigo);
    expect(r.headers.get('Set-Cookie')).toMatch(/^__Host-sid=/);
    expect((await cliente.get('/me')).corpo.data.papelAtivo).toBe('professor');
    const velho = cliente.novoNavegador();
    velho.cookie = antigo;
    expect((await velho.get('/me')).status).toBe(401);
  });

  it('papel que o usuário não tem → 403; papel inexistente → 400; sem sessão → 401', async () => {
    const { cliente } = await professorComDoisPapeis();
    expect((await cliente.put('/sessoes/atual/papel-ativo', { papel: 'admin' })).status).toBe(403);
    const ruim = await cliente.put('/sessoes/atual/papel-ativo', { papel: 'rei' });
    expect(ruim.status).toBe(400);
    expect(ruim.corpo.error.details).toEqual([{ path: 'papel', code: 'PAPEL_INVALIDO' }]);
    expect((await criarContexto().cliente.put('/sessoes/atual/papel-ativo', { papel: 'aluno' })).status).toBe(401);
  });
});
