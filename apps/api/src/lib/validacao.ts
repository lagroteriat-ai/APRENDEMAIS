import type { CampoErro, CodigoCampo } from '@aprendemais/shared-types';
import type { z } from 'zod';
import { ErroApp, validacao } from './http';

function valorEm(corpo: unknown, caminho: PropertyKey[]): unknown {
  let atual: unknown = corpo;
  for (const chave of caminho) {
    if (atual === null || typeof atual !== 'object') return undefined;
    atual = (atual as Record<PropertyKey, unknown>)[chave];
  }
  return atual;
}

function codigoDoCampo(raiz: string, tipo: string): CodigoCampo {
  switch (raiz) {
    case 'apelidoToken': return 'APELIDO_INVALIDO';
    case 'nascimento': return 'NASCIMENTO_INVALIDO';
    case 'anoEscolar': return 'ANO_ESCOLAR_INVALIDO';
    case 'email': return 'EMAIL_INVALIDO';
    case 'senha':
    case 'novaSenha':
      return tipo === 'too_small' ? 'SENHA_CURTA' : tipo === 'too_big' ? 'SENHA_LONGA' : 'FORMATO_INVALIDO';
    case 'nome':
    case 'nomeResponsavel': return 'NOME_INVALIDO';
    case 'declaracao': return 'DECLARACAO_OBRIGATORIA';
    case 'papel': return 'PAPEL_INVALIDO';
    default: return 'FORMATO_INVALIDO';
  }
}

/** Converte os problemas do Zod em `details[]` sem ecoar nenhum valor recebido (RQ-32, RQ-30). */
export function detalhesDoZod(erro: z.ZodError, corpo: unknown): CampoErro[] {
  const vistos = new Set<string>();
  const detalhes: CampoErro[] = [];
  const adicionar = (path: string, code: CodigoCampo): void => {
    const k = `${path}|${code}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    detalhes.push({ path, code });
  };
  for (const issue of erro.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const chave of issue.keys) adicionar([...issue.path, chave].map(String).join('.'), 'FORMATO_INVALIDO');
      continue;
    }
    const caminho = issue.path.map(String).join('.');
    if (valorEm(corpo, issue.path) === undefined) {
      adicionar(caminho, 'OBRIGATORIO');
      continue;
    }
    adicionar(caminho, codigoDoCampo(String(issue.path[0] ?? ''), issue.code));
  }
  return detalhes;
}

/** Valida o corpo; `token` malformado vira `TOKEN_INVALIDO` (mesma resposta de token vencido). */
export function validarComSchema<S extends z.ZodType>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo);
  if (r.success) return r.data;
  const detalhes = detalhesDoZod(r.error, corpo);
  const soToken = detalhes.length > 0 && detalhes.every(d => d.path === 'token' && d.code !== 'OBRIGATORIO');
  if (soToken) throw new ErroApp('TOKEN_INVALIDO');
  throw validacao(detalhes);
}
