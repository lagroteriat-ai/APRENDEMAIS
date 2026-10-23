import { useState, type FormEvent } from 'react';
import { Alert, Button, FormField, Input, Stack } from '@aprendemais/ui';
import { MSG, errosDeCampo, mensagemGeral } from '../api/mensagens';
import { Desafio } from '../componentes/Desafio';
import { ResumoDeErros } from '../componentes/ResumoDeErros';
import { TelaPublica } from '../componentes/TelaPublica';
import { Subtitulo, Titulo } from '../componentes/Titulo';
import { useApi } from '../estado/api';
import { validarIdentificador } from '../lib/validacao';
import { ROTAS } from '../rotas';

/** T09 — pedido de recuperação. A resposta é sempre a mesma, exista a conta ou não (DU-06). */
export function Recuperar() {
  const api = useApi();
  const [identificador, setIdentificador] = useState('');
  const [erro, setErro] = useState<string>();
  const [geral, setGeral] = useState<string>();
  const [foco, setFoco] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [exigeDesafio, setExigeDesafio] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    const e = validarIdentificador(identificador);
    setErro(e);
    setGeral(undefined);
    if (e) return setFoco((n) => n + 1);

    setEnviando(true);
    const r = await api.chamar('solicitarRecuperacao', {
      corpo: { identificador: identificador.trim(), ...(turnstileToken ? { turnstileToken } : {}) },
    });
    setEnviando(false);
    if (r.ok) return setEnviado(true);

    setTurnstileToken(undefined);
    if (r.code === 'DESAFIO_REQUERIDO') setExigeDesafio(true);
    if (r.code === 'VALIDATION_ERROR') setErro(errosDeCampo(r).identificador);
    else setGeral(mensagemGeral(r));
    setFoco((n) => n + 1);
  }

  return (
    <TelaPublica voltar={{ rotulo: 'Entrar', para: ROTAS.entrar }}>
      <Stack gap={2}>
        <Titulo>Recuperar acesso</Titulo>
        <Subtitulo>
          Informe seu apelido ou e-mail. Enviaremos um link para o e-mail da conta. Se você é menor de 18 anos, o link
          vai para seu responsável.
        </Subtitulo>
      </Stack>

      <div aria-live="polite">
        {enviado && (
          <Alert variant="success" title="Se existir uma conta, o link já está a caminho.">
            O link vale por 30 minutos e só funciona uma vez.
          </Alert>
        )}
      </div>

      <form onSubmit={enviar} noValidate>
        <Stack gap={5}>
          {(erro || geral) && (
            <ResumoDeErros
              titulo={geral ?? MSG.camposParaCorrigir}
              erros={erro ? [{ id: 'campo-identificador', mensagem: erro }] : []}
              foco={foco}
            />
          )}
          <FormField id="campo-identificador" label="Apelido ou e-mail" required error={erro}>
            <Input
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
            />
          </FormField>
          {exigeDesafio && <Desafio onToken={setTurnstileToken} />}
          <Button type="submit" size="lg" fullWidth loading={enviando} loadingText="Enviando…">
            {enviado ? 'Enviar de novo' : 'Enviar link'}
          </Button>
        </Stack>
      </form>
    </TelaPublica>
  );
}
