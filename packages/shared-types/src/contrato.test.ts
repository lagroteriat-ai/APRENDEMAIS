import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  ANOS_ESCOLARES,
  CODIGOS_CAMPO,
  CODIGOS_ERRO,
  OPERACOES_AUTH,
  PAPEIS,
  STATUS_CONTA,
  STATUS_HTTP_POR_CODIGO,
  erroRespostaSchema
} from './index.js';

// Garante que apps/api/openapi/auth.yaml e os schemas Zod não divergem (contrato S1-BE-02).

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const caminho = fileURLToPath(new URL('../../../apps/api/openapi/auth.yaml', import.meta.url));
const doc: Json = parse(readFileSync(caminho, 'utf8'));
const resolver = (o: Json): Json =>
  o?.$ref ? (o.$ref as string).split('/').slice(1).reduce((a: Json, k: string) => a[k], doc) : o;
const exemplos = (media: Json): unknown[] =>
  media?.examples
    ? Object.values<Json>(media.examples).map(e => e.value)
    : media?.example !== undefined
      ? [media.example]
      : [];

const operacoes = Object.entries<Json>(doc.paths).flatMap(([rota, item]) =>
  Object.entries<Json>(item).map(([metodo, op]) => ({ rota, metodo: metodo.toUpperCase(), op }))
);

describe('contrato auth.yaml × shared-types', () => {
  it('tem as mesmas operações, métodos, caminhos, acessos e idempotência', () => {
    expect(operacoes.map(o => o.op.operationId).sort()).toEqual(Object.keys(OPERACOES_AUTH).sort());
    for (const { rota, metodo, op } of operacoes) {
      const reg = OPERACOES_AUTH[op.operationId as keyof typeof OPERACOES_AUTH];
      expect({ metodo: reg.metodo, caminho: reg.caminho, acesso: reg.acesso }).toEqual({
        metodo,
        caminho: rota,
        acesso: op['x-acesso']
      });
      const exigeChave = (op.parameters ?? []).some((p: Json) => resolver(p).name === 'Idempotency-Key');
      expect(exigeChave, op.operationId).toBe(reg.idempotente);
      expect(op.responses[String(reg.sucesso)], `${op.operationId} sucesso`).toBeDefined();
    }
  });

  it('exemplos de requisição e resposta passam nos schemas', () => {
    let total = 0;
    for (const { op } of operacoes) {
      const reg = OPERACOES_AUTH[op.operationId as keyof typeof OPERACOES_AUTH];
      for (const ex of exemplos(op.requestBody?.content?.['application/json'])) {
        total++;
        expect('corpo' in reg ? reg.corpo.safeParse(ex).success : false, `${op.operationId} corpo`).toBe(true);
      }
      for (const [status, resposta] of Object.entries<Json>(op.responses)) {
        const sucesso = status === String(reg.sucesso);
        for (const ex of exemplos(resolver(resposta).content?.['application/json'])) {
          total++;
          const r = (sucesso ? reg.resposta : erroRespostaSchema).safeParse(ex);
          expect(r.success, `${op.operationId} ${status}`).toBe(true);
          if (!sucesso) {
            const code = (ex as Json).error.code as keyof typeof STATUS_HTTP_POR_CODIGO;
            expect(STATUS_HTTP_POR_CODIGO[code], `${op.operationId} ${status} ${code}`).toBe(Number(status));
          }
        }
      }
    }
    expect(total).toBeGreaterThan(100);
  });

  it('enums coincidem', () => {
    const s = doc.components.schemas;
    const ordenado = (v: readonly string[]) => [...v].sort();
    expect(ordenado(CODIGOS_ERRO)).toEqual(ordenado(s.CodigoErro.enum));
    expect(ordenado(CODIGOS_CAMPO)).toEqual(ordenado(s.CodigoCampo.enum));
    expect(ordenado(PAPEIS)).toEqual(ordenado(s.Papel.enum));
    expect(ordenado(STATUS_CONTA)).toEqual(ordenado(s.StatusConta.enum));
    expect(ordenado(ANOS_ESCOLARES)).toEqual(ordenado(s.AnoEscolar.enum));
  });

  it('rejeita campos extras e senha curta (SR-03, SR-10)', () => {
    const { corpo } = OPERACOES_AUTH.cadastrarAluno;
    const base = {
      apelidoToken: 'x'.repeat(40),
      nascimento: '2014-05',
      anoEscolar: 'EF5',
      email: 'a@b.co',
      senha: 'bola-nuvem-sete',
      aviso: { versao: 'v1' }
    };
    expect(corpo.safeParse(base).success).toBe(true);
    expect(corpo.safeParse({ ...base, papel: 'admin' }).success).toBe(false);
    expect(corpo.safeParse({ ...base, senha: '1234567' }).success).toBe(false);
    expect(corpo.safeParse({ ...base, nascimento: '2999-01' }).success).toBe(false);
  });
});
