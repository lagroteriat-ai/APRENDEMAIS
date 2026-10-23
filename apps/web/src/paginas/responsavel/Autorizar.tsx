import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ConsentimentoRegistrado, PedidoConsentimento } from '@aprendemais/shared-types';
import { Alert, Button, Card, Checkbox, FormField, Input, Stack } from '@aprendemais/ui';
import { novoUuid, type ErroApi } from '../../api/cliente';
import { MSG, errosDeCampo, mensagemGeral } from '../../api/mensagens';
import { Carregando, ErroDeChamada } from '../../componentes/Estados';
import { ResumoDeErros, type ErroDeCampo } from '../../componentes/ResumoDeErros';
import { TelaPublica } from '../../componentes/TelaPublica';
import { Subtitulo, Titulo, useTokenDeLink } from '../../componentes/Titulo';
import { O_QUE_GUARDAMOS, O_QUE_NAO_FAZEMOS } from '../../conteudo/avisos';
import { useApi } from '../../estado/api';
import { validarNome } from '../../lib/validacao';

type Fase =
  | { nome: 'carregando' }
  | { nome: 'pedido'; pedido: PedidoConsentimento }
  | { nome: 'autorizado'; registro: ConsentimentoRegistrado }
  | { nome: 'recusado' }
  | { nome: 'invalido' }
  | { nome: 'erro'; erro: ErroApi };

const ID_DO_CAMPO: Record<string, string> = {
  nomeResponsavel: 'campo-nome',
  declaracao: 'campo-declaracao',
  aviso: 'campo-declaracao',
};

/** T06 e T07 — o responsável lê, decide (Autorizar / Não autorizar) e vê o resultado. Sem conta: age pelo link. */
export function Autorizar() {
  const api = useApi();
  const token = useTokenDeLink();
  const [fase, setFase] = useState<Fase>({ nome: 'carregando' });
  const [nome, setNome] = useState('');
  const [declaracao, setDeclaracao] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<ErroApi>();
  const [foco, setFoco] = useState(0);
  const [ocupado, setOcupado] = useState<'autorizar' | 'recusar' | null>(null);
  const chave = useRef(novoUuid());
  const consultou = useRef(false);

  const consultar = useCallback(async () => {
    if (!token) return setFase({ nome: 'invalido' });
    setFase({ nome: 'carregando' });
    const r = await api.chamar('consultarPedidoConsentimento', { corpo: { token } });
    if (r.ok) return setFase({ nome: 'pedido', pedido: r.data });
    setFase(r.code === 'TOKEN_INVALIDO' || r.code === 'NOT_FOUND' ? { nome: 'invalido' } : { nome: 'erro', erro: r });
  }, [api, token]);

  useEffect(() => {
    if (consultou.current) return;
    consultou.current = true;
    void consultar();
  }, [consultar]);

  async function autorizar(evento: FormEvent) {
    evento.preventDefault();
    if (fase.nome !== 'pedido' || !token || ocupado) return;
    const novos: Record<string, string> = {};
    const en = validarNome(nome);
    if (en) novos.nomeResponsavel = en;
    if (!declaracao) novos.declaracao = 'Marque a caixa para autorizar.';
    if (Object.keys(novos).length) {
      setErros(novos);
      return setFoco((n) => n + 1);
    }
    setOcupado('autorizar');
    setErros({});
    setGeral(undefined);
    const r = await api.chamar('concederConsentimento', {
      chave: chave.current,
      corpo: {
        token,
        nomeResponsavel: nome.trim(),
        declaracao: true,
        aviso: { versao: fase.pedido.aviso.versao },
        rankingAutorizado: fase.pedido.rankingDisponivel && ranking,
      },
    });
    setOcupado(null);
    if (r.ok) return setFase({ nome: 'autorizado', registro: r.data });
    if (r.code === 'TOKEN_INVALIDO') return setFase({ nome: 'invalido' });
    if (r.code === 'VALIDATION_ERROR' && r.details.length) {
      setErros(errosDeCampo(r));
    } else {
      setGeral(r);
    }
    setFoco((n) => n + 1);
  }

  async function recusar() {
    if (!token || ocupado) return;
    setOcupado('recusar');
    setGeral(undefined);
    const r = await api.chamar('recusarConsentimento', { corpo: { token } });
    setOcupado(null);
    if (r.ok) return setFase({ nome: 'recusado' });
    if (r.code === 'TOKEN_INVALIDO') return setFase({ nome: 'invalido' });
    setGeral(r);
    setFoco((n) => n + 1);
  }

  if (fase.nome === 'carregando') {
    return (
      <TelaPublica>
        <Titulo abaTitulo="Autorizar uso">Autorização</Titulo>
        <Carregando />
      </TelaPublica>
    );
  }
  if (fase.nome === 'erro') {
    return (
      <TelaPublica>
        <Titulo abaTitulo="Autorizar uso">Autorização</Titulo>
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
            <p>Ele pode ter expirado ou já ter sido usado. O cadastro não autorizado em 7 dias é apagado.</p>
            <p>Peça para o aluno criar a conta de novo.</p>
            <a className="am-btn" href="/">
              Ir para o início
            </a>
          </Stack>
        </Card>
      </TelaPublica>
    );
  }
  if (fase.nome === 'recusado') {
    return (
      <TelaPublica>
        <Card as="section" aria-label="Autorização recusada">
          <Stack gap={4}>
            <Titulo>Tudo bem.</Titulo>
            <p>Apagamos o cadastro e este e-mail. Nenhum dado foi guardado.</p>
            <a className="am-btn" href="/">
              Ir para o início
            </a>
          </Stack>
        </Card>
      </TelaPublica>
    );
  }
  if (fase.nome === 'autorizado') {
    return (
      <TelaPublica>
        <Card as="section" aria-label="Autorização registrada">
          <Stack gap={4}>
            <Titulo>Tudo certo!</Titulo>
            <p>
              <strong>{fase.registro.apelido}</strong> já pode entrar. Enviamos um e-mail com o link para mudar de
              ideia quando quiser.
            </p>
            <p className="web-ajuda">Protocolo: {fase.registro.protocolo}</p>
            <a className="am-btn" href="/">
              Ir para o início
            </a>
          </Stack>
        </Card>
      </TelaPublica>
    );
  }

  const { pedido } = fase;
  const lista: ErroDeCampo[] = Object.entries(erros).map(([c, mensagem]) => ({ id: ID_DO_CAMPO[c] ?? `campo-${c}`, mensagem }));
  const pronto = nome.trim().length > 0 && declaracao;

  return (
    <TelaPublica>
      <Stack gap={2}>
        <Titulo abaTitulo="Autorizar uso">{`${pedido.apelido} quer usar o Aprende+`}</Titulo>
        <Subtitulo>Precisamos da sua autorização.</Subtitulo>
      </Stack>

      <section aria-labelledby="guardamos" className="web-bloco">
        <h2 id="guardamos">O que guardamos</h2>
        <ul>
          {O_QUE_GUARDAMOS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h2 id="nao-fazemos">O que NÃO fazemos</h2>
        <ul aria-labelledby="nao-fazemos">
          {O_QUE_NAO_FAZEMOS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p>Você pode mudar de ideia quando quiser, por este e-mail.</p>
      </section>

      <form onSubmit={autorizar} noValidate>
        <Stack gap={5}>
          {(lista.length > 0 || geral) && (
            geral ? (
              <Alert variant="error" title={mensagemGeral(geral)}>
                {geral.requestId && geral.code === 'INTERNAL' && <p>Código para o suporte: {geral.requestId}</p>}
              </Alert>
            ) : (
              <ResumoDeErros titulo={MSG.camposParaCorrigir} erros={lista} foco={foco} />
            )
          )}
          <FormField id="campo-nome" label="Seu nome" required error={erros.nomeResponsavel}>
            <Input autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          </FormField>
          <Checkbox
            id="campo-declaracao"
            checked={declaracao}
            onChange={(e) => setDeclaracao(e.target.checked)}
            error={erros.declaracao ?? erros.aviso}
            label={`Sou responsável por ${pedido.apelido} e autorizo o uso desses dados.`}
          />
          {pedido.rankingDisponivel && (
            <Card as="section" aria-label="Ranking (opcional)">
              <Checkbox
                checked={ranking}
                onChange={(e) => setRanking(e.target.checked)}
                label="Mostrar o apelido no ranking da turma e da escola"
                help="Opcional. Começa desmarcado."
              />
            </Card>
          )}
          <p id="dica-autorizar" className="web-ajuda">
            {pronto ? '' : 'Para autorizar, escreva seu nome e marque a caixa acima.'}
          </p>
          {/* Mesmo peso visual nos dois botões (RQ-08: sem padrão manipulativo). */}
          <Stack direction="row" gap={3}>
            <Button
              type="submit"
              variant="secondary"
              loading={ocupado === 'autorizar'}
              loadingText="Autorizando…"
              disabled={!pronto || ocupado === 'recusar'}
              aria-describedby="dica-autorizar"
            >
              Autorizar
            </Button>
            <Button
              variant="secondary"
              loading={ocupado === 'recusar'}
              loadingText="Enviando…"
              disabled={ocupado === 'autorizar'}
              onClick={() => void recusar()}
            >
              Não autorizar
            </Button>
          </Stack>
        </Stack>
      </form>
    </TelaPublica>
  );
}
