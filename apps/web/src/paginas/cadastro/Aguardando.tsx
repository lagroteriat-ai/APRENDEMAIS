import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import type { Me, Pendencia } from '@aprendemais/shared-types';
import { Alert, Button, Card, FormField, Input, Stack } from '@aprendemais/ui';
import { MSG, errosDeCampo, mensagemGeral } from '../../api/mensagens';
import { Carregando, ErroDeChamada } from '../../componentes/Estados';
import { TelaPublica } from '../../componentes/TelaPublica';
import { Subtitulo, Titulo } from '../../componentes/Titulo';
import { useApi } from '../../estado/api';
import { useSessao } from '../../estado/sessao';
import { validarEmail } from '../../lib/validacao';
import { ROTAS, destinoDaSessao } from '../../rotas';

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Recife' });

/** T05 — "Falta pouco!" (aguardando o responsável) ou "Confirme seu e-mail". Sobrevive a recarregar: vem de `GET /me`. */
export function Aguardando() {
  const api = useApi();
  const { estado, carregar, sair } = useSessao();
  const navegar = useNavigate();
  const [pendencia, setPendencia] = useState<Pendencia | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string }>();
  const [ocupado, setOcupado] = useState<'reenviar' | 'corrigir' | null>(null);
  const [corrigindo, setCorrigindo] = useState(false);
  const [email, setEmail] = useState('');
  const [erroEmail, setErroEmail] = useState<string>();
  const [copiado, setCopiado] = useState(false);
  const [consultou, setConsultou] = useState(false);
  const iniciou = useRef(false);

  // Sempre consulta `/me` ao abrir: o estado guardado pode ser de antes do cadastro/login.
  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    void carregar().then(() => setConsultou(true));
  }, [carregar]);

  if (!consultou || estado.fase === 'desconhecida') {
    return (
      <TelaPublica>
        <Titulo>Falta pouco!</Titulo>
        <Carregando />
      </TelaPublica>
    );
  }
  if (estado.fase === 'encerrada') return <Navigate to={ROTAS.entrar} replace />;
  if (estado.fase === 'anonima') return <Navigate to={ROTAS.sessaoExpirada} replace />;
  if (estado.fase === 'erro') {
    return (
      <TelaPublica>
        <Titulo>Falta pouco!</Titulo>
        <ErroDeChamada erro={estado.erro} aoTentar={() => void carregar()} />
      </TelaPublica>
    );
  }

  const me: Me = estado.me;
  const atual = pendencia ?? me.pendencia;
  // Conta já ativa (ou sem pendência): segue para a casa do papel.
  if (!atual || (me.status !== 'pendente_responsavel' && me.status !== 'pendente_email')) {
    return <Navigate to={destinoDaSessao(me)} replace />;
  }

  const doResponsavel = atual.tipo === 'responsavel';
  const expira = FORMATO_DATA.format(new Date(atual.expiraEm));

  async function reenviar() {
    setOcupado('reenviar');
    setAviso(undefined);
    const r = await api.chamar('reenviarPendencia');
    setOcupado(null);
    if (r.ok) {
      setPendencia(r.data);
      return setAviso({ tipo: 'success', texto: 'Reenviado!' });
    }
    setAviso({ tipo: 'error', texto: r.code === 'RATE_LIMITED' ? MSG.esperePedirDeNovo : mensagemGeral(r) });
  }

  async function corrigir(evento: FormEvent) {
    evento.preventDefault();
    const e = validarEmail(email);
    setErroEmail(e);
    if (e) return;
    setOcupado('corrigir');
    setAviso(undefined);
    const r = await api.chamar('corrigirEmailPendencia', { corpo: { email: email.trim() } });
    setOcupado(null);
    if (r.ok) {
      setPendencia(r.data);
      setCorrigindo(false);
      setEmail('');
      return setAviso({ tipo: 'success', texto: 'E-mail corrigido. Enviamos um novo link e o anterior deixou de valer.' });
    }
    if (r.code === 'VALIDATION_ERROR') return setErroEmail(errosDeCampo(r).email ?? MSG.camposParaCorrigir);
    setAviso({ tipo: 'error', texto: r.code === 'RATE_LIMITED' ? MSG.esperePedirDeNovo : mensagemGeral(r) });
  }

  async function copiar() {
    if (!me.apelido) return;
    try {
      await navigator.clipboard.writeText(me.apelido);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <TelaPublica>
      <Stack gap={2}>
        <Titulo>{doResponsavel ? 'Falta pouco!' : 'Confirme seu e-mail'}</Titulo>
        <Subtitulo>
          {doResponsavel
            ? `Enviamos um pedido de autorização para ${atual.emailMascarado}.`
            : `Enviamos um link para confirmar seu e-mail, ${atual.emailMascarado}.`}
        </Subtitulo>
      </Stack>

      {me.apelido && (
        <Card as="section" aria-label="Seu apelido para entrar">
          <p>Seu apelido para entrar:</p>
          <p className="web-apelido">
            <strong>{me.apelido}</strong>
            {typeof navigator !== 'undefined' && navigator.clipboard && (
              <Button variant="secondary" size="sm" onClick={() => void copiar()}>
                Copiar
              </Button>
            )}
          </p>
          <p role="status" className="web-ajuda">
            {copiado ? 'Copiado!' : ''}
          </p>
        </Card>
      )}

      <p>
        {doResponsavel
          ? 'Quando seu responsável autorizar, você já pode entrar.'
          : 'Depois de confirmar, você já pode entrar.'}{' '}
        O pedido vale até {expira}.
      </p>

      <div aria-live="polite">
        {aviso && (
          <Alert variant={aviso.tipo} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
            {aviso.texto}
          </Alert>
        )}
      </div>

      <Stack gap={4}>
        <Button variant="secondary" loading={ocupado === 'reenviar'} loadingText="Reenviando…" onClick={() => void reenviar()}>
          Reenviar e-mail
        </Button>

        {corrigindo ? (
          <form onSubmit={corrigir} noValidate>
            <Stack gap={3}>
              <FormField
                id="campo-email"
                label={doResponsavel ? 'E-mail correto do responsável' : 'E-mail correto'}
                error={erroEmail}
                required
              >
                <Input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete={doResponsavel ? 'off' : 'email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <Stack gap={3} direction="row">
                <Button type="submit" loading={ocupado === 'corrigir'} loadingText="Enviando…">
                  Enviar para este e-mail
                </Button>
                <Button variant="link" onClick={() => setCorrigindo(false)}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </form>
        ) : (
          <div>
            <Button variant="link" onClick={() => setCorrigindo(true)}>
              E-mail errado? Corrigir
            </Button>
          </div>
        )}

        <p>
          <Link to={ROTAS.entrar}>Já foi autorizado? Entrar</Link>
        </p>
        <div>
          <Button
            variant="link"
            onClick={() => {
              void sair().then(() => navegar(ROTAS.entrar, { replace: true }));
            }}
          >
            Sair
          </Button>
        </div>
      </Stack>
    </TelaPublica>
  );
}
