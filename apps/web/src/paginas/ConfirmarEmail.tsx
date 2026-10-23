import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Card, Stack } from '@aprendemais/ui';
import type { ErroApi } from '../api/cliente';
import { Carregando, ErroDeChamada } from '../componentes/Estados';
import { TelaPublica } from '../componentes/TelaPublica';
import { Titulo, useTokenDeLink } from '../componentes/Titulo';
import { useApi } from '../estado/api';
import { ROTAS } from '../rotas';

type Fase = 'carregando' | 'confirmado' | 'invalido' | ErroApi;

/** T12 — confirma o e-mail (aluno 18+ e professor). O link é de uso único: a chamada acontece uma só vez. */
export function ConfirmarEmail() {
  const api = useApi();
  const token = useTokenDeLink();
  const [fase, setFase] = useState<Fase>('carregando');
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return; // StrictMode roda o efeito 2x; o token só pode ser gasto 1x
    iniciou.current = true;
    if (!token) return setFase('invalido');
    void api.chamar('confirmarEmail', { corpo: { token } }).then((r) => {
      if (r.ok) setFase('confirmado');
      else setFase(r.code === 'TOKEN_INVALIDO' ? 'invalido' : r);
    });
  }, [api, token]);

  if (fase === 'carregando') {
    return (
      <TelaPublica>
        <Titulo abaTitulo="Confirmar e-mail">Confirmando seu e-mail</Titulo>
        <Carregando />
      </TelaPublica>
    );
  }
  if (typeof fase === 'object') {
    return (
      <TelaPublica>
        <Titulo abaTitulo="Confirmar e-mail">Confirmando seu e-mail</Titulo>
        <ErroDeChamada erro={fase} />
      </TelaPublica>
    );
  }
  return (
    <TelaPublica>
      <Card as="section" aria-label={fase === 'confirmado' ? 'E-mail confirmado' : 'Link inválido'}>
        <Stack gap={4}>
          {fase === 'confirmado' ? (
            <>
              <Titulo>E-mail confirmado</Titulo>
              <p>Sua conta está ativa.</p>
              <Link className="am-btn" to={ROTAS.entrar}>
                Entrar
              </Link>
            </>
          ) : (
            <>
              <Titulo>Este link não funciona</Titulo>
              <p>Peça um novo link.</p>
              <Link className="am-btn" to={ROTAS.aguardando}>
                Reenviar link
              </Link>
            </>
          )}
        </Stack>
      </Card>
    </TelaPublica>
  );
}
