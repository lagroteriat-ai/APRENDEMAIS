import type { Me } from '@aprendemais/shared-types';
import { AppShell, Card, Container, Grid, Stack } from '@aprendemais/ui';
import { CabecalhoLogado } from '../componentes/CabecalhoLogado';
import { Subtitulo, Titulo } from '../componentes/Titulo';

/** T14 — início do professor (vazio no Sprint 1). Telas públicas e do professor usam a etapa `neutra`. */
export function InicioProfessor({ me }: { me: Me }) {
  const nome = me.nome ?? 'professor(a)';
  return (
    <AppShell etapa="neutra" header={<CabecalhoLogado me={me} rotulo={nome} />}>
      <Container size="content">
        <Stack gap={6}>
          <Stack gap={2}>
            <Titulo>{`Olá, ${nome}`}</Titulo>
            {me.escola && <Subtitulo>Escola {me.escola.nome}</Subtitulo>}
          </Stack>
          <Grid columns={2}>
            <Card as="section" title="Minhas turmas">
              <p>Você ainda não tem turmas. Em breve você poderá criar turmas e atividades aqui.</p>
            </Card>
            <Card as="section" title="Sua conta">
              {me.email && <p>{me.email}</p>}
              <p>Papel: professor</p>
            </Card>
          </Grid>
        </Stack>
      </Container>
    </AppShell>
  );
}
