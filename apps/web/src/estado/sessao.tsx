import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Me } from '@aprendemais/shared-types';
import type { ErroApi } from '../api/cliente';
import { useApi } from './api';

/** Sessão no cliente: só o que `GET /me` devolve. O cookie é HttpOnly; o papel vem do servidor (RQ-35). */
export type EstadoSessao =
  | { fase: 'desconhecida' }
  /** Sem sessão (401): o texto certo é "Sua sessão acabou". */
  | { fase: 'anonima' }
  /** A própria pessoa saiu: vai ao login sem aviso de sessão expirada. */
  | { fase: 'encerrada' }
  | { fase: 'ativa'; me: Me }
  | { fase: 'erro'; erro: ErroApi };

interface SessaoCtx {
  estado: EstadoSessao;
  /** Consulta `/me` (junta chamadas simultâneas). 401 → anônima. */
  carregar: () => Promise<EstadoSessao>;
  /** Usa um `Me` já recebido (login, troca de papel) sem nova chamada. */
  definirMe: (me: Me) => void;
  /** Encerra a sessão no servidor e limpa o estado (mesmo se a rede falhar). */
  sair: () => Promise<void>;
}

const Ctx = createContext<SessaoCtx | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [estado, setEstado] = useState<EstadoSessao>({ fase: 'desconhecida' });
  const emAndamento = useRef<Promise<EstadoSessao> | null>(null);

  const carregar = useCallback(() => {
    emAndamento.current ??= api
      .chamar('obterMe')
      .then((r): EstadoSessao => {
        if (r.ok) return { fase: 'ativa', me: r.data };
        return r.code === 'UNAUTHENTICATED' ? { fase: 'anonima' } : { fase: 'erro', erro: r };
      })
      .then((novo) => {
        setEstado(novo);
        return novo;
      })
      .finally(() => {
        emAndamento.current = null;
      });
    return emAndamento.current;
  }, [api]);

  const definirMe = useCallback((me: Me) => setEstado({ fase: 'ativa', me }), []);

  const sair = useCallback(async () => {
    await api.chamar('sair');
    setEstado({ fase: 'encerrada' });
  }, [api]);

  const valor = useMemo(() => ({ estado, carregar, definirMe, sair }), [estado, carregar, definirMe, sair]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): SessaoCtx {
  const valor = useContext(Ctx);
  if (!valor) throw new Error('useSessao fora do SessaoProvider');
  return valor;
}
