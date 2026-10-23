import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ConsultaRecuperacao } from '@aprendemais/shared-types';
import { Button, Card, Stack } from '@aprendemais/ui';
import type { ErroApi } from '../api/cliente';
import { MSG, errosDeCampo, mensagemGeral } from '../api/mensagens';
import { CampoSenha } from '../componentes/CampoSenha';
import { Carregando, ErroDeChamada } from '../componentes/Estados';
import { ResumoDeErros } from '../componentes/ResumoDeErros';
import { TelaPublica } from '../componentes/TelaPublica';
import { Subtitulo, Titulo, useTokenDeLink } from '../componentes/Titulo';
import { useApi } from '../estado/api';
import { validarSenhaNova } from '../lib/validacao';
import { ROTAS } from '../rotas';

type Fase =
  | { nome: 'carregando' }
  | { nome: 'formulario'; consulta: ConsultaRecuperacao }
  | { nome: 'invalido' }
  | { nome: 'erro'; erro: ErroApi };

/** T10 — nova senha, via link de uso único (30 min). Vale para o aluno menor, que a recebe pelo responsável (DU-03). */
export function NovaSenha() {
  const api = useApi();
  const navegar = useNavigate();
  const token = useTokenDeLink();
  const [fase, setFase] = useState<Fase>({ nome: 'carregando' });
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string>();
  const [geral, setGeral] = useState<string>();
  const [foco, setFoco] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const consultou = useRef(false);

  const consultar = useCallback(async () => {
    if (!token) return setFase({ nome: 'invalido' });
    setFase({ nome: 'carregando' });
    const r = await api.chamar('consultarRecuperacao', { corpo: { token } });
    if (r.ok) return setFase({ nome: 'formulario', consulta: r.data });
    setFase(r.code === 'TOKEN_INVALIDO' ? { nome: 'invalido' } : { nome: 'erro', erro: r });
  }, [api, token]);

  useEffect(() => {
    if (consultou.current) return;
    consultou.current = true;
    void consultar();
  }, [consultar]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || !token) return;
    const e = validarSenhaNova(senha, 'novaSenha');
    setErro(e);
    setGeral(undefined);
    if (e) return setFoco((n) => n + 1);

    setEnviando(true);
    const r = await api.chamar('definirNovaSenha', { corpo: { token, novaSenha: senha } });
    setEnviando(false);
    if (r.ok) return navegar(ROTAS.entrar, { replace: true, state: { senhaAlterada: true } });
    if (r.code === 'TOKEN_INVALIDO') return setFase({ nome: 'invalido' });
    if (r.code === 'VALIDATION_ERROR' && r.details.length) setErro(errosDeCampo(r).novaSenha ?? MSG.camposParaCorrigir);
    else setGeral(mensagemGeral(r));
    setFoco((n) => n + 1);
  }

  if (fase.nome === 'carregando') {
    return (
      <TelaPublica>
        <Titulo>Criar nova senha</Titulo>
        <Carregando />
      </TelaPublica>
    );
  }
  if (fase.nome === 'erro') {
    return (
      <TelaPublica>
        <Titulo>Criar nova senha</Titulo>
        <ErroDeChamada erro={fase.erro} aoTentar={() => void consultar()} />
      </TelaPublica>
    );
  }
  if (fase.nome === 'invalido') {
    return (
      <TelaPublica>
        <Card as="section" aria-label="Link inválido ou expirado">
          <Stack gap={4}>
            <Titulo>Este link não funciona</Titulo>
            <p>Ele pode ter expirado ou já ter sido usado.</p>
            <Link className="am-btn" to={ROTAS.recuperar}>
              Pedir outro link
            </Link>
          </Stack>
        </Card>
      </TelaPublica>
    );
  }

  const { apelido } = fase.consulta;
  return (
    <TelaPublica>
      <Stack gap={2}>
        <Titulo>Criar nova senha</Titulo>
        {apelido && <Subtitulo>Para {apelido}</Subtitulo>}
      </Stack>
      <form onSubmit={enviar} noValidate>
        <Stack gap={5}>
          {(erro || geral) && (
            <ResumoDeErros
              titulo={geral ?? MSG.camposParaCorrigir}
              erros={erro ? [{ id: 'campo-nova-senha', mensagem: erro }] : []}
              foco={foco}
            />
          )}
          <CampoSenha
            id="campo-nova-senha"
            label="Nova senha"
            value={senha}
            onChange={(v) => {
              setSenha(v);
              setErro(undefined);
            }}
            autoComplete="new-password"
            ajuda="Mínimo de 8 caracteres."
            erro={erro}
            required
            sugerir
          />
          <Button type="submit" size="lg" fullWidth loading={enviando} loadingText="Salvando…">
            Salvar nova senha
          </Button>
          {apelido && <p>Anote a senha e conte para {apelido}.</p>}
        </Stack>
      </form>
    </TelaPublica>
  );
}
