import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Me, Papel } from '@aprendemais/shared-types';
import { useSessao } from '../estado/sessao';
import { ROTAS } from '../rotas';
import { Carregando, ErroGeral, SemAcesso } from './Estados';
import { TelaPublica } from './TelaPublica';

interface Props {
  /** Papel ativo exigido. A barreira real é o servidor (RQ-35); aqui só se escolhe a tela certa. */
  papel: Papel;
  children: (me: Me) => ReactNode;
}

/** Guarda das áreas logadas: consulta `/me` e decide entre a tela, o login, a espera ou "sem acesso". */
export function Protegida({ papel, children }: Props) {
  const { estado, carregar } = useSessao();
  const local = useLocation();

  useEffect(() => {
    if (estado.fase === 'desconhecida') void carregar();
  }, [estado.fase, carregar]);

  if (estado.fase === 'desconhecida') {
    return (
      <TelaPublica>
        <Carregando />
      </TelaPublica>
    );
  }
  if (estado.fase === 'encerrada') return <Navigate to={ROTAS.entrar} replace />;
  if (estado.fase === 'anonima') return <Navigate to={ROTAS.sessaoExpirada} replace state={{ de: local.pathname }} />;
  if (estado.fase === 'erro') return <ErroGeral erro={estado.erro} aoTentar={() => void carregar()} />;

  const { me } = estado;
  if (me.status === 'pendente_responsavel' || me.status === 'pendente_email') {
    return <Navigate to={ROTAS.aguardando} replace />;
  }
  if (me.status === 'suspensa_exclusao') return <Navigate to={ROTAS.emExclusao} replace />;
  if (me.papelAtivo === null && me.papeis.length > 1) return <Navigate to={ROTAS.papel} replace />;
  if (me.papelAtivo !== papel) return <SemAcesso />;
  return <>{children(me)}</>;
}
