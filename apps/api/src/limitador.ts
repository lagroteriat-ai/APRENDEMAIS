import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

interface Janela {
  /** Eventos contados na janela atual. */
  n: number;
  /** Fim da janela (epoch ms). */
  ate: number;
}

export interface EstadoLimite {
  contagem: number;
  /** Segundos até a janela reiniciar (0 se não há janela ativa). */
  reiniciaEmSeg: number;
}

/**
 * Contador atômico por chave (1 instância por chave). Janela fixa que começa no 1º evento.
 * O relógio vem do chamador (`agoraMs`), o que torna os testes determinísticos. Sem PII: a chave já chega com HMAC.
 */
export class Limitador extends DurableObject<Env> {
  async registrar(janelaSeg: number, agoraMs: number): Promise<EstadoLimite> {
    let j = await this.ctx.storage.get<Janela>('j');
    if (!j || j.ate <= agoraMs) {
      j = { n: 0, ate: agoraMs + janelaSeg * 1000 };
      // SEM_ALARME_LIMITADOR (só nos testes, que congelam o relógio e fariam o alarme disparar na hora)
      if (!this.env.SEM_ALARME_LIMITADOR) await this.ctx.storage.setAlarm(j.ate + 1000);
    }
    j.n += 1;
    await this.ctx.storage.put('j', j);
    return estado(j, agoraMs);
  }

  async consultar(agoraMs: number): Promise<EstadoLimite> {
    const j = await this.ctx.storage.get<Janela>('j');
    if (!j || j.ate <= agoraMs) return { contagem: 0, reiniciaEmSeg: 0 };
    return estado(j, agoraMs);
  }

  async zerar(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  /** Limpeza depois que a janela venceu (um DO por chave não pode ficar para sempre no armazenamento). */
  async alarm(): Promise<void> {
    const j = await this.ctx.storage.get<Janela>('j');
    if (!j || j.ate <= Date.now()) await this.ctx.storage.deleteAll();
  }
}

function estado(j: Janela, agoraMs: number): EstadoLimite {
  return { contagem: j.n, reiniciaEmSeg: Math.max(1, Math.ceil((j.ate - agoraMs) / 1000)) };
}
