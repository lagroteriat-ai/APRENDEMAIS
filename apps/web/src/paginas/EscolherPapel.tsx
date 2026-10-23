import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { Papel } from '@aprendemais/shared-types';
import { Alert, Stack } from '@aprendemais/ui';
import { mensagemGeral } from '../api/mensagens';
import { Carregando } from '../componentes/Estados';
import { TelaPublica } from '../componentes/TelaPublica';
import { Titulo } from '../componentes/Titulo';
import { useApi } from '../estado/api';
import { useSessao } from '../estado/sessao';
import { ROTAS, inicioDoPapel } from '../rotas';

const ROTULO: Record<Papel, string> = {
  aluno: 'Aluno',
  responsavel: 'Responsável',
  professor: 'Professor',
  gestor: 'Gestor',
  admin: 'Administrador',
};

/** T15 — escolher papel (quem tem mais de um). O papel ativo fica na sessão do servidor, nunca no cookie. */
export function EscolherPapel() {
  const api = useApi();
  const navegar = useNavigate();
  const { estado, carregar, definirMe } = useSessao();
  const [erro, setErro] = useState<string>();
  const [escolhendo, setEscolhendo] = useState<Papel>();

  useEffect(() => {
    if (estado.fase === 'desconhecida') void carregar();
  }, [estado.fase, carregar]);

  if (estado.fase === 'desconhecida') {
    return (
      <TelaPublica>
        <Titulo>Como você quer entrar?</Titulo>
        <Carregando />
      </TelaPublica>
    );
  }
  if (estado.fase === 'encerrada') return <Navigate to={ROTAS.entrar} replace />;
  if (estado.fase !== 'ativa') return <Navigate to={ROTAS.sessaoExpirada} replace />;
  if (estado.me.papeis.length < 2 && estado.me.papelAtivo) return <Navigate to={inicioDoPapel(estado.me.papelAtivo)} replace />;

  async function escolher(papel: Papel) {
    setEscolhendo(papel);
    setErro(undefined);
    const r = await api.chamar('escolherPapel', { corpo: { papel } });
    setEscolhendo(undefined);
    if (r.ok) {
      definirMe(r.data);
      return navegar(inicioDoPapel(r.data.papelAtivo), { replace: true });
    }
    setErro(mensagemGeral(r));
  }

  return (
    <TelaPublica>
      <Titulo>Como você quer entrar?</Titulo>
      {erro && <Alert variant="error" title={erro} />}
      <Stack as="ul" gap={3} className="web-lista-sem-marcador">
        {estado.me.papeis.map((papel) => (
          <li key={papel}>
            <button
              type="button"
              className="web-cartao-acao"
              aria-disabled={escolhendo !== undefined || undefined}
              onClick={() => (escolhendo ? undefined : void escolher(papel))}
            >
              <span>{escolhendo === papel ? 'Entrando…' : ROTULO[papel]}</span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </Stack>
    </TelaPublica>
  );
}
