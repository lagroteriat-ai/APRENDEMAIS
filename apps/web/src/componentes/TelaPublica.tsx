import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AppShell, Container, Stack } from '@aprendemais/ui';
import { ROTAS } from '../rotas';

export function Logo() {
  return (
    <Link to={ROTAS.entrar} className="web-logo" aria-label="Aprende+, ir para entrar">
      Aprende<span aria-hidden="true">+</span>
    </Link>
  );
}

interface Props {
  children: ReactNode;
  /** Link "voltar" no topo (ex.: "Criar conta"). */
  voltar?: { rotulo: string; para?: string; aoClicar?: () => void };
  /** Linha extra abaixo do formulário (ex.: "Primeira vez aqui?"). */
  rodape?: ReactNode;
}

/** Moldura das telas públicas (T01–T12): etapa `neutra`, coluna de formulário de 440px, 1 `<h1>`. */
export function TelaPublica({ children, voltar, rodape }: Props) {
  return (
    <AppShell
      header={
        <Container size="form">
          <div className="web-cabecalho">
            <Logo />
          </div>
        </Container>
      }
    >
      <Container size="form">
        <Stack gap={6}>
          {voltar &&
            (voltar.para ? (
              <Link to={voltar.para} className="web-voltar">
                <span aria-hidden="true">‹ </span>
                {voltar.rotulo}
              </Link>
            ) : (
              <button type="button" className="web-voltar" onClick={voltar.aoClicar}>
                <span aria-hidden="true">‹ </span>
                {voltar.rotulo}
              </button>
            ))}
          {children}
          {rodape}
        </Stack>
      </Container>
    </AppShell>
  );
}
