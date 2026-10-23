import type { Me } from '@aprendemais/shared-types';
import { AppShell, Card, Container, Grid, Stack } from '@aprendemais/ui';
import { CabecalhoLogado } from '../componentes/CabecalhoLogado';
import { Subtitulo, Titulo } from '../componentes/Titulo';
import { etapaDe } from '../lib/idade';

/** T13 — início do aluno (vazio no Sprint 1: sem ranking nem pontuação). `data-etapa` vem do ano escolar. */
export function InicioAluno({ me }: { me: Me }) {
  const apelido = me.apelido ?? 'aluno';
  return (
    <AppShell etapa={etapaDe(me.anoEscolar)} header={<CabecalhoLogado me={me} rotulo={apelido} />}>
      <Container size="content">
        <Stack gap={6}>
          <Stack gap={2}>
            <Titulo>{`Oi, ${apelido}!`}</Titulo>
            <Subtitulo>Que bom ver você por aqui.</Subtitulo>
          </Stack>
          <Grid columns={2}>
            <Card as="section" title="Suas atividades">
              <p>As primeiras atividades chegam em breve.</p>
            </Card>
            <Card as="section" title="Seu progresso">
              <p>Quando você fizer atividades, seu progresso aparece aqui.</p>
            </Card>
          </Grid>
        </Stack>
      </Container>
    </AppShell>
  );
}
