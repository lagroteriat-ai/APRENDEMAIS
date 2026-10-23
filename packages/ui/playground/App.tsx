import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Alert,
  AppShell,
  Button,
  Card,
  Checkbox,
  Container,
  FormField,
  Grid,
  Input,
  Modal,
  Select,
  Stack,
  type Etapa,
} from '../src';

const CORES = [
  ['brand-navy', 'Navy'],
  ['brand-blue', 'Blue'],
  ['brand-yellow', 'Yellow (só fundo)'],
  ['neutral-text', 'Texto'],
  ['neutral-muted', 'Muted'],
  ['neutral-border', 'Borda de campo'],
  ['neutral-surface', 'Surface'],
  ['primary-hover', 'Primário hover'],
  ['accent-light', 'Selo'],
  ['feedback-success-solid', 'Sucesso'],
  ['feedback-error-solid', 'Erro'],
  ['feedback-warning-solid', 'Aviso'],
] as const;

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section className="pg-section" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </section>
  );
}

function FormularioDeSenha() {
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [modal, setModal] = useState(false);
  const resumo = useRef<HTMLDivElement>(null);

  const erroSenha = senha.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined;
  const erroAviso = aviso ? undefined : 'Marque para continuar.';
  const temErro = Boolean(erroSenha || erroAviso);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);
    if (temErro) {
      // Resumo de erros no topo, com foco (fluxos.md §9).
      requestAnimationFrame(() => resumo.current?.focus());
      return;
    }
    setEnviando(true);
    setTimeout(() => setEnviando(false), 1500);
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Stack gap={5}>
        {tentou && temErro && (
          <Alert ref={resumo} variant="error" tabIndex={-1} title="Falta pouco para criar a conta.">
            <ul>
              {erroSenha && (
                <li>
                  <a href="#campo-senha">{erroSenha}</a>
                </li>
              )}
              {erroAviso && (
                <li>
                  <a href="#campo-aviso">{erroAviso}</a>
                </li>
              )}
            </ul>
          </Alert>
        )}
        <FormField
          id="campo-senha"
          label="Senha"
          required
          help="Mínimo de 8 caracteres."
          error={tentou ? erroSenha : undefined}
        >
          <Input
            type={mostrar ? 'text' : 'password'}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            endAction={
              <Button variant="secondary" aria-pressed={mostrar} onClick={() => setMostrar((v) => !v)}>
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </Button>
            }
          />
        </FormField>
        <div>
          <Button variant="link" onClick={() => setSenha('bola-nuvem-sete')}>
            Sugerir uma senha fácil
          </Button>
        </div>
        <Checkbox
          id="campo-aviso"
          checked={aviso}
          onChange={(e) => setAviso(e.target.checked)}
          error={tentou ? erroAviso : undefined}
          label={
            <>
              Li o aviso de privacidade para estudantes.{' '}
              <Button variant="link" size="sm" onClick={() => setModal(true)}>
                Ler o aviso
              </Button>
            </>
          }
        />
        <Button type="submit" size="lg" fullWidth loading={enviando} loadingText="Criando…">
          Criar minha conta
        </Button>
      </Stack>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Aviso de privacidade para estudantes"
        footer={<Button onClick={() => setModal(false)}>Entendi</Button>}
      >
        <p>Guardamos só seu apelido, o mês e o ano em que você nasceu, seu ano escolar e seu progresso.</p>
      </Modal>
    </form>
  );
}

function ConfirmacaoDestrutiva() {
  const [aberto, setAberto] = useState(false);
  const voltar = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button variant="danger" onClick={() => setAberto(true)}>
        Retirar autorização
      </Button>
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Retirar a autorização de LeaoAzul42?"
        initialFocusRef={voltar}
        footer={
          <>
            <Button variant="danger" onClick={() => setAberto(false)}>
              Retirar
            </Button>
            <Button ref={voltar} variant="secondary" onClick={() => setAberto(false)}>
              Voltar
            </Button>
          </>
        }
      >
        <p>Isso não pode ser desfeito. Os dados são apagados em até 15 dias.</p>
      </Modal>
    </>
  );
}

export function App() {
  const [etapa, setEtapa] = useState<Etapa>('neutra');

  return (
    <AppShell
      etapa={etapa}
      header={
        <div className="pg-header am-on-dark">
          <Container>
            <h1>Aprende+ · Design system</h1>
          </Container>
        </div>
      }
    >
      <Container size="content">
        <Stack gap={4}>
          <p>
            Página de exemplo dos componentes de <strong>@aprendemais/ui</strong>. Use Tab para testar o foco.
          </p>
          <FormField label="Etapa de ensino (data-etapa)">
            <Select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>
              <option value="neutra">Neutra (telas públicas e professor)</option>
              <option value="fund1">Fundamental I (1º–5º ano)</option>
              <option value="fund2">Fundamental II (6º–9º ano)</option>
              <option value="medio">Ensino Médio</option>
            </Select>
          </FormField>
        </Stack>

        <Secao id="s-cores" titulo="Cores (tokens)">
          <ul className="pg-swatches">
            {CORES.map(([token, nome]) => (
              <li key={token} className="pg-swatch">
                <span className="pg-swatch__cor" style={{ background: `var(--am-color-${token})` }} />
                <strong>{nome}</strong>
                <code>--am-color-{token}</code>
              </li>
            ))}
          </ul>
        </Secao>

        <Secao id="s-tipografia" titulo="Tipografia">
          <Stack gap={2}>
            <h1>Título 1 — Entrar</h1>
            <h2>Título 2 — Sobre você</h2>
            <h3>Título 3 — Suas atividades</h3>
            <p>
              Texto corrido de 16px (18px no Fundamental I). <a href="#s-tipografia">Link de exemplo</a>.
            </p>
            <p style={{ color: 'var(--am-color-neutral-muted)', fontSize: 'var(--am-typography-size-sm)' }}>
              Legenda ou ajuda em texto secundário.
            </p>
          </Stack>
        </Secao>

        <Secao id="s-botoes" titulo="Button">
          <Stack direction="row" gap={3}>
            <Button>Primário</Button>
            <Button variant="accent">Destaque</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="danger">Perigo</Button>
            <Button variant="link">Link</Button>
          </Stack>
          <Stack direction="row" gap={3}>
            <Button size="sm">Pequeno (36px)</Button>
            <Button>Médio (44px)</Button>
            <Button size="lg">Grande (52px)</Button>
          </Stack>
          <Stack direction="row" gap={3}>
            <Button disabled>Desabilitado</Button>
            <Button loading loadingText="Entrando…">
              Entrar
            </Button>
          </Stack>
          <Button fullWidth>Largura total (mobile)</Button>
          <div className="am-on-dark" style={{ background: 'var(--am-color-brand-navy)', padding: '1rem' }}>
            <Button variant="accent">Foco amarelo sobre navy (.am-on-dark)</Button>
          </div>
        </Secao>

        <Secao id="s-campos" titulo="FormField, Input, Select, Checkbox">
          <Container size="form" style={{ marginInline: 0, paddingInline: 0 }}>
            <Stack gap={5}>
              <FormField label="Usuário ou e-mail" required>
                <Input autoComplete="username" />
              </FormField>
              <FormField label="E-mail do responsável" help="Só usamos para a autorização." error="Escreva um e-mail válido.">
                <Input type="email" inputMode="email" autoComplete="email" defaultValue="maria@" />
              </FormField>
              <FormField label="Código" optional>
                <Input disabled defaultValue="Campo desabilitado" />
              </FormField>
              <Grid columns={2} gap={3}>
                <FormField label="Mês">
                  <Select placeholder="Selecione" defaultValue="">
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                  </Select>
                </FormField>
                <FormField label="Ano" error="Escolha o ano.">
                  <Select placeholder="Selecione" defaultValue="">
                    <option value="2015">2015</option>
                    <option value="2014">2014</option>
                  </Select>
                </FormField>
              </Grid>
              <Checkbox label="Mostrar o apelido no ranking da turma" help="Opcional. Você pode mudar quando quiser." />
              <Checkbox label="Sou responsável e autorizo o uso desses dados." error="Marque para continuar." />
            </Stack>
          </Container>
        </Secao>

        <Secao id="s-formulario" titulo="Formulário completo (senha, aviso, resumo de erros)">
          <Container size="form" style={{ marginInline: 0, paddingInline: 0 }}>
            <FormularioDeSenha />
          </Container>
        </Secao>

        <Secao id="s-alertas" titulo="Alert">
          <Stack gap={3}>
            <Alert variant="info" title="Informação">O pedido vale por 7 dias.</Alert>
            <Alert variant="success" title="Reenviado!">Confira o e-mail do responsável.</Alert>
            <Alert variant="warning" title="Atenção">Esta ação encerra todas as sessões.</Alert>
            <Alert variant="error" title="Usuário ou senha incorretos.">Confira e tente de novo.</Alert>
          </Stack>
        </Secao>

        <Secao id="s-cartoes" titulo="Card e Grid">
          <Grid columns={3}>
            <Card as="section" title="Suas atividades" footer={<Button size="sm" variant="secondary">Ver tudo</Button>}>
              <p>As primeiras atividades chegam em breve.</p>
            </Card>
            <Card as="section" title="Seu progresso">
              <p>Quando você fizer atividades, seu progresso aparece aqui.</p>
            </Card>
            <Card as="section" title="Selecionado" tone="tint">
              <p>Cartão com destaque.</p>
            </Card>
          </Grid>
        </Secao>

        <Secao id="s-modal" titulo="Modal">
          <Stack direction="row" gap={3}>
            <ConfirmacaoDestrutiva />
          </Stack>
          <p>O modal de “Ler o aviso” está no formulário completo acima.</p>
        </Secao>
      </Container>
    </AppShell>
  );
}
