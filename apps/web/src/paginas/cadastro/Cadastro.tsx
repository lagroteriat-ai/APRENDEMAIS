import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  ANOS_ESCOLARES,
  type AnoEscolar,
  type ApelidoSugerido,
  type AvisosVigentes,
} from '@aprendemais/shared-types';
import { Alert, Button, Checkbox, FormField, Icon, Input, Modal, Select, Stack } from '@aprendemais/ui';
import { novoUuid, type ErroApi } from '../../api/cliente';
import { MSG, errosDeCampo, mensagemGeral } from '../../api/mensagens';
import { CampoSenha } from '../../componentes/CampoSenha';
import { Desafio } from '../../componentes/Desafio';
import { Carregando, ErroDeChamada } from '../../componentes/Estados';
import { ResumoDeErros, type ErroDeCampo } from '../../componentes/ResumoDeErros';
import { TelaPublica } from '../../componentes/TelaPublica';
import { Subtitulo, Titulo } from '../../componentes/Titulo';
import { AVISO_ALUNO } from '../../conteudo/avisos';
import { useApi } from '../../estado/api';
import { MESES, ROTULO_ANO_ESCOLAR, pareceMenor } from '../../lib/idade';
import { validarAnoEscolar, validarEmail, validarNascimento, validarSenhaNova } from '../../lib/validacao';
import { ROTAS } from '../../rotas';

type Passo = 1 | 2 | 3;

interface Rascunho {
  mes: string;
  ano: string;
  anoEscolar: string;
  email: string;
  senha: string;
  aviso: boolean;
}

/** Qual passo mostra cada campo (para levar a pessoa ao erro devolvido pelo servidor). */
const PASSO_DO_CAMPO: Record<string, Passo> = {
  apelidoToken: 1,
  nascimento: 1,
  anoEscolar: 1,
  email: 2,
  senha: 3,
  aviso: 3,
};

const ID_DO_CAMPO: Record<string, string> = {
  apelidoToken: 'campo-apelido',
  nascimento: 'campo-mes',
  anoEscolar: 'campo-ano-escolar',
  email: 'campo-email',
  senha: 'campo-senha',
  aviso: 'campo-aviso',
};

const ANO_ATUAL = new Date().getFullYear();
const ANOS_NASCIMENTO = Array.from({ length: 71 }, (_, i) => String(ANO_ATUAL - i)).filter((a) => Number(a) >= 1900);

/** T02–T04 — Cadastro de aluno em 3 passos. O rascunho fica só na memória (nada de dados de menores no navegador). */
export function Cadastro() {
  const api = useApi();
  const navegar = useNavigate();

  const [passo, setPasso] = useState<Passo>(1);
  const [rascunho, setRascunho] = useState<Rascunho>({ mes: '', ano: '', anoEscolar: '', email: '', senha: '', aviso: false });
  const [apelido, setApelido] = useState<ApelidoSugerido>();
  const [avisos, setAvisos] = useState<AvisosVigentes>();
  const [carga, setCarga] = useState<'carregando' | 'ok' | ErroApi>('carregando');
  const [sorteando, setSorteando] = useState(false);
  const [avisoSorteio, setAvisoSorteio] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<ErroApi>();
  const [foco, setFoco] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [exigeDesafio, setExigeDesafio] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [lerAviso, setLerAviso] = useState(false);
  const chave = useRef({ corpo: '', valor: novoUuid() });
  const enviandoRef = useRef(false);

  const sortear = useCallback(async (): Promise<boolean> => {
    setSorteando(true);
    const r = await api.chamar('sortearApelido');
    setSorteando(false);
    if (r.ok) {
      setApelido(r.data);
      setAvisoSorteio(`Seu novo apelido é ${r.data.apelido}.`);
      return true;
    }
    setAvisoSorteio('');
    setGeral(r);
    return false;
  }, [api]);

  const carregar = useCallback(async () => {
    setCarga('carregando');
    const [a, v] = await Promise.all([api.chamar('sortearApelido'), api.chamar('obterAvisosVigentes')]);
    if (a.ok && v.ok) {
      setApelido(a.data);
      setAvisos(v.data);
      setCarga('ok');
    } else {
      setCarga(a.ok ? (v as ErroApi) : (a as ErroApi));
    }
  }, [api]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function campo<K extends keyof Rascunho>(nome: K, valor: Rascunho[K], campoErro: string) {
    setRascunho((r) => ({ ...r, [nome]: valor }));
    setErros((e) => {
      if (!e[campoErro]) return e;
      const resto = { ...e };
      delete resto[campoErro];
      return resto;
    });
  }

  function falhar(novos: Record<string, string>, ir?: Passo) {
    setErros(novos);
    if (ir) setPasso(ir);
    setFoco((n) => n + 1);
  }

  function avancar(evento: FormEvent) {
    evento.preventDefault();
    setGeral(undefined);
    if (passo === 1) {
      const novos: Record<string, string> = {};
      const en = validarNascimento(rascunho.mes, rascunho.ano);
      const ea = validarAnoEscolar(rascunho.anoEscolar);
      if (en) novos.nascimento = en;
      if (ea) novos.anoEscolar = ea;
      if (!apelido) novos.apelidoToken = MSG.apelidoEmUso;
      return Object.keys(novos).length ? falhar(novos) : (setErros({}), setPasso(2));
    }
    if (passo === 2) {
      const e = validarEmail(rascunho.email);
      return e ? falhar({ email: e }) : (setErros({}), setPasso(3));
    }
    void enviar();
  }

  async function enviar() {
    if (enviandoRef.current || !apelido || !avisos) return;
    const novos: Record<string, string> = {};
    const es = validarSenhaNova(rascunho.senha);
    if (es) novos.senha = es;
    if (!rascunho.aviso) novos.aviso = 'Marque para continuar.';
    if (Object.keys(novos).length) return falhar(novos);

    const corpo = {
      apelidoToken: apelido.apelidoToken,
      nascimento: `${rascunho.ano}-${rascunho.mes}`,
      anoEscolar: rascunho.anoEscolar as AnoEscolar,
      email: rascunho.email.trim(),
      senha: rascunho.senha,
      aviso: { versao: avisos.aluno.versao },
      ...(turnstileToken ? { turnstileToken } : {}),
    };
    // Mesma chave ao reenviar o mesmo formulário; corpo novo = chave nova (DC-09).
    const json = JSON.stringify(corpo);
    if (chave.current.corpo !== json) chave.current = { corpo: json, valor: novoUuid() };

    enviandoRef.current = true;
    setEnviando(true);
    setErros({});
    setGeral(undefined);
    const r = await api.chamar('cadastrarAluno', { corpo, chave: chave.current.valor });
    enviandoRef.current = false;
    setEnviando(false);

    if (r.ok) return navegar(ROTAS.aguardando, { replace: true });

    setTurnstileToken(undefined);
    if (r.code === 'DESAFIO_REQUERIDO') {
      setExigeDesafio(true);
      setGeral(r);
      return setFoco((n) => n + 1);
    }
    if (r.code === 'CONFLICT' && r.details.some((d) => d.code === 'APELIDO_EM_USO')) {
      // O apelido foi ocupado por outra pessoa: sorteia outro e volta ao passo 1 avisando.
      const ok = await sortear();
      return falhar({ apelidoToken: MSG.apelidoEmUso }, ok ? 1 : undefined);
    }
    if (r.code === 'VALIDATION_ERROR' && r.details.length) {
      const doServidor = errosDeCampo(r);
      const primeiro = Math.min(...Object.keys(doServidor).map((c) => PASSO_DO_CAMPO[c] ?? 3)) as Passo;
      return falhar(doServidor, primeiro);
    }
    setGeral(r);
    setFoco((n) => n + 1);
  }

  /* ---------- Telas ---------- */
  if (carga === 'carregando') {
    return (
      <TelaPublica voltar={{ rotulo: 'Entrar', para: ROTAS.entrar }}>
        <Titulo>Criar conta</Titulo>
        <Carregando />
      </TelaPublica>
    );
  }
  if (carga !== 'ok') {
    return (
      <TelaPublica voltar={{ rotulo: 'Entrar', para: ROTAS.entrar }}>
        <Titulo>Criar conta</Titulo>
        <ErroDeChamada erro={carga} aoTentar={() => void carregar()} />
      </TelaPublica>
    );
  }

  const menor = pareceMenor(rascunho.mes, rascunho.ano);
  const lista: ErroDeCampo[] = Object.entries(erros).map(([c, mensagem]) => ({ id: ID_DO_CAMPO[c] ?? `campo-${c}`, mensagem }));
  const voltar =
    passo === 1
      ? { rotulo: 'Criar conta', para: ROTAS.entrar }
      : { rotulo: 'Criar conta', aoClicar: () => { setErros({}); setPasso((p) => (p - 1) as Passo); } };

  return (
    <TelaPublica voltar={voltar}>
      <div>
        <p className="web-passo">Passo {passo} de 3</p>
        <progress className="web-progresso" max={3} value={passo} aria-label="Progresso do cadastro" />
      </div>

      <form onSubmit={avancar} noValidate>
        <Stack gap={5}>
          {passo === 1 && (
            <>
              <Titulo key="p1">Sobre você</Titulo>
              {(lista.length > 0 || geral) && (
                <Resumo lista={lista} geral={geral} foco={foco} />
              )}
              <FormField
                id="campo-apelido"
                label="Seu apelido"
                help="Esse nome aparece para você e é com ele que você entra."
                error={erros.apelidoToken}
              >
                <Input
                  readOnly
                  value={apelido?.apelido ?? ''}
                  endAction={
                    <Button variant="secondary" loading={sorteando} loadingText="Sorteando…" onClick={() => void sortear()}>
                      Sortear outro
                    </Button>
                  }
                />
              </FormField>
              <p role="status" className="am-sr-only">
                {avisoSorteio}
              </p>
              <fieldset className="web-conjunto" aria-describedby={erros.nascimento ? 'campo-nascimento-erro' : undefined}>
                <legend>Quando você nasceu?</legend>
                <div className="web-duas-colunas">
                  <FormField id="campo-mes" label="Mês">
                    <Select
                      placeholder="Selecione"
                      value={rascunho.mes}
                      invalid={Boolean(erros.nascimento)}
                      onChange={(e) => campo('mes', e.target.value, 'nascimento')}
                    >
                      {MESES.map((nome, i) => (
                        <option key={nome} value={String(i + 1).padStart(2, '0')}>
                          {nome}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id="campo-ano" label="Ano">
                    <Select
                      placeholder="Selecione"
                      value={rascunho.ano}
                      invalid={Boolean(erros.nascimento)}
                      onChange={(e) => campo('ano', e.target.value, 'nascimento')}
                    >
                      {ANOS_NASCIMENTO.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                {/* Erro dos dois campos, abaixo e em largura total (a meia coluna ficava apertada). */}
                {erros.nascimento && (
                  <p id="campo-nascimento-erro" className="am-field__error web-erro-conjunto">
                    <Icon name="error" small />
                    <span>
                      <span className="am-sr-only">Erro:</span> {erros.nascimento}
                    </span>
                  </p>
                )}
              </fieldset>
              <FormField id="campo-ano-escolar" label="Em que ano você estuda?" error={erros.anoEscolar}>
                <Select
                  placeholder="Selecione"
                  value={rascunho.anoEscolar}
                  onChange={(e) => campo('anoEscolar', e.target.value, 'anoEscolar')}
                >
                  <optgroup label="Ensino Fundamental">
                    {ANOS_ESCOLARES.filter((a) => a.startsWith('EF')).map((a) => (
                      <option key={a} value={a}>
                        {ROTULO_ANO_ESCOLAR[a]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ensino Médio">
                    {ANOS_ESCOLARES.filter((a) => a.startsWith('EM')).map((a) => (
                      <option key={a} value={a}>
                        {ROTULO_ANO_ESCOLAR[a]}
                      </option>
                    ))}
                  </optgroup>
                </Select>
              </FormField>
              <Button type="submit" size="lg" fullWidth>
                Continuar
              </Button>
            </>
          )}

          {passo === 2 && (
            <>
              <Stack gap={2} key="p2">
                <Titulo>{menor ? 'Seu responsável' : 'Seu e-mail'}</Titulo>
                <Subtitulo>
                  {menor
                    ? 'Vamos pedir a autorização de um adulto responsável por você.'
                    : 'Enviaremos um link para confirmar.'}
                </Subtitulo>
              </Stack>
              {lista.length > 0 && <Resumo lista={lista} foco={foco} />}
              <FormField
                id="campo-email"
                label={menor ? 'E-mail do responsável' : 'E-mail'}
                help={menor ? 'Só usamos este e-mail para a autorização e avisos da sua conta.' : undefined}
                error={erros.email}
                required
              >
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete={menor ? 'off' : 'email'}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={rascunho.email}
                  onChange={(e) => campo('email', e.target.value, 'email')}
                />
              </FormField>
              <Button type="submit" size="lg" fullWidth>
                Continuar
              </Button>
            </>
          )}

          {passo === 3 && (
            <>
              <Titulo key="p3">Crie sua senha</Titulo>
              {(lista.length > 0 || geral) && <Resumo lista={lista} geral={geral} foco={foco} />}
              <CampoSenha
                id="campo-senha"
                label="Senha"
                value={rascunho.senha}
                onChange={(v) => campo('senha', v, 'senha')}
                autoComplete="new-password"
                ajuda="Mínimo de 8 caracteres."
                erro={erros.senha}
                required
                sugerir
              />
              <Checkbox
                id="campo-aviso"
                checked={rascunho.aviso}
                onChange={(e) => campo('aviso', e.target.checked, 'aviso')}
                error={erros.aviso}
                label={
                  <>
                    Li o aviso de privacidade para estudantes.{' '}
                    <Button variant="link" size="sm" onClick={() => setLerAviso(true)}>
                      Ler o aviso
                    </Button>
                  </>
                }
              />
              {exigeDesafio && <Desafio onToken={setTurnstileToken} />}
              <Button type="submit" size="lg" fullWidth loading={enviando} loadingText="Criando…">
                Criar minha conta
              </Button>
            </>
          )}
        </Stack>
      </form>

      <Modal
        open={lerAviso}
        onClose={() => setLerAviso(false)}
        title={AVISO_ALUNO.titulo}
        footer={<Button onClick={() => setLerAviso(false)}>Entendi</Button>}
      >
        {AVISO_ALUNO.paragrafos.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Modal>
    </TelaPublica>
  );
}

function Resumo({ lista, geral, foco }: { lista: ErroDeCampo[]; geral?: ErroApi; foco: number }) {
  if (geral && lista.length === 0) {
    return (
      <Alert variant="error" role="alert" title={mensagemGeral(geral)}>
        {geral.requestId && geral.code === 'INTERNAL' && <p>Código para o suporte: {geral.requestId}</p>}
      </Alert>
    );
  }
  return <ResumoDeErros titulo={MSG.camposParaCorrigir} erros={lista} foco={foco} />;
}
