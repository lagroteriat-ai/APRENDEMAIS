import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { servidor } from '../mocks/servidor';
import { criarCliente } from './cliente';

const URL = (caminho: string) => `*/api/v1${caminho}`;
const MESMO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('cliente tipado', () => {
  it('chama a rota do contrato e devolve `data` já validado', async () => {
    const r = await criarCliente().chamar('obterAvisosVigentes');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe(200);
      expect(r.data.aluno.versao).toMatch(/^aluno-/);
      expect(r.requestId).toBeTruthy();
    }
  });

  it('envia o corpo como JSON e NÃO manda Idempotency-Key onde o contrato não pede', async () => {
    let cabecalho: string | null = 'não chamou';
    let corpo: unknown;
    servidor.use(
      http.post(URL('/sessoes'), async ({ request }) => {
        cabecalho = request.headers.get('Idempotency-Key');
        corpo = await request.json();
        return HttpResponse.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 });
      }),
    );
    await criarCliente().chamar('entrar', { corpo: { identificador: 'LeaoAzul42', senha: 'abc' } });
    expect(cabecalho).toBeNull();
    expect(corpo).toEqual({ identificador: 'LeaoAzul42', senha: 'abc' });
  });

  it('gera Idempotency-Key (UUID v4) nas operações idempotentes e respeita a chave informada', async () => {
    const chaves: Array<string | null> = [];
    servidor.use(
      http.post(URL('/cadastro/aluno'), ({ request }) => {
        chaves.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json({ ok: false, error: { code: 'INTERNAL', message: 'x' } }, { status: 500 });
      }),
    );
    const corpo = {
      apelidoToken: 'a'.repeat(40), nascimento: '2014-05', anoEscolar: 'EF5' as const,
      email: 'resp@example.test', senha: 'Senha-de-Teste-123', aviso: { versao: 'v1' },
    };
    const api = criarCliente();
    await api.chamar('cadastrarAluno', { corpo });
    await api.chamar('cadastrarAluno', { corpo, chave: 'minha-chave' });
    expect(chaves[0]).toMatch(MESMO_UUID);
    expect(chaves[1]).toBe('minha-chave');
  });

  it('traduz erro do contrato: código, campos, X-Request-Id e Retry-After', async () => {
    servidor.use(
      http.post(URL('/recuperacao'), () =>
        HttpResponse.json(
          { ok: false, error: { code: 'RATE_LIMITED', message: 'Muitas tentativas.', details: [{ path: 'identificador', code: 'FORMATO_INVALIDO' }] } },
          { status: 429, headers: { 'X-Request-Id': '01JREQ', 'Retry-After': '60' } },
        ),
      ),
    );
    const r = await criarCliente().chamar('solicitarRecuperacao', { corpo: { identificador: 'abc' } });
    expect(r).toMatchObject({
      ok: false, status: 429, code: 'RATE_LIMITED', requestId: '01JREQ', retryAfter: 60,
      details: [{ path: 'identificador', code: 'FORMATO_INVALIDO' }],
    });
  });

  it('sem conexão vira REDE (sem lançar exceção)', async () => {
    servidor.use(http.get(URL('/me'), () => HttpResponse.error()));
    const r = await criarCliente().chamar('obterMe');
    expect(r).toMatchObject({ ok: false, code: 'REDE', status: 0 });
  });

  it('tempo esgotado também vira REDE', async () => {
    servidor.use(
      http.get(URL('/me'), async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({});
      }),
    );
    const r = await criarCliente({ timeoutMs: 20 }).chamar('obterMe');
    expect(r).toMatchObject({ ok: false, code: 'REDE' });
  });

  it('resposta de sucesso fora do contrato vira CONTRATO (e não vaza dado ao app)', async () => {
    servidor.use(http.get(URL('/me'), () => HttpResponse.json({ ok: true, data: { id: 'não-é-ulid' } })));
    const r = await criarCliente().chamar('obterMe');
    expect(r).toMatchObject({ ok: false, code: 'CONTRATO' });
  });

  it('erro sem o envelope do contrato vira INTERNAL', async () => {
    servidor.use(http.get(URL('/me'), () => new HttpResponse('<html>502</html>', { status: 502 })));
    const r = await criarCliente().chamar('obterMe');
    expect(r).toMatchObject({ ok: false, code: 'INTERNAL', status: 502 });
  });
});
