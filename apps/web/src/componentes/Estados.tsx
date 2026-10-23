import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Button, Card, Stack } from '@aprendemais/ui';
import type { ErroApi } from '../api/cliente';
import { MSG, mensagemGeral } from '../api/mensagens';
import { useSessao } from '../estado/sessao';
import { ROTAS } from '../rotas';
import { TelaPublica } from './TelaPublica';
import { Titulo } from './Titulo';

/** Aviso de carregamento (leitor de tela anuncia). */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p role="status" className="web-carregando">
      <span className="am-spinner" aria-hidden="true" /> {texto}
    </p>
  );
}

/** Erro de uma chamada, com "Tentar de novo" e o código da requisição para suporte (T16, RQ-32). */
export function ErroDeChamada({ erro, aoTentar }: { erro: ErroApi; aoTentar?: () => void }) {
  return (
    <Alert variant="error" title={mensagemGeral(erro)}>
      {erro.requestId && erro.code !== 'REDE' && <p>Código para o suporte: {erro.requestId}</p>}
      {aoTentar && (
        <p>
          <Button variant="secondary" size="sm" onClick={aoTentar}>
            Tentar de novo
          </Button>
        </p>
      )}
    </Alert>
  );
}

function Estado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <TelaPublica>
      <Card as="section" aria-label={titulo}>
        <Stack gap={4}>
          <Titulo>{titulo}</Titulo>
          {children}
        </Stack>
      </Card>
    </TelaPublica>
  );
}

export function SessaoExpirada() {
  const { state } = useLocation(); // `de`: rota a retomar depois do login
  return (
    <Estado titulo="Sua sessão acabou.">
      <p>Entre de novo para continuar.</p>
      <Link className="am-btn" to={ROTAS.entrar} state={state}>
        Entrar
      </Link>
    </Estado>
  );
}

/** 403 e 404 usam o mesmo texto (não revelar se o recurso existe — ADR-001 §3). */
export function SemAcesso() {
  return (
    <Estado titulo={MSG.semAcesso}>
      <Link className="am-btn" to={ROTAS.entrar}>
        Ir para o início
      </Link>
    </Estado>
  );
}

export function ErroGeral({ erro, aoTentar }: { erro: ErroApi; aoTentar: () => void }) {
  const semConexao = erro.code === 'REDE';
  return (
    <Estado titulo={semConexao ? 'Sem internet.' : 'Algo deu errado.'}>
      <p>{semConexao ? 'Tentaremos de novo quando voltar. Você também pode tentar agora.' : 'Não foi culpa sua.'}</p>
      {erro.requestId && !semConexao && <p>Código para o suporte: {erro.requestId}</p>}
      <Button onClick={aoTentar}>{semConexao ? 'Tentar agora' : 'Tentar de novo'}</Button>
    </Estado>
  );
}

export function AreaEmBreve() {
  const { sair } = useSessao();
  const navegar = useNavigate();
  return (
    <Estado titulo="Sua área está chegando.">
      <p>Por enquanto, você pode sair.</p>
      <Button onClick={() => void sair().then(() => navegar(ROTAS.entrar, { replace: true }))}>Sair</Button>
    </Estado>
  );
}

export function ContaEmExclusao() {
  return (
    <Estado titulo="Esta conta está sendo apagada.">
      <p>Se tiver dúvidas, fale com o canal do encarregado de dados da plataforma.</p>
    </Estado>
  );
}
