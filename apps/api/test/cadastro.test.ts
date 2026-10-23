import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto';
import {
  AVISO_ALUNO, NASCIMENTO_MAIOR, SENHA_TESTE, cadastrarAluno, contar, corpoCadastroAluno, criarContexto, emailFicticio, sortearApelido,
  todos, tokenDe, ultimoEmail, um
} from './ajuda';

/** Ambiente com variáveis trocadas (os bindings reais continuam valendo). */
function comEnv(extra: Record<string, string>): typeof env {
  return new Proxy(env, { get: (alvo, chave) => (typeof chave === 'string' && chave in extra ? extra[chave] : Reflect.get(alvo, chave)) });
}

describe('GET /avisos-privacidade/vigentes', () => {
  it('lista as versões vigentes sem exigir sessão', async () => {
    const { cliente } = criarContexto();
    const r = await cliente.get('/avisos-privacidade/vigentes');
    expect(r.status).toBe(200);
    expect(r.corpo.data.aluno.versao).toBe('aluno-2026-10-v1');
    expect(r.corpo.data.responsavel.versao).toMatch(/^responsavel-/);
    expect(r.corpo.data.professor.versao).toMatch(/^professor-/);
  });
});

describe('GET /cadastro/apelido-sugerido', () => {
  it('devolve apelido livre com token assinado e não o reserva', async () => {
    const { cliente } = criarContexto();
    const r = await cliente.get('/cadastro/apelido-sugerido');
    expect(r.status).toBe(200);
    expect(r.corpo.data.apelido).toMatch(/^[A-Za-z]+[0-9]{2,3}$/);
    expect(r.corpo.data.apelidoToken.length).toBeGreaterThanOrEqual(32);
    expect(r.corpo.data.expiraEm).toBe('2026-10-22T12:30:00.000Z');
    expect(await contar('usuarios')).toBe(0);
  });

  it('limita a 10 sorteios por IP (SR-13) com Retry-After', async () => {
    const { cliente } = criarContexto();
    for (let i = 0; i < 10; i++) expect((await cliente.get('/cadastro/apelido-sugerido')).status).toBe(200);
    const r = await cliente.get('/cadastro/apelido-sugerido');
    expect(r.status).toBe(429);
    expect(r.corpo.error.code).toBe('RATE_LIMITED');
    expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(0);
    // outro IP não é afetado
    expect((await cliente.novoNavegador().get('/cadastro/apelido-sugerido')).status).toBe(200);
  });
});

describe('POST /cadastro/aluno — menor de 18', () => {
  it('cria conta pendente, pede autorização ao responsável e guarda só o necessário', async () => {
    const { cliente, emails } = criarContexto();
    const { r, corpo } = await cadastrarAluno(cliente);
    expect(r.status).toBe(201);
    expect(r.corpo.data).toMatchObject({
      status: 'pendente_responsavel',
      menor: true,
      pendencia: { tipo: 'responsavel', emailMascarado: 're***@example.test', proximoReenvioEm: '2026-10-22T12:05:00.000Z' }
    });
    expect(r.corpo.data.pendencia.expiraEm).toBe('2026-10-29T12:00:00.000Z');

    // cookie: SR-05
    const cookie = r.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/^__Host-sid=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
    expect(cookie).not.toMatch(/Domain=/i);

    // banco: aluno menor não tem e-mail nem nome; senha só como Argon2id
    const u = await um<Record<string, string | null>>('SELECT * FROM usuarios');
    expect(u).toMatchObject({ papel: 'aluno', status: 'pendente_responsavel', email: null, nome: null, nascimento_ym: '2014-05', ano_escolar: 'EF5' });
    expect(u?.credencial_hash).toMatch(/^argon2id\$v=19\$m=\d+,t=\d+,p=1\$/);
    expect(u?.credencial_hash).not.toContain(SENHA_TESTE);
    expect(await um("SELECT responsavel_email FROM responsaveis_vinculos")).toEqual({ responsavel_email: corpo.email });
    expect(await um("SELECT status, concedido_por, versao_texto FROM consentimentos")).toEqual({
      status: 'pendente', concedido_por: 'responsavel', versao_texto: 'responsavel-2026-10-v1'
    });

    // E1 ao responsável; o token só existe no link e no banco como hash
    const e1 = ultimoEmail(emails, 'E1');
    expect(e1?.para).toBe(corpo.email);
    expect(e1?.link).toContain('/responsavel/autorizar?t=');
    const t = await um<{ tipo: string; token_hash: string }>('SELECT tipo, token_hash FROM tokens_acao');
    expect(t).toEqual({ tipo: 'consentimento', token_hash: await sha256Hex(tokenDe(e1)) });

    // auditoria sem PII (SR-17, RQ-30)
    const auditoria = JSON.stringify(await todos('SELECT * FROM auditoria_acesso'));
    expect(auditoria).toContain('conta.cadastrar');
    expect(auditoria).not.toMatch(/@|example\.test|LeaoAzul|Senha/);
  });

  it('a sessão pendente enxerga o próprio estado em /me (T05) e nada mais', async () => {
    const { cliente } = criarContexto();
    await cadastrarAluno(cliente);
    const me = await cliente.get('/me');
    expect(me.status).toBe(200);
    expect(me.corpo.data).toMatchObject({
      status: 'pendente_responsavel', escopoSessao: 'pendente', nome: null, email: null, papeis: [], papelAtivo: null, escola: null
    });
    expect(me.corpo.data.apelido).toMatch(/^[A-Za-z]+[0-9]{2,3}$/);
    expect(me.corpo.data.anoEscolar).toBe('EF5');
    expect(me.corpo.data.pendencia.tipo).toBe('responsavel');
    // rota que exige sessão completa → 403 (DC-01)
    expect((await cliente.put('/sessoes/atual/papel-ativo', { papel: 'aluno' })).status).toBe(403);
  });

  it('trata o mês dos 18 anos como menor (DU-07) e o mês seguinte como maior', async () => {
    const a = criarContexto();
    expect((await cadastrarAluno(a.cliente, { nascimento: '2008-10' })).r.corpo.data).toMatchObject({ menor: true, status: 'pendente_responsavel' });
    const b = criarContexto();
    expect((await cadastrarAluno(b.cliente, { nascimento: '2008-09', email: emailFicticio('maior') })).r.corpo.data).toMatchObject({
      menor: false, status: 'pendente_email'
    });
  });
});

describe('POST /cadastro/aluno — 18 anos ou mais', () => {
  it('guarda o e-mail do próprio aluno em minúsculas e envia a confirmação (E3)', async () => {
    const { cliente, emails } = criarContexto();
    const { r } = await cadastrarAluno(cliente, { nascimento: NASCIMENTO_MAIOR, anoEscolar: 'EM3', email: '  Aluno.Maior@Example.TEST ' });
    expect(r.status).toBe(201);
    expect(r.corpo.data).toMatchObject({ status: 'pendente_email', menor: false, pendencia: { tipo: 'email', emailMascarado: 'al***@example.test' } });
    expect((await um<{ email: string }>('SELECT email FROM usuarios'))?.email).toBe('aluno.maior@example.test');
    const e3 = ultimoEmail(emails, 'E3');
    expect(e3?.para).toBe('aluno.maior@example.test');
    expect(e3?.link).toContain('/confirmar-email?t=');
    expect(await um("SELECT concedido_por FROM consentimentos")).toEqual({ concedido_por: 'titular' });
    expect(await contar('responsaveis_vinculos')).toBe(0);
  });
});

describe('POST /cadastro/aluno — validação (casos negativos)', () => {
  it('rejeita campo desconhecido (mass assignment, SR-03) sem gravar nada', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente, { papel: 'admin', status: 'ativa' });
    const r = await cliente.post('/cadastro/aluno', corpo);
    expect(r.status).toBe(400);
    expect(r.corpo.error.code).toBe('VALIDATION_ERROR');
    expect(r.corpo.error.details).toEqual(expect.arrayContaining([{ path: 'papel', code: 'FORMATO_INVALIDO' }, { path: 'status', code: 'FORMATO_INVALIDO' }]));
    expect(await contar('usuarios')).toBe(0);
  });

  it('indica campos ausentes e inválidos sem repetir o valor recebido', async () => {
    const { cliente } = criarContexto();
    const r = await cliente.post('/cadastro/aluno', { nascimento: '2014-13', anoEscolar: 'EF10', email: 'nao-e-email', senha: '123' });
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toEqual(expect.arrayContaining([
      { path: 'apelidoToken', code: 'OBRIGATORIO' },
      { path: 'aviso', code: 'OBRIGATORIO' },
      { path: 'nascimento', code: 'NASCIMENTO_INVALIDO' },
      { path: 'anoEscolar', code: 'ANO_ESCOLAR_INVALIDO' },
      { path: 'email', code: 'EMAIL_INVALIDO' },
      { path: 'senha', code: 'SENHA_CURTA' }
    ]));
    expect(JSON.stringify(r.corpo)).not.toContain('nao-e-email');
  });

  it.each([
    ['nascimento no futuro', { nascimento: '2999-01' }, { path: 'nascimento', code: 'NASCIMENTO_INVALIDO' }],
    ['aviso desatualizado', { aviso: { versao: 'aluno-2020-01-v0' } }, { path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' }],
    ['senha comum', { senha: 'password1' }, { path: 'senha', code: 'SENHA_COMUM' }],
    ['senha longa demais', { senha: 'a'.repeat(129) }, { path: 'senha', code: 'SENHA_LONGA' }],
    ['apelidoToken adulterado', { apelidoToken: 'x'.repeat(60) }, { path: 'apelidoToken', code: 'APELIDO_INVALIDO' }]
  ])('rejeita %s', async (_nome, extra, esperado) => {
    const { cliente } = criarContexto();
    const { r } = await cadastrarAluno(cliente, extra);
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toContainEqual(esperado);
    expect(await contar('usuarios')).toBe(0);
  });

  it('rejeita senha igual ao apelido', async () => {
    const { cliente } = criarContexto();
    const { apelido, apelidoToken } = await sortearApelido(cliente);
    const r = await cliente.post('/cadastro/aluno', {
      apelidoToken, nascimento: '2014-05', anoEscolar: 'EF5', email: emailFicticio('resp'), senha: apelido.toLowerCase(), aviso: AVISO_ALUNO
    });
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toContainEqual({ path: 'senha', code: 'SENHA_IGUAL_APELIDO' });
  });

  it('rejeita apelidoToken vencido (30 min)', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    const depois = new Date(Date.now() + 31 * 60 * 1000);
    const { cliente: c2 } = criarContexto({ agora: () => depois });
    const r = await c2.post('/cadastro/aluno', corpo);
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toContainEqual({ path: 'apelidoToken', code: 'APELIDO_INVALIDO' });
  });

  it('rejeita JSON inválido e corpo que não é objeto', async () => {
    const { cliente } = criarContexto();
    expect((await cliente.chamar('POST', '/cadastro/aluno', { bruto: '{nao-json', headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
    expect((await cliente.chamar('POST', '/cadastro/aluno', { bruto: '[1,2]', headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
  });

  it('exige Idempotency-Key válida', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    const sem = await cliente.post('/cadastro/aluno', corpo, { idempotencia: false });
    expect(sem.status).toBe(400);
    expect(sem.corpo.error.details).toEqual([{ path: 'Idempotency-Key', code: 'OBRIGATORIO' }]);
    const ruim = await cliente.post('/cadastro/aluno', corpo, { idempotencia: 'curta' });
    expect(ruim.corpo.error.details).toEqual([{ path: 'Idempotency-Key', code: 'FORMATO_INVALIDO' }]);
    expect(await contar('usuarios')).toBe(0);
  });
});

describe('POST /cadastro/aluno — CSRF e desafio', () => {
  it('recusa Origin fora da allowlist e Content-Type que não é JSON (SR-04), sem efeito', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    const origem = await cliente.post('/cadastro/aluno', corpo, { headers: { Origin: 'https://evil.example' } });
    expect(origem.status).toBe(403);
    expect(origem.corpo.error.code).toBe('FORBIDDEN');
    const tipo = await cliente.chamar('POST', '/cadastro/aluno', { bruto: JSON.stringify(corpo), headers: { 'Content-Type': 'text/plain' } });
    expect(tipo.status).toBe(403);
    const form = await cliente.chamar('POST', '/cadastro/aluno', { bruto: 'a=1', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    expect(form.status).toBe(403);
    expect(await contar('usuarios')).toBe(0);
  });

  it('aceita a própria origem e as origens da allowlist', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    expect((await cliente.post('/cadastro/aluno', corpo, { headers: { Origin: 'https://api.test' } })).status).toBe(201);
    const outro = criarContexto();
    const corpo2 = await corpoCadastroAluno(outro.cliente);
    expect((await outro.cliente.post('/cadastro/aluno', corpo2, { headers: { Origin: 'http://localhost:5173' } })).status).toBe(201);
  });

  it('com Turnstile obrigatório: sem token ou token ruim → 428; token bom passa', async () => {
    const { cliente, turnstileChamadas } = criarContexto({}, comEnv({ TURNSTILE_OBRIGATORIO: 'true' }));
    const corpo = await corpoCadastroAluno(cliente);
    const sem = await cliente.post('/cadastro/aluno', corpo);
    expect(sem.status).toBe(428);
    expect(sem.corpo.error.code).toBe('DESAFIO_REQUERIDO');
    expect((await cliente.post('/cadastro/aluno', { ...corpo, turnstileToken: 'ruim' })).status).toBe(428);
    expect(await contar('usuarios')).toBe(0);
    const ok = await cliente.post('/cadastro/aluno', { ...corpo, turnstileToken: 'ok' });
    expect(ok.status).toBe(201);
    expect(turnstileChamadas).toEqual(['ruim', 'ok']);
  });

  it('limita cadastros por IP (60/h) com 429', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente, { apelidoToken: 'y'.repeat(60) });
    for (let i = 0; i < 60; i++) expect((await cliente.post('/cadastro/aluno', corpo)).status).toBe(400);
    const r = await cliente.post('/cadastro/aluno', corpo);
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('POST /cadastro/aluno — idempotência', () => {
  it('repetir a mesma chave e corpo devolve a mesma conta, sem duplicar nem reenviar e-mail', async () => {
    const { cliente, emails } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    const chave = crypto.randomUUID();
    const a = await cliente.post('/cadastro/aluno', corpo, { idempotencia: chave });
    const b = await cliente.post('/cadastro/aluno', corpo, { idempotencia: chave });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get('Idempotent-Replayed')).toBe('true');
    expect(b.corpo.data.usuario).toEqual(a.corpo.data.usuario);
    expect(await contar('usuarios')).toBe(1);
    expect(emails.filter(m => m.tipo === 'E1')).toHaveLength(1);
    // a resposta guardada tem só IDs: nada de e-mail ou apelido no banco de chaves (RQ-30)
    expect(JSON.stringify(await todos('SELECT * FROM idempotency_keys'))).not.toMatch(/@|example\.test/);
  });

  it('mesma chave com corpo diferente → 409 IDEMPOTENCY_CONFLICT', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    const chave = crypto.randomUUID();
    expect((await cliente.post('/cadastro/aluno', corpo, { idempotencia: chave })).status).toBe(201);
    const r = await cliente.post('/cadastro/aluno', { ...corpo, anoEscolar: 'EF6' }, { idempotencia: chave });
    expect(r.status).toBe(409);
    expect(r.corpo.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await contar('usuarios')).toBe(1);
  });

  it('erro de validação libera a chave: o formulário corrigido pode reutilizá-la', async () => {
    const { cliente } = criarContexto();
    const corpo = await corpoCadastroAluno(cliente);
    const chave = crypto.randomUUID();
    expect((await cliente.post('/cadastro/aluno', { ...corpo, senha: 'password1' }, { idempotencia: chave })).status).toBe(400);
    expect((await cliente.post('/cadastro/aluno', corpo, { idempotencia: chave })).status).toBe(201);
  });
});

describe('POST /cadastro/aluno — conflitos e e-mail já cadastrado (DC-05)', () => {
  it('apelido ocupado numa corrida → 409 CONFLICT APELIDO_EM_USO', async () => {
    const { cliente } = criarContexto();
    const { apelido, apelidoToken } = await sortearApelido(cliente);
    const base = { apelidoToken, nascimento: '2014-05', anoEscolar: 'EF5', senha: SENHA_TESTE, aviso: AVISO_ALUNO };
    expect((await cliente.post('/cadastro/aluno', { ...base, email: emailFicticio('a') })).status).toBe(201);
    const outro = cliente.novoNavegador();
    const r = await outro.post('/cadastro/aluno', { ...base, email: emailFicticio('b') });
    expect(r.status).toBe(409);
    expect(r.corpo.error).toMatchObject({ code: 'CONFLICT', details: [{ path: 'apelidoToken', code: 'APELIDO_EM_USO' }] });
    expect(await contar('usuarios')).toBe(1);
    expect(apelido).toBeTruthy();
  });

  it('e-mail de aluno ≥18 já existente: resposta igual à de sucesso, nenhuma conta nova, aviso ao dono', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('dono');
    const real = await cadastrarAluno(cliente, { nascimento: NASCIMENTO_MAIOR, email });
    expect(real.r.status).toBe(201);

    const intruso = cliente.novoNavegador();
    const isca = await cadastrarAluno(intruso, { nascimento: NASCIMENTO_MAIOR, email });
    expect(isca.r.status).toBe(201);
    // mesma forma de resposta e mesmos tipos de campo (nada a distinguir)
    expect(Object.keys(isca.r.corpo.data).sort()).toEqual(Object.keys(real.r.corpo.data).sort());
    expect(isca.r.corpo.data.status).toBe('pendente_email');
    expect(isca.r.corpo.data.pendencia.emailMascarado).toBe(real.r.corpo.data.pendencia.emailMascarado);
    expect(isca.r.headers.get('Set-Cookie')).toMatch(/^__Host-sid=/);
    expect(await contar('usuarios')).toBe(1);
    expect(ultimoEmail(emails, 'E6')?.para).toBe(email);
    expect(emails.filter(m => m.tipo === 'E3')).toHaveLength(1); // só o do cadastro real

    // a sessão isca se comporta como pendente: /me responde, reenvio e correção "dão certo" sem efeito
    const me = await intruso.get('/me');
    expect(me.status).toBe(200);
    expect(me.corpo.data).toMatchObject({ status: 'pendente_email', escopoSessao: 'pendente', papeis: [] });
    expect((await intruso.post('/cadastro/pendencia/reenvio')).status).toBe(202);
    expect((await intruso.put('/cadastro/pendencia/email', { email: emailFicticio('novo') })).status).toBe(200);
    expect(emails.filter(m => m.tipo === 'E3')).toHaveLength(1);
    expect(await contar('usuarios')).toBe(1);
  });

  it('não vira canal de spam: o aviso ao dono sai no máximo 3 vezes por dia', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('vitima');
    await cadastrarAluno(cliente, { nascimento: NASCIMENTO_MAIOR, email });
    for (let i = 0; i < 5; i++) await cadastrarAluno(cliente.novoNavegador(), { nascimento: NASCIMENTO_MAIOR, email });
    expect(emails.filter(m => m.tipo === 'E6')).toHaveLength(3);
  });
});
