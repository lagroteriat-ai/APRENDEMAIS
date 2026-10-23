import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Button, FormField, Input, Stack } from '@aprendemais/ui';
import { MSG, errosDeCampo, mensagemGeral } from '../api/mensagens';
import { CampoSenha } from '../componentes/CampoSenha';
import { Desafio } from '../componentes/Desafio';
import { ResumoDeErros, type ErroDeCampo } from '../componentes/ResumoDeErros';
import { TelaPublica } from '../componentes/TelaPublica';
import { Subtitulo, Titulo } from '../componentes/Titulo';
import { useApi } from '../estado/api';
import { useSessao } from '../estado/sessao';
import { validarIdentificador, validarSenhaLogin } from '../lib/validacao';
import { ROTAS, destinoDaSessao } from '../rotas';

interface EstadoDaRota {
  senhaAlterada?: boolean;
  /** Rota a retomar depois do login (vinda de "sua sessão acabou"). */
  de?: string;
}

/** T01 — Entrar. */
export function Entrar() {
  const api = useApi();
  const { definirMe } = useSessao();
  const navegar = useNavigate();
  const estadoRota = (useLocation().state ?? {}) as EstadoDaRota;

  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [foco, setFoco] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [exigeDesafio, setExigeDesafio] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const envio = useRef(false);

  function falhou(novosErros: Record<string, string>, mensagem?: string, id?: string) {
    setErros(novosErros);
    setGeral(mensagem);
    setRequestId(id);
    setFoco((n) => n + 1);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (envio.current) return;

    const locais: Record<string, string> = {};
    const ei = validarIdentificador(identificador);
    const es = validarSenhaLogin(senha);
    if (ei) locais.identificador = ei;
    if (es) locais.senha = es;
    if (Object.keys(locais).length > 0) return falhou(locais);

    envio.current = true;
    setEnviando(true);
    setErros({});
    setGeral(undefined);
    const r = await api.chamar('entrar', {
      corpo: { identificador: identificador.trim(), senha, ...(turnstileToken ? { turnstileToken } : {}) },
    });
    envio.current = false;
    setEnviando(false);

    if (r.ok) {
      if (r.data.me) definirMe(r.data.me);
      if (r.data.status === 'suspensa_exclusao' || !r.data.me) return navegar(ROTAS.emExclusao, { replace: true });
      const destino = r.data.status === 'ativa' && estadoRota.de ? estadoRota.de : destinoDaSessao(r.data.me);
      return navegar(destino, { replace: true });
    }

    setTurnstileToken(undefined);
    switch (r.code) {
      case 'UNAUTHENTICATED':
        return falhou({}, MSG.loginInvalido, r.requestId);
      case 'DESAFIO_REQUERIDO':
        setExigeDesafio(true);
        return falhou({}, MSG.desafio);
      case 'VALIDATION_ERROR': {
        const doServidor = errosDeCampo(r);
        return falhou(doServidor, Object.keys(doServidor).length ? undefined : mensagemGeral(r), r.requestId);
      }
      default:
        return falhou({}, mensagemGeral(r), r.code === 'INTERNAL' || r.code === 'CONTRATO' ? r.requestId : undefined);
    }
  }

  const lista: ErroDeCampo[] = [
    ...(erros.identificador ? [{ id: 'campo-identificador', mensagem: erros.identificador }] : []),
    ...(erros.senha ? [{ id: 'campo-senha', mensagem: erros.senha }] : []),
  ];

  return (
    <TelaPublica
      rodape={
        <Stack gap={3}>
          <hr className="web-separador" />
          <p>Primeira vez aqui?</p>
          <Link className="am-btn am-btn--secondary am-btn--full" to={ROTAS.cadastro}>
            Criar conta de aluno
          </Link>
        </Stack>
      }
    >
      <Stack gap={2}>
        <Titulo>Entrar</Titulo>
        <Subtitulo>Use seu apelido ou e-mail.</Subtitulo>
      </Stack>

      {estadoRota.senhaAlterada && (
        <Alert variant="success" title="Senha alterada.">
          Entre com a nova senha.
        </Alert>
      )}

      <form onSubmit={enviar} noValidate>
        <Stack gap={5}>
          {(geral || lista.length > 0) && (
            <ResumoDeErros titulo={geral ?? MSG.camposParaCorrigir} erros={lista} foco={foco}>
              {geral === MSG.limite && (
                <p>
                  Se você esqueceu a senha, <Link to={ROTAS.recuperar}>recupere seu acesso</Link>.
                </p>
              )}
              {requestId && <p>Código para o suporte: {requestId}</p>}
            </ResumoDeErros>
          )}
          <FormField id="campo-identificador" label="Usuário ou e-mail" error={erros.identificador}>
            <Input
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
            />
          </FormField>
          <CampoSenha
            id="campo-senha"
            label="Senha"
            value={senha}
            onChange={setSenha}
            autoComplete="current-password"
            erro={erros.senha}
          />
          {exigeDesafio && <Desafio onToken={setTurnstileToken} />}
          <Button type="submit" size="lg" fullWidth loading={enviando} loadingText="Entrando…">
            Entrar
          </Button>
          <p>
            <Link to={ROTAS.recuperar}>Esqueci minha senha</Link>
          </p>
        </Stack>
      </form>
    </TelaPublica>
  );
}
