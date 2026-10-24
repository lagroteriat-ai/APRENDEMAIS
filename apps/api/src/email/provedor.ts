import type { Env } from '../env';
import { ulid } from '../lib/ids';
import type { MensagemEmail } from '../tipos';

// Provedor de e-mail abstraído. A API só conhece `ProvedorEmail`; a escolha do serviço real é a PEN-047 (DEV).
// Para ligar um provedor: implemente `ProvedorEmail` (ex.: POST HTTP com a chave em um secret) e devolva-o em `criarProvedorEmail`.

export interface ProvedorEmail {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

const PREFIXO_CAIXA = 'outbox:';
const TTL_CAIXA_SEG = 3600;

/**
 * Implementação falsa para dev/teste/staging: não envia nada, grava a mensagem (com o link e o token) numa "caixa de saída"
 * no KV por 1 h. Em dev o endpoint `GET /api/v1/dev/outbox` a expõe; nunca é usada em produção.
 */
export class ProvedorEmailFake implements ProvedorEmail {
  constructor(private readonly kv: KVNamespace) {}

  async enviar(mensagem: MensagemEmail): Promise<void> {
    await this.kv.put(`${PREFIXO_CAIXA}${ulid()}`, JSON.stringify(mensagem), { expirationTtl: TTL_CAIXA_SEG });
  }

  async listar(para?: string): Promise<MensagemEmail[]> {
    const { keys } = await this.kv.list({ prefix: PREFIXO_CAIXA });
    const itens: MensagemEmail[] = [];
    for (const k of keys) {
      const bruto = await this.kv.get(k.name);
      if (!bruto) continue;
      const m = JSON.parse(bruto) as MensagemEmail;
      if (!para || m.para.toLowerCase() === para.toLowerCase()) itens.push(m);
    }
    return itens;
  }
}

/** Produção sem provedor contratado: o fluxo segue, mas só registra o evento (sem destinatário, assunto nem link: RQ-30). */
export class ProvedorEmailNaoConfigurado implements ProvedorEmail {
  async enviar(mensagem: MensagemEmail): Promise<void> {
    console.error(JSON.stringify({ evento: 'email_provedor_nao_configurado', tipo: mensagem.tipo }));
  }
}

export function criarProvedorEmail(env: Env): ProvedorEmail {
  return env.ENVIRONMENT === 'production' ? new ProvedorEmailNaoConfigurado() : new ProvedorEmailFake(env.KV);
}
